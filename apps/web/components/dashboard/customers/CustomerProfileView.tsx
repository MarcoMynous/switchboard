'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AppIcon } from '@/components/AppIcon';
import { Button } from '@/components/ui/button';
import type { CustomerDirectoryRecord } from '@/lib/customers-server';
import { formatNairaFromKobo } from '../DashboardContext';

function formatInTimezone(iso: string, timezone = 'Africa/Lagos', withTime = false): string {
  try {
    const tz = timezone.includes('/') ? timezone.split(' ')[0] : 'Africa/Lagos';
    return new Intl.DateTimeFormat('en-NG', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
      timeZone: tz,
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function getBookingStatusBadge(status: CustomerDirectoryRecord['bookings'][number]['status']) {
  switch (status) {
    case 'confirmed':
      return { label: 'Confirmed', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
    case 'completed':
      return { label: 'Completed', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
    case 'held':
      return { label: 'Awaiting Deposit', cls: 'bg-amber-50 text-amber-800 border-amber-200' };
    case 'expired':
      return { label: 'Expired', cls: 'bg-slate-100 text-slate-700 border-slate-200' };
    case 'cancelled':
      return { label: 'Cancelled', cls: 'bg-rose-50 text-rose-800 border-rose-200' };
    case 'no_show':
      return { label: 'No Show', cls: 'bg-rose-50 text-rose-800 border-rose-200' };
  }
}

function getPaymentStatusLabel(
  status: CustomerDirectoryRecord['bookings'][number]['paymentStatus'],
): string {
  switch (status) {
    case 'verified':
      return 'Deposit Verified';
    case 'pending_verification':
      return 'Payment Being Verified';
    case 'awaiting_payment':
      return 'Awaiting Payment';
    case 'not_required':
      return 'No Deposit Required';
    case 'refund_pending':
      return 'Refund Pending';
    case 'refunded':
      return 'Refunded';
    case 'failed':
      return 'Payment Failed';
  }
}

export interface CustomerProfileViewProps {
  customer: CustomerDirectoryRecord;
  timezone: string;
  userRole: 'owner' | 'staff';
  canPersistEdits: boolean;
  onClose?: () => void;
  onCustomerUpdated: (updated: CustomerDirectoryRecord) => void;
  onOpenExistingProfile?: (customerId: string) => void;
  onCreateBooking?: () => void;
  onNavigateSection: (
    section: 'bookings' | 'conversations' | 'needs-attention' | 'payments',
  ) => void;
  dedicatedRouteHref?: string;
}

export function CustomerProfileView({
  customer,
  timezone,
  userRole,
  canPersistEdits,
  onClose,
  onCustomerUpdated,
  onOpenExistingProfile,
  onCreateBooking,
  onNavigateSection,
  dedicatedRouteHref,
}: CustomerProfileViewProps) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(customer.name);
  const [editPhone, setEditPhone] = useState(customer.phoneE164);
  const [editChannel, setEditChannel] = useState<'whatsapp' | 'web_chat' | 'phone' | ''>(
    customer.preferredChannel ?? '',
  );
  const [editLanguage, setEditLanguage] = useState(customer.preferredLanguage ?? '');
  const [editNotes, setEditNotes] = useState(customer.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflictCustomer, setConflictCustomer] = useState<{ id: string; name: string } | null>(
    null,
  );

  const isReturning = customer.confirmedBookingsCount >= 2;
  const nowMs = Date.now();
  const upcomingConfirmed = customer.bookings
    .filter((b) => b.status === 'confirmed' && new Date(b.startsAt).getTime() >= nowMs)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  const pendingReservations = customer.bookings.filter((b) => b.status === 'held');

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setConflictCustomer(null);

    if (!canPersistEdits) {
      setSaveError('Sign in to save customer profile changes to the database.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/customers/${encodeURIComponent(customer.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          ...(userRole === 'owner' ? { phone: editPhone.trim() } : {}),
          preferredChannel: editChannel || null,
          preferredLanguage: editLanguage.trim() || null,
          notes: editNotes.trim() || null,
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        customer?: CustomerDirectoryRecord;
        code?: string;
        error?: string;
        existingCustomer?: { id: string; name: string };
      };

      if (res.status === 409 && data.existingCustomer) {
        setConflictCustomer(data.existingCustomer);
        setSaveError(
          data.error ||
            'Another customer already uses that phone number. Profiles are never merged automatically.',
        );
        return;
      }

      if (!res.ok || !data.ok || !data.customer) {
        setSaveError(data.error || 'Could not update customer profile.');
        return;
      }

      onCustomerUpdated(data.customer);
      setEditing(false);
    } catch {
      setSaveError('Network error while saving customer details.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Profile Header */}
      <div className="p-5 sm:p-6 border-b border-border bg-white space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-full bg-primary-container text-white flex items-center justify-center font-bold text-base shrink-0">
              {getInitials(customer.name)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-text-primary truncate">{customer.name}</h2>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                    isReturning
                      ? 'bg-indigo-50 text-primary border-indigo-200'
                      : 'bg-slate-100 text-text-secondary border-slate-200'
                  }`}
                >
                  {isReturning ? 'Returning Customer' : 'New Customer'}
                </span>
              </div>
              <p className="text-xs font-mono text-text-secondary mt-0.5">{customer.phoneE164}</p>
              <p className="text-[11px] text-text-secondary mt-0.5">
                Ref: <span className="font-mono">{customer.reference}</span> • First recorded{' '}
                {formatInTimezone(customer.createdAt, timezone)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {dedicatedRouteHref && (
              <Link
                href={dedicatedRouteHref}
                className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-container-low transition-colors"
                title="Open full profile page"
                aria-label="Open full profile page"
              >
                <AppIcon name="open_in_new" className="text-[18px]" />
              </Link>
            )}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-container-low transition-colors cursor-pointer"
                aria-label="Close customer profile"
              >
                <AppIcon name="close" className="text-[20px]" />
              </button>
            )}
          </div>
        </div>

        {/* Profile Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setEditName(customer.name);
              setEditPhone(customer.phoneE164);
              setEditChannel(customer.preferredChannel ?? '');
              setEditLanguage(customer.preferredLanguage ?? '');
              setEditNotes(customer.notes ?? '');
              setSaveError(null);
              setConflictCustomer(null);
              setEditing((prev) => !prev);
            }}
          >
            <AppIcon name="edit" className="text-[15px]" />
            <span>{editing ? 'Cancel Edit' : 'Edit Customer'}</span>
          </Button>

          {onCreateBooking && (
            <Button type="button" variant="default" size="sm" onClick={onCreateBooking}>
              <AppIcon name="add" className="text-[15px]" />
              <span>Create Booking</span>
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onNavigateSection('bookings')}
          >
            <span>View Bookings</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onNavigateSection('conversations')}
          >
            <span>View Conversations</span>
          </Button>

          {customer.hasOpenAttention && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onNavigateSection('needs-attention')}
              className="border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
            >
              <AppIcon name="notification_important" className="text-[15px]" />
              <span>View Open Issues</span>
            </Button>
          )}
        </div>
      </div>

      {/* Scrollable Profile Body */}
      <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
        {/* Section: Customer Information / Edit Form */}
        <section className="bg-white rounded-xl border border-border p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-text-primary">Customer Information</h3>
            <span className="text-[11px] font-mono text-text-secondary capitalize">
              Source: {customer.source.replace('_', ' ')}
            </span>
          </div>

          {editing ? (
            <form onSubmit={handleSaveEdit} className="space-y-3">
              {saveError && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2">
                  <p className="font-semibold">{saveError}</p>
                  {conflictCustomer && onOpenExistingProfile && (
                    <button
                      type="button"
                      onClick={() => onOpenExistingProfile(conflictCustomer.id)}
                      className="px-2.5 py-1 rounded bg-white border border-amber-300 font-semibold text-primary hover:underline cursor-pointer"
                    >
                      Open existing profile ({conflictCustomer.name})
                    </button>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="edit-cust-name"
                    className="block text-xs font-semibold text-text-primary mb-1"
                  >
                    Full name
                  </label>
                  <input
                    id="edit-cust-name"
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-white outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label
                    htmlFor="edit-cust-phone"
                    className="block text-xs font-semibold text-text-primary mb-1"
                  >
                    Phone number (E.164)
                  </label>
                  <input
                    id="edit-cust-phone"
                    type="tel"
                    disabled={userRole !== 'owner'}
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border text-sm font-mono bg-white disabled:bg-surface-container-low disabled:text-text-secondary outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  {userRole !== 'owner' && (
                    <span className="text-[11px] text-text-secondary">
                      Only owners can modify primary phone identity.
                    </span>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="edit-cust-channel"
                    className="block text-xs font-semibold text-text-primary mb-1"
                  >
                    Preferred contact channel
                  </label>
                  <select
                    id="edit-cust-channel"
                    value={editChannel}
                    onChange={(e) =>
                      setEditChannel(e.target.value as 'whatsapp' | 'web_chat' | 'phone' | '')
                    }
                    className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-white outline-none"
                  >
                    <option value="">Not specified</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="web_chat">Web Chat</option>
                    <option value="phone">Phone Contact</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="edit-cust-lang"
                    className="block text-xs font-semibold text-text-primary mb-1"
                  >
                    Preferred language
                  </label>
                  <input
                    id="edit-cust-lang"
                    type="text"
                    placeholder="e.g. English, Yoruba, Pidgin"
                    value={editLanguage}
                    onChange={(e) => setEditLanguage(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-white outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="edit-cust-notes"
                  className="block text-xs font-semibold text-text-primary mb-1"
                >
                  Customer notes (workspace-scoped)
                </label>
                <textarea
                  id="edit-cust-notes"
                  rows={2}
                  placeholder="e.g. Prefers afternoon appointments."
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-white outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="default" size="sm" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-text-secondary block">Full name</span>
                <span className="font-semibold text-text-primary text-sm">{customer.name}</span>
              </div>
              <div>
                <span className="text-text-secondary block">Phone number</span>
                <span className="font-mono font-semibold text-text-primary text-sm">
                  {customer.phoneE164}
                </span>
              </div>
              <div>
                <span className="text-text-secondary block">Preferred channel</span>
                <span className="font-medium text-text-primary capitalize">
                  {customer.preferredChannel
                    ? customer.preferredChannel.replace('_', ' ')
                    : 'Not recorded'}
                </span>
              </div>
              <div>
                <span className="text-text-secondary block">Preferred language</span>
                <span className="font-medium text-text-primary">
                  {customer.preferredLanguage || 'Not recorded'}
                </span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-text-secondary block">Notes</span>
                <p className="text-text-primary mt-0.5">
                  {customer.notes || 'No notes recorded for this customer.'}
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Section: Upcoming Appointments & Pending Reservations */}
        <section className="bg-white rounded-xl border border-border p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-text-primary">Upcoming Appointments</h3>
            <span className="text-xs font-mono text-text-secondary">
              {upcomingConfirmed.length} confirmed
            </span>
          </div>

          {upcomingConfirmed.length === 0 ? (
            <div className="p-4 rounded-lg bg-surface-container-low border border-border/50 flex items-center justify-between gap-3">
              <p className="text-xs text-text-secondary">No upcoming appointments.</p>
              {onCreateBooking && (
                <Button type="button" variant="outline" size="sm" onClick={onCreateBooking}>
                  Create Booking
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2.5">
              {upcomingConfirmed.map((bk) => (
                <div
                  key={bk.id}
                  className="p-3.5 rounded-lg border border-border bg-surface-container-low/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-text-primary">
                        {bk.serviceName}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        Confirmed
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary">
                      {formatInTimezone(bk.startsAt, timezone, true)} • Staff: {bk.staffName}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onNavigateSection('bookings')}
                  >
                    View Booking
                  </Button>
                </div>
              ))}
            </div>
          )}

          {pendingReservations.length > 0 && (
            <div className="pt-2 border-t border-border/60 space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800">
                Pending Reservations (Temporary Holds)
              </h4>
              {pendingReservations.map((bk) => (
                <div
                  key={bk.id}
                  className="p-3 rounded-lg border border-amber-200 bg-amber-50/70 flex items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <p className="font-semibold text-text-primary">{bk.serviceName}</p>
                    <p className="text-text-secondary">
                      {formatInTimezone(bk.startsAt, timezone, true)} • Awaiting Deposit
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onNavigateSection('bookings')}
                  >
                    View Hold
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Section: Payment Summary */}
        <section className="bg-white rounded-xl border border-border p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-text-primary">Payment Summary</h3>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onNavigateSection('payments')}
            >
              View Payment History
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-surface-container-low">
              <span className="text-[11px] text-text-secondary block">Verified Deposits</span>
              <span className="text-base font-mono font-bold text-success-strong">
                {formatNairaFromKobo(customer.verifiedDepositKobo)}
              </span>
            </div>
            <div className="p-3 rounded-lg bg-surface-container-low">
              <span className="text-[11px] text-text-secondary block">Pending Verification</span>
              <span className="text-base font-mono font-bold text-amber-700">
                {formatNairaFromKobo(customer.pendingVerificationKobo)}
              </span>
            </div>
            <div className="p-3 rounded-lg bg-surface-container-low col-span-2 sm:col-span-1">
              <span className="text-[11px] text-text-secondary block">Latest Payment</span>
              <span className="text-xs font-semibold text-text-primary">
                {customer.latestPaymentAt
                  ? formatInTimezone(customer.latestPaymentAt, timezone)
                  : 'None yet'}
              </span>
              {customer.refundStatus && (
                <span className="block text-[10px] font-mono text-text-secondary capitalize mt-0.5">
                  Refund: {customer.refundStatus.replace('_', ' ')}
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Section: Booking History */}
        <section className="bg-white rounded-xl border border-border p-4 sm:p-5 space-y-3">
          <div>
            <h3 className="text-sm font-bold text-text-primary">Booking History</h3>
            <p className="text-xs text-text-secondary">
              View appointments this customer has booked with your business.
            </p>
          </div>

          {customer.bookings.length === 0 ? (
            <p className="text-xs text-text-secondary py-2">No appointments recorded yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {customer.bookings.map((bk) => {
                const badge = getBookingStatusBadge(bk.status);
                return (
                  <div
                    key={bk.id}
                    className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-text-primary">
                          {bk.serviceName}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badge.cls}`}
                        >
                          {badge.label}
                        </span>
                      </div>
                      <p className="text-xs text-text-secondary">
                        {formatInTimezone(bk.startsAt, timezone, true)} • {bk.staffName} •{' '}
                        {bk.depositKobo > 0
                          ? `${formatNairaFromKobo(bk.depositKobo)} (${getPaymentStatusLabel(bk.paymentStatus)})`
                          : getPaymentStatusLabel(bk.paymentStatus)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => onNavigateSection('bookings')}
                        className="text-xs font-semibold text-primary hover:underline cursor-pointer"
                      >
                        View Booking
                      </button>
                      {customer.conversations.length > 0 && (
                        <button
                          type="button"
                          onClick={() => onNavigateSection('conversations')}
                          className="text-xs font-semibold text-text-secondary hover:text-text-primary cursor-pointer"
                        >
                          Related Chat
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Section: Conversation History */}
        <section className="bg-white rounded-xl border border-border p-4 sm:p-5 space-y-3">
          <div>
            <h3 className="text-sm font-bold text-text-primary">Conversations</h3>
            <p className="text-xs text-text-secondary">
              See this customer&apos;s previous interactions with your AI receptionist and team.
            </p>
          </div>

          {customer.conversations.length === 0 ? (
            <p className="text-xs text-text-secondary py-2">
              No conversations available for this customer.
            </p>
          ) : (
            <div className="space-y-2.5">
              {customer.conversations.map((cv) => (
                <div
                  key={cv.id}
                  className="p-3 rounded-lg border border-border bg-surface-container-low/40 flex items-start justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-text-primary">
                        {cv.channel === 'whatsapp' ? 'WhatsApp' : 'Web Chat'} —{' '}
                        {formatInTimezone(cv.lastMessageAt ?? cv.createdAt, timezone)}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          cv.status === 'needs_human'
                            ? 'bg-amber-100 text-amber-800'
                            : cv.status === 'closed'
                              ? 'bg-emerald-50 text-emerald-800'
                              : 'bg-indigo-50 text-primary'
                        }`}
                      >
                        {cv.status === 'needs_human'
                          ? 'Needs Human'
                          : cv.status === 'closed'
                            ? 'Resolved'
                            : 'AI Handling'}
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary line-clamp-2">
                      {cv.lastMessagePreview || 'Conversation opened.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigateSection('conversations')}
                    className="text-xs font-semibold text-primary hover:underline shrink-0 cursor-pointer"
                  >
                    View Conversation
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Section: Recent Customer Activity Timeline */}
        <section className="bg-white rounded-xl border border-border p-4 sm:p-5 space-y-3">
          <h3 className="text-sm font-bold text-text-primary">Recent Customer Activity</h3>
          <div className="space-y-3">
            {customer.activities.map((ev) => (
              <div key={ev.id} className="flex items-start gap-2.5 text-xs">
                <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                <div className="min-w-0">
                  <p className="font-semibold text-text-primary">
                    {formatInTimezone(ev.timestamp, timezone, true)} — {ev.label}
                  </p>
                  <p className="text-text-secondary">{ev.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
