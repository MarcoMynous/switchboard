'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AppIcon } from '@/components/AppIcon';
import { Button } from '@/components/ui/button';
import type {
  IssueCategory,
  IssuePriority,
  IssueStatus,
  NeedsAttentionIssue,
} from '@/lib/needs-attention-server';

interface IssueDetailsDrawerProps {
  issue: NeedsAttentionIssue;
  timezone: string;
  userRole: 'owner' | 'staff';
  currentUserId: string;
  staffMembers: Array<{ id: string; name: string; role: string }>;
  submitting: boolean;
  actionError: string | null;
  onClose: () => void;
  onAssign: (assignedUserId: string, assignedUserName: string) => Promise<void>;
  onTransition: (
    status: IssueStatus,
    resolutionNote?: string,
    resolutionCategory?: string,
  ) => Promise<void>;
  onRefreshPaymentStatus: () => Promise<void>;
  onOpenConversation: () => void;
  onViewBooking: () => void;
  onReviewRefund: () => void;
  onOpenIntegrations: () => void;
}

function formatNairaFromKobo(kobo: number): string {
  return `₦${Math.round(kobo / 100).toLocaleString('en-NG')}`;
}

function formatDateTime(iso: string | null, timezone: string): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('en-NG', {
      timeZone: timezone || 'Africa/Lagos',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function getCategoryLabel(category: IssueCategory): string {
  switch (category) {
    case 'human_assistance':
      return 'Human Assistance';
    case 'booking':
      return 'Booking';
    case 'payment':
      return 'Payment';
    case 'notification':
      return 'Notification';
    case 'integration':
      return 'Integration';
  }
}

export function getPriorityMeta(priority: IssuePriority): {
  label: string;
  badgeClass: string;
} {
  switch (priority) {
    case 'high':
      return {
        label: 'High Priority',
        badgeClass: 'bg-rose-50 text-rose-800 border border-rose-200',
      };
    case 'normal':
      return {
        label: 'Normal',
        badgeClass: 'bg-amber-50 text-amber-800 border border-amber-200',
      };
    case 'low':
      return {
        label: 'Low',
        badgeClass: 'bg-slate-100 text-slate-700 border border-slate-200',
      };
  }
}

export function getStatusMeta(status: IssueStatus): {
  label: string;
  badgeClass: string;
} {
  switch (status) {
    case 'open':
      return {
        label: 'Open',
        badgeClass: 'bg-amber-100 text-amber-900 border border-amber-300',
      };
    case 'in_progress':
      return {
        label: 'In Progress',
        badgeClass: 'bg-indigo-100 text-indigo-800 border border-indigo-200',
      };
    case 'waiting':
      return {
        label: 'Waiting',
        badgeClass: 'bg-slate-100 text-slate-700 border border-slate-300',
      };
    case 'resolved':
      return {
        label: 'Resolved',
        badgeClass: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
      };
    case 'closed':
      return {
        label: 'Closed',
        badgeClass: 'bg-slate-100 text-slate-600 border border-slate-200',
      };
  }
}

function getPaymentStatusLabel(status: string): string {
  switch (status) {
    case 'succeeded':
      return 'Verified by Kora';
    case 'pending_verification':
      return 'Pending Verification';
    case 'refund_pending':
      return 'Refund Pending';
    case 'refund_failed':
      return 'Refund Failed';
    case 'refunded':
      return 'Refunded';
    default:
      return 'Awaiting Verification';
  }
}

export function IssueDetailsDrawer({
  issue,
  timezone,
  userRole,
  currentUserId,
  staffMembers,
  submitting,
  actionError,
  onClose,
  onAssign,
  onTransition,
  onRefreshPaymentStatus,
  onOpenConversation,
  onViewBooking,
  onReviewRefund,
  onOpenIntegrations,
}: IssueDetailsDrawerProps) {
  const [resolutionNote, setResolutionNote] = useState(issue.resolutionNote ?? '');
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const priorityMeta = getPriorityMeta(issue.priority);
  const statusMeta = getStatusMeta(issue.status);
  const isResolvedOrClosed = issue.status === 'resolved' || issue.status === 'closed';
  const canResolveFinancial =
    issue.category !== 'payment' || Boolean(issue.payment?.isFinanciallySettled);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-label={issue.title}
    >
      <div className="w-full lg:max-w-[560px] h-full bg-surface-container-lowest border-l border-border/70 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border/60 bg-white flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className="text-[11px] font-mono font-semibold text-text-secondary bg-surface-container-low px-2 py-0.5 rounded border border-border/50">
                {issue.reference}
              </span>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${priorityMeta.badgeClass}`}
              >
                {priorityMeta.label}
              </span>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${statusMeta.badgeClass}`}
              >
                {statusMeta.label}
              </span>
            </div>
            <h2 className="font-headline-sm text-lg font-bold text-text-primary leading-snug">
              {issue.title}
            </h2>
            <p className="text-xs text-text-secondary mt-1">
              {getCategoryLabel(issue.category)} • Handler:{' '}
              <span className="font-medium text-text-primary">
                {issue.assignedUserName || 'Unassigned'}
              </span>
            </p>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="Close issue details"
            className="h-8 w-8 p-0 shrink-0"
          >
            <AppIcon name="close" className="text-[20px]" />
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {actionError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800 flex items-start gap-2">
              <AppIcon name="error_outline" className="text-[16px] shrink-0 mt-0.5" />
              <span>{actionError}</span>
            </div>
          )}

          {/* Section A: What Happened */}
          <section className="rounded-xl border border-border/60 bg-white p-4 space-y-1.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
              What Happened
            </h3>
            <p className="text-sm text-text-primary leading-relaxed">{issue.whatHappened}</p>
          </section>

          {/* Section E: Recommended Next Action */}
          <section className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-1.5">
            <div className="flex items-center gap-1.5 text-primary">
              <AppIcon name="lightbulb" className="text-[16px]" />
              <h3 className="text-xs font-semibold uppercase tracking-wider">
                Recommended Next Action
              </h3>
            </div>
            <p className="text-sm text-text-primary leading-relaxed">{issue.recommendedAction}</p>
          </section>

          {/* Section B: Customer Information */}
          {issue.customer && (
            <section className="rounded-xl border border-border/60 bg-white p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  Customer Information
                </h3>
                <Link
                  href={`/dashboard/customers/${issue.customer.id}`}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Open Profile
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-xs text-text-secondary block">Name</span>
                  <span className="font-semibold text-text-primary">{issue.customer.name}</span>
                </div>
                <div>
                  <span className="text-xs text-text-secondary block">Phone</span>
                  <span className="font-medium text-text-primary">{issue.customer.phone}</span>
                </div>
              </div>
              {issue.conversation && (
                <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-2">
                  <span className="text-xs text-text-secondary">
                    Channel:{' '}
                    <span className="font-medium text-text-primary">
                      {issue.conversation.channel === 'whatsapp' ? 'WhatsApp' : 'Web Chat'}
                    </span>
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onOpenConversation}
                    className="h-7 text-xs"
                  >
                    <AppIcon name="chat" className="text-[14px]" />
                    <span>Open Conversation</span>
                  </Button>
                </div>
              )}
            </section>
          )}

          {/* Section C: Booking Information */}
          {issue.booking && (
            <section className="rounded-xl border border-border/60 bg-white p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  Booking Information
                </h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onViewBooking}
                  className="h-7 text-xs"
                >
                  <AppIcon name="calendar_month" className="text-[14px]" />
                  <span>View Booking</span>
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-xs text-text-secondary block">Service</span>
                  <span className="font-semibold text-text-primary">
                    {issue.booking.serviceName}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-text-secondary block">Staff Member</span>
                  <span className="font-medium text-text-primary">{issue.booking.staffName}</span>
                </div>
                <div>
                  <span className="text-xs text-text-secondary block">Appointment Time</span>
                  <span className="font-medium text-text-primary">
                    {formatDateTime(issue.booking.startsAt, timezone)}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-text-secondary block">Booking Status</span>
                  <span className="font-semibold capitalize text-text-primary">
                    {issue.booking.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
            </section>
          )}

          {/* Section D: Payment Information */}
          {issue.payment && (
            <section className="rounded-xl border border-border/60 bg-white p-4 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  Payment Information
                </h3>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={submitting}
                    onClick={() => void onRefreshPaymentStatus()}
                    className="h-7 text-xs"
                  >
                    <AppIcon name="refresh" className="text-[14px]" />
                    <span>Check Payment Status</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onReviewRefund}
                    className="h-7 text-xs"
                  >
                    <span>Review Refund</span>
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-xs text-text-secondary block">Expected Deposit</span>
                  <span className="font-semibold text-text-primary">
                    {formatNairaFromKobo(issue.payment.expectedKobo)}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-text-secondary block">Verified Amount</span>
                  <span className="font-semibold text-text-primary">
                    {issue.payment.verifiedKobo !== null
                      ? formatNairaFromKobo(issue.payment.verifiedKobo)
                      : 'Not yet verified'}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-text-secondary block">Payment Status</span>
                  <span className="font-medium text-text-primary">
                    {getPaymentStatusLabel(issue.payment.status)}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-text-secondary block">Verification Time</span>
                  <span className="font-medium text-text-primary">
                    {formatDateTime(issue.payment.verifiedAt, timezone)}
                  </span>
                </div>
              </div>
              {issue.payment.status === 'pending_verification' && (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Payment verification is taking longer than expected. Wait for reconciliation
                  before confirming or cancelling.
                </p>
              )}
            </section>
          )}

          {/* Integration shortcut if integration issue */}
          {issue.category === 'integration' && (
            <section className="rounded-xl border border-border/60 bg-white p-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  Integration Settings
                </h3>
                <p className="text-xs text-text-secondary mt-0.5">
                  Connect and verify your WhatsApp Business channel.
                </p>
              </div>
              <Button type="button" size="sm" onClick={onOpenIntegrations} className="h-8 text-xs">
                Open Integrations
              </Button>
            </section>
          )}

          {/* Assignment & Resolution Controls */}
          <section className="rounded-xl border border-border/60 bg-white p-4 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
              Ownership &amp; Resolution
            </h3>

            <div className="flex items-center gap-2 flex-wrap">
              {issue.assignedUserId !== currentUserId && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={submitting}
                  onClick={() => void onAssign(currentUserId, '')}
                  className="h-8 text-xs"
                >
                  <AppIcon name="person_add" className="text-[14px]" />
                  <span>Assign to Me</span>
                </Button>
              )}

              {userRole === 'owner' && staffMembers.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <select
                    aria-label="Assign to staff member"
                    value={selectedStaffId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedStaffId(id);
                      const found = staffMembers.find((s) => s.id === id);
                      if (found) {
                        void onAssign(found.id, found.name);
                      }
                    }}
                    className="h-8 rounded-md border border-border bg-white px-2 text-xs text-text-primary"
                  >
                    <option value="">Assign to Staff...</option>
                    {staffMembers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.role})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {!isResolvedOrClosed && issue.status !== 'in_progress' && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={submitting}
                  onClick={() => void onTransition('in_progress')}
                  className="h-8 text-xs"
                >
                  <span>Mark In Progress</span>
                </Button>
              )}

              {!isResolvedOrClosed && issue.status !== 'waiting' && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={submitting}
                  onClick={() => void onTransition('waiting')}
                  className="h-8 text-xs"
                >
                  <span>Mark Waiting</span>
                </Button>
              )}
            </div>

            {!isResolvedOrClosed ? (
              <div className="space-y-2 pt-2 border-t border-border/40">
                <label
                  htmlFor="issue-resolution-note"
                  className="text-xs font-medium text-text-primary block"
                >
                  Resolution note{' '}
                  {canResolveFinancial ? '(optional)' : '(required for administrative closure)'}
                </label>
                <textarea
                  id="issue-resolution-note"
                  rows={2}
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  placeholder="Record what was checked or resolved..."
                  className="w-full rounded-lg border border-border bg-white px-3 py-2 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    type="button"
                    size="sm"
                    disabled={submitting || !canResolveFinancial}
                    onClick={() =>
                      void onTransition('resolved', resolutionNote.trim() || undefined, 'resolved')
                    }
                    className="h-8 text-xs"
                  >
                    <AppIcon name="check_circle" className="text-[14px]" />
                    <span>Mark Resolved</span>
                  </Button>

                  {!canResolveFinancial && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={submitting || resolutionNote.trim().length < 3}
                      onClick={() =>
                        void onTransition('closed', resolutionNote.trim(), 'administrative_closure')
                      }
                      className="h-8 text-xs"
                    >
                      <span>Administrative Closure</span>
                    </Button>
                  )}
                </div>
                {!canResolveFinancial && (
                  <p className="text-[11px] text-text-secondary">
                    Financial issues remain open until Kora verifies settlement or refund, unless
                    administratively closed with a recorded reason.
                  </p>
                )}
              </div>
            ) : (
              <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-2">
                <div className="text-xs text-text-secondary">
                  {issue.resolvedBy ? `Completed by ${issue.resolvedBy}` : 'Completed'}{' '}
                  {issue.resolvedAt ? `on ${formatDateTime(issue.resolvedAt, timezone)}` : ''}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={submitting}
                  onClick={() => void onTransition('open', 'Reopened for review')}
                  className="h-8 text-xs"
                >
                  <span>Reopen</span>
                </Button>
              </div>
            )}
          </section>

          {/* Section F: Issue History */}
          <section className="rounded-xl border border-border/60 bg-white p-4 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
              Issue History
            </h3>
            <ol className="space-y-2.5">
              {issue.history.map((ev) => (
                <li key={ev.id} className="flex items-start gap-2.5 text-xs">
                  <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-text-primary">{ev.label}</span>
                      <span className="text-[11px] text-text-secondary shrink-0">
                        {formatDateTime(ev.timestamp, timezone)}
                      </span>
                    </div>
                    <p className="text-text-secondary mt-0.5">{ev.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
