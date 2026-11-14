'use client';

import Link from 'next/link';
import { AppIcon } from '@/components/AppIcon';
import { HoldBand } from '@/components/HoldBand';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  formatNairaFromKobo,
  getFormattedDate,
  getGreeting,
  useDashboard,
} from '../DashboardContext';

export function OverviewView() {
  const {
    setActiveNav,
    workspace,
    apiState,
    bookings,
    conversations,
    copiedSlug,
    copyBookingLink,
    setChatDrawerOpen,
    setGuideModal,
    setSelectedBookingForDetails,
    setNewBookingModalOpen,
    showDepositTooltip,
    setShowDepositTooltip,
    checklistExpanded,
    setChecklistExpanded,
    devSandboxOpen,
    setDevSandboxOpen,
    checklist,
    metrics,
    needsAttentionItems,
    recentActivities,
    handleCreateSimulatedBooking,
    handleVerifyKoraDeposit,
    handleFlagPaymentPendingVerification,
    handleTriggerHumanEscalation,
    handleExpireHold,
  } = useDashboard();

  return (
    <div className="flex flex-col w-full space-y-8">
      {/* -------------------------------------------------------------
                    SECTION ONE: WELCOME HEADER & CHANNEL STATUS
                ------------------------------------------------------------- */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-2 border-b border-border/50">
        <div className="flex flex-col gap-2 max-w-2xl">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-metric-sm text-metric-sm text-text-secondary font-medium">
              {getFormattedDate(workspace.timezone)} • {workspace.timezone.split(' ')[0]} (WAT)
            </span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-text-primary tracking-tight font-semibold">
            {getGreeting(
              workspace.timezone,
              apiState.ownerName ? apiState.ownerName.split(' ')[0] : undefined,
            )}
          </h1>
          <p className="font-body-md text-body-md text-text-secondary">
            Here&apos;s what&apos;s happening at {workspace.businessName} today.
          </p>

          {/* Customer-Facing Channel Status Indicators */}
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/60 font-metric-sm text-metric-sm font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Web booking active
            </span>

            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/60 font-metric-sm text-metric-sm font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Web chat active
            </span>

            {apiState.whatsappConnected ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/60 font-metric-sm text-metric-sm font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                WhatsApp connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200/60 font-metric-sm text-metric-sm font-medium">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                WhatsApp setup required
              </span>
            )}

            {apiState.agentEnabled ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-900 border border-indigo-200/60 font-metric-sm text-metric-sm font-medium">
                <span className="w-2 h-2 rounded-full bg-indigo-500" />
                {workspace.assistantName || 'AI receptionist'} active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-metric-sm text-metric-sm font-medium">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                AI receptionist paused
              </span>
            )}
          </div>
        </div>

        {/* Quick Actions (4 Clean Business Actions) */}
        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          <Link
            href={`/b/${workspace.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="h-9 px-3.5 rounded-lg bg-primary hover:bg-primary/90 text-on-primary font-label-md text-label-md font-medium flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <AppIcon name="open_in_new" className="text-[16px]" />
            <span>View Booking Page</span>
          </Link>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={copyBookingLink}
            className="h-9 font-label-md text-label-md"
          >
            <AppIcon
              name={copiedSlug ? 'check' : 'content_copy'}
              className="text-[16px] text-primary"
            />
            <span>{copiedSlug ? 'Link Copied!' : 'Copy Booking Link'}</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setChatDrawerOpen(true)}
            className="h-9 font-label-md text-label-md"
          >
            <AppIcon name="smart_toy" className="text-[16px] text-primary" />
            <span>Test AI Receptionist</span>
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setNewBookingModalOpen(true)}
            className="h-9 font-label-md text-label-md"
          >
            <AppIcon name="add" className="text-[16px]" />
            <span>New Booking</span>
          </Button>
        </div>
      </div>

      {/* -------------------------------------------------------------
                    SECTION TWO: KEY BUSINESS METRICS (4 SUMMARY CARDS)
                ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1 — Confirmed Bookings */}
        <button
          type="button"
          onClick={() => setActiveNav('bookings')}
          className="bg-surface rounded-xl p-5 shadow-xs border border-border/70 hover:border-primary/40 hover:shadow-sm transition-all text-left cursor-pointer flex flex-col justify-between group"
        >
          <div>
            <div className="flex items-center justify-between text-text-secondary mb-1">
              <span className="font-label-md text-label-md font-semibold text-text-primary">
                Confirmed Bookings
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-success-strong">
                <AppIcon name="event_available" className="text-[18px]" />
              </div>
            </div>
            <p className="font-body-sm text-[12px] text-text-secondary leading-tight">
              Appointments successfully secured for today.
            </p>
          </div>
          <div className="mt-4">
            <div className="font-metric-lg text-3xl text-text-primary font-bold">
              {metrics.confirmedCount}
            </div>
            <div className="font-body-sm text-[12px] text-text-secondary mt-1">
              {metrics.heldCount > 0 ? (
                <span className="text-amber-600 font-medium">
                  +{metrics.heldCount} awaiting deposit
                </span>
              ) : (
                <span>All appointments secured</span>
              )}
            </div>
          </div>
        </button>

        {/* Card 2 — Verified Deposits */}
        <div className="bg-surface rounded-xl p-5 shadow-xs border border-border/70 flex flex-col justify-between relative group">
          <div>
            <div className="flex items-center justify-between text-text-secondary mb-1">
              <div className="flex items-center gap-1.5">
                <span className="font-label-md text-label-md font-semibold text-text-primary">
                  Deposits Collected
                </span>
                <div className="relative inline-block">
                  <button
                    type="button"
                    onClick={() => setShowDepositTooltip((prev) => !prev)}
                    onMouseEnter={() => setShowDepositTooltip(true)}
                    onMouseLeave={() => setShowDepositTooltip(false)}
                    className="text-text-secondary hover:text-text-primary p-0.5 cursor-pointer"
                    aria-label="What does this deposit amount represent?"
                  >
                    <AppIcon name="info" className="text-[15px]" />
                  </button>
                  {showDepositTooltip && (
                    <div className="absolute left-1/2 -translate-x-1/2 top-6 w-64 p-3 bg-slate-900 text-white text-[11px] rounded-lg shadow-xl z-30 leading-relaxed font-normal">
                      Verified gross deposits received directly through Kora payment gateway.
                      Excludes unverified holds and pending transfers.
                    </div>
                  )}
                </div>
              </div>
              <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-primary">
                <AppIcon name="payments" className="text-[18px]" />
              </div>
            </div>
            <p className="font-body-sm text-[12px] text-text-secondary leading-tight">
              Payments received and verified through Kora.
            </p>
          </div>
          <div className="mt-4">
            <div className="font-metric-lg text-3xl text-success-strong font-bold">
              {formatNairaFromKobo(metrics.verifiedDepositKobo)}
            </div>
            <div className="font-body-sm text-[12px] text-text-secondary mt-1">
              <button
                type="button"
                onClick={() => setActiveNav('payments')}
                className="text-primary hover:underline font-medium cursor-pointer"
              >
                View payment history →
              </button>
            </div>
          </div>
        </div>

        {/* Card 3 — Awaiting Payment */}
        <button
          type="button"
          onClick={() => setActiveNav('bookings')}
          className="bg-surface rounded-xl p-5 shadow-xs border border-border/70 hover:border-amber-400 hover:shadow-sm transition-all text-left cursor-pointer flex flex-col justify-between group"
        >
          <div>
            <div className="flex items-center justify-between text-text-secondary mb-1">
              <span className="font-label-md text-label-md font-semibold text-text-primary">
                Awaiting Payment
              </span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
                <AppIcon name="schedule" className="text-[18px]" />
              </div>
            </div>
            <p className="font-body-sm text-[12px] text-text-secondary leading-tight">
              Customers with temporarily reserved appointments.
            </p>
          </div>
          <div className="mt-4">
            <div className="font-metric-lg text-3xl text-amber-600 font-bold">
              {metrics.heldCount}
            </div>
            <div className="font-body-sm text-[12px] text-text-secondary mt-1">
              {metrics.heldCount === 1
                ? '1 appointment waiting for deposit'
                : `${metrics.heldCount} appointments waiting for deposits`}
            </div>
          </div>
        </button>

        {/* Card 4 — Needs Attention */}
        <button
          type="button"
          onClick={() => setActiveNav('needs-attention')}
          className={`bg-surface rounded-xl p-5 shadow-xs border transition-all text-left cursor-pointer flex flex-col justify-between group ${
            metrics.needsAttentionCount > 0
              ? 'border-amber-400/80 hover:border-amber-500 bg-amber-50/10'
              : 'border-border/70 hover:border-success/50'
          }`}
        >
          <div>
            <div className="flex items-center justify-between text-text-secondary mb-1">
              <span className="font-label-md text-label-md font-semibold text-text-primary">
                Needs Attention
              </span>
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  metrics.needsAttentionCount > 0
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-emerald-50 text-success-strong'
                }`}
              >
                <AppIcon
                  name={metrics.needsAttentionCount > 0 ? 'notification_important' : 'check_circle'}
                  className="text-[18px]"
                />
              </div>
            </div>
            <p className="font-body-sm text-[12px] text-text-secondary leading-tight">
              Customer requests or payment issues requiring your help.
            </p>
          </div>
          <div className="mt-4">
            <div
              className={`font-metric-lg text-3xl font-bold ${
                metrics.needsAttentionCount > 0 ? 'text-amber-700' : 'text-text-primary'
              }`}
            >
              {metrics.needsAttentionCount}
            </div>
            <div className="font-body-sm text-[12px] text-text-secondary mt-1">
              {metrics.needsAttentionCount > 0 ? (
                <span className="text-amber-700 font-medium">Action needed from your team</span>
              ) : (
                <span className="text-success-strong font-medium">
                  All caught up • No issues pending
                </span>
              )}
            </div>
          </div>
        </button>
      </div>

      {/* -------------------------------------------------------------
                    SECTION THREE: TODAY'S APPOINTMENTS & SLOT HOLDS
                ------------------------------------------------------------- */}
      <div className="bg-surface rounded-xl border border-border/70 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-headline-sm text-headline-sm text-text-primary font-semibold">
              Today&apos;s Appointments
            </h2>
            <p className="font-body-sm text-body-sm text-text-secondary mt-0.5">
              See your upcoming bookings and appointments awaiting payment.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveNav('bookings')}
            className="text-xs font-semibold text-primary hover:underline cursor-pointer self-start sm:self-auto"
          >
            View All Bookings →
          </button>
        </div>

        {bookings.length === 0 ? (
          <div className="p-10 text-center flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-full bg-surface-container-low flex items-center justify-center text-text-secondary">
              <AppIcon name="calendar_month" className="text-[24px]" />
            </div>
            <h3 className="font-headline-sm text-base text-text-primary font-medium">
              No appointments scheduled for today yet
            </h3>
            <p className="font-body-sm text-sm text-text-secondary max-w-md">
              Share your booking link on WhatsApp or Instagram, or create a walk-in appointment.
            </p>
            <div className="flex items-center gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={copyBookingLink}>
                <AppIcon name="content_copy" className="text-[14px]" />
                <span>Copy Booking Link</span>
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setNewBookingModalOpen(true)}
              >
                <AppIcon name="add" className="text-[14px]" />
                <span>New Booking</span>
              </Button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {bookings.map((bk) => (
              <div
                key={bk.id}
                className="p-4 sm:px-6 hover:bg-surface-container-lowest/60 transition-colors"
              >
                {/* Active Hold Draining Band */}
                {bk.status === 'held' && (
                  <div className="mb-3">
                    <HoldBand
                      status="held"
                      remainingSeconds={bk.holdSecondsRemaining ?? 900}
                      totalSeconds={900}
                      compact
                      theme="light"
                      autoTick
                    />
                  </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-label-md text-label-md font-semibold text-text-primary">
                        {bk.customerName}
                      </span>
                      <span className="font-metric-sm text-metric-sm text-text-secondary">
                        {apiState.role === 'staff'
                          ? `•••• ${bk.customerPhone.slice(-4)}`
                          : bk.customerPhone}
                      </span>

                      {/* Booking Status Badge */}
                      {bk.status === 'confirmed' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                          <AppIcon name="verified" className="text-[13px]" />
                          Confirmed
                        </span>
                      )}
                      {bk.status === 'held' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                          <AppIcon name="schedule" className="text-[13px]" />
                          Awaiting Deposit
                        </span>
                      )}
                      {bk.paymentStatus === 'pending_verification' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800">
                          <AppIcon name="hourglass_empty" className="text-[13px]" />
                          Payment Being Verified
                        </span>
                      )}
                      {bk.status === 'expired' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                          <AppIcon name="history" className="text-[13px]" />
                          Expired
                        </span>
                      )}
                      {bk.status === 'cancelled' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                          <AppIcon name="cancel" className="text-[13px]" />
                          Cancelled
                        </span>
                      )}
                    </div>

                    <p className="font-body-sm text-body-sm text-text-secondary">
                      {bk.serviceName} with <strong>{bk.staffName}</strong> • {bk.slotTime}
                    </p>

                    <div className="flex items-center gap-3 text-xs text-text-secondary pt-0.5">
                      <span>
                        Deposit: <strong>{formatNairaFromKobo(bk.depositKobo)}</strong>
                      </span>
                      <span>•</span>
                      <span className="font-mono text-[11px] text-text-secondary">
                        Ref: {bk.reference}
                      </span>
                      <span>•</span>
                      <span>
                        {bk.paymentStatus === 'verified' && (
                          <span className="text-emerald-700 font-medium">Verified via Kora</span>
                        )}
                        {bk.paymentStatus === 'pending_verification' && (
                          <span className="text-indigo-700 font-medium">Re-checking with Kora</span>
                        )}
                        {bk.paymentStatus === 'awaiting_payment' && (
                          <span className="text-amber-700 font-medium">Awaiting deposit</span>
                        )}
                        {bk.paymentStatus === 'not_required' && <span>No deposit required</span>}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setSelectedBookingForDetails(bk)}
                      className="px-3 py-1.5 rounded-lg border border-border bg-surface hover:bg-surface-container-low text-xs font-medium text-text-primary transition-colors cursor-pointer"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* -------------------------------------------------------------
                    SECTION FOUR & FIVE: OPERATIONAL PANELS (TWO COLUMNS)
                ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Needs Attention (Section 5) */}
        <div className="bg-surface rounded-xl border border-border/70 shadow-xs p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-border/50 mb-4">
              <div>
                <h3 className="font-headline-sm text-headline-sm text-text-primary font-semibold">
                  Needs Attention
                </h3>
                <p className="font-body-sm text-body-sm text-text-secondary mt-0.5">
                  These requests need someone from your team.
                </p>
              </div>
              <span
                className={`font-metric-sm text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                  needsAttentionItems.length > 0
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {needsAttentionItems.length} {needsAttentionItems.length === 1 ? 'item' : 'items'}
              </span>
            </div>

            {needsAttentionItems.length === 0 ? (
              <div className="py-8 text-center flex flex-col items-center justify-center gap-2">
                <div className="w-10 h-10 rounded-full bg-emerald-50 text-success-strong flex items-center justify-center">
                  <AppIcon name="check_circle" className="text-[22px]" />
                </div>
                <h4 className="font-label-md text-sm font-semibold text-text-primary">
                  All caught up!
                </h4>
                <p className="font-body-sm text-xs text-text-secondary max-w-sm">
                  There are no customer requests or payment issues needing your attention right now.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {needsAttentionItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-xl border border-border/70 bg-surface-container-lowest flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-label-md text-xs font-bold text-text-primary">
                          {item.customerName}
                        </span>
                        <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                          {item.typeLabel}
                        </span>
                      </div>
                      <p className="font-body-sm text-xs text-text-secondary leading-snug">
                        {item.description}
                      </p>
                      <span className="text-[11px] text-text-secondary block">{item.time}</span>
                    </div>

                    <button
                      type="button"
                      onClick={item.onAction}
                      className="h-8 px-3 rounded-lg bg-primary text-on-primary font-label-sm text-xs font-medium hover:bg-primary/90 transition-colors shrink-0 self-start sm:self-auto cursor-pointer"
                    >
                      Review Request
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-border/40 mt-4 flex items-center justify-between text-xs text-text-secondary">
            <span>Operational issues & customer escalations</span>
            <button
              type="button"
              onClick={() => setActiveNav('needs-attention')}
              className="text-primary hover:underline font-medium cursor-pointer"
            >
              View attention inbox →
            </button>
          </div>
        </div>

        {/* Right Column: Your AI Receptionist (Section 4) */}
        <div className="bg-surface rounded-xl border border-border/70 shadow-xs p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-border/50 mb-4">
              <div>
                <h3 className="font-headline-sm text-headline-sm text-text-primary font-semibold">
                  Your AI Receptionist
                </h3>
                <p className="font-body-sm text-body-sm text-text-secondary mt-0.5">
                  See how your assistant is handling customer inquiries and bookings.
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {apiState.agentEnabled ? 'Active' : 'Paused'}
              </span>
            </div>

            {/* Assistant Persona & Channel Status */}
            <div className="p-4 rounded-xl bg-surface-container-lowest border border-border/60 mb-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-on-primary font-bold text-sm shrink-0">
                  {(workspace.assistantName || 'Maya').slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <h4 className="font-label-md text-sm font-bold text-text-primary">
                    {workspace.assistantName || 'Maya'}
                  </h4>
                  <p className="font-body-sm text-xs text-text-secondary">
                    Tone: {workspace.tone || 'Friendly & concise'} • 15-minute slot reservation
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/40 text-xs">
                <div>
                  <span className="text-text-secondary block">Web Chat Status</span>
                  <span className="font-medium text-emerald-700 flex items-center gap-1 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Active on booking page
                  </span>
                </div>
                <div>
                  <span className="text-text-secondary block">WhatsApp Status</span>
                  <span
                    className={`font-medium flex items-center gap-1 mt-0.5 ${
                      apiState.whatsappConnected ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        apiState.whatsappConnected ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                    />
                    {apiState.whatsappConnected ? 'Connected' : 'Setup Required'}
                  </span>
                </div>
              </div>
            </div>

            {/* Operational Metrics */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 rounded-lg bg-surface-container-low border border-border/40">
                <span className="text-[11px] text-text-secondary block uppercase tracking-wide">
                  Conversations Handled
                </span>
                <span className="font-metric-md text-xl font-bold text-text-primary mt-1 block">
                  {metrics.conversationsCount}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-surface-container-low border border-border/40">
                <span className="text-[11px] text-text-secondary block uppercase tracking-wide">
                  Escalated to Staff
                </span>
                <span className="font-metric-md text-xl font-bold text-amber-700 mt-1 block">
                  {conversations.filter((c) => c.status === 'needs_human').length}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-border/40 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setChatDrawerOpen(true)}
                className="h-8 text-xs"
              >
                <AppIcon name="chat" className="text-[14px]" />
                <span>Test Chat</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setActiveNav('conversations')}
                className="h-8 text-xs"
              >
                <span>View Conversations</span>
              </Button>
            </div>

            <button
              type="button"
              onClick={() => setActiveNav('ai-receptionist')}
              className="text-xs font-medium text-primary hover:underline cursor-pointer"
            >
              Manage Receptionist →
            </button>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------
                    SECTION SIX: RECENT ACTIVITY TIMELINE
                ------------------------------------------------------------- */}
      <div className="bg-surface rounded-xl border border-border/70 shadow-xs p-6">
        <div className="flex items-center justify-between pb-3 border-b border-border/50 mb-4">
          <div>
            <h3 className="font-headline-sm text-headline-sm text-text-primary font-semibold">
              Recent Activity
            </h3>
            <p className="font-body-sm text-body-sm text-text-secondary mt-0.5">
              What has happened in your business recently.
            </p>
          </div>
        </div>

        {recentActivities.length === 0 ? (
          <div className="py-8 text-center text-text-secondary text-sm">
            No recent activity recorded today. When customers book appointments or start
            conversations, updates will appear here.
          </div>
        ) : (
          <div className="space-y-3">
            {recentActivities.map((act) => (
              <div
                key={act.id}
                className="flex items-start gap-3 p-3 rounded-xl bg-surface-container-lowest/80 border border-border/50 hover:bg-surface-container-low transition-colors"
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${act.badgeColor}`}
                >
                  <AppIcon name={act.icon} className="text-[16px]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-label-md text-xs font-semibold text-text-primary truncate">
                      {act.title}
                    </h4>
                    <span className="font-metric-sm text-[11px] text-text-secondary shrink-0">
                      {act.time}
                    </span>
                  </div>
                  <p className="font-body-sm text-xs text-text-secondary mt-0.5 leading-snug">
                    {act.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* -------------------------------------------------------------
                    SECTION SEVEN: SETUP CHECKLIST & LAUNCH GUIDES
                ------------------------------------------------------------- */}
      <div className="bg-surface rounded-xl border border-border/70 shadow-xs overflow-hidden">
        <div className="p-6 bg-surface-container-lowest border-b border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-fixed flex items-center justify-center text-primary shrink-0">
              <AppIcon name="rocket_launch" className="text-[20px]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-headline-sm text-headline-sm text-text-primary font-semibold">
                  Setup Checklist
                </h3>
                <Badge variant="default">
                  {checklist.completedCount} of {checklist.totalCount} Completed
                </Badge>
              </div>
              <p className="font-body-sm text-xs text-text-secondary mt-0.5">
                Derived from your persisted business, service, and deposit settings
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-baseline gap-1 font-metric-lg text-metric-lg text-primary">
              <span className="font-bold">{checklist.percent}</span>
              <span className="font-metric-sm text-metric-sm text-text-secondary">%</span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setChecklistExpanded((prev) => !prev)}
              className="text-xs"
            >
              {checklistExpanded ? 'Collapse' : 'View Checklist'}
            </Button>
          </div>
        </div>

        {/* Dynamic Progress Bar */}
        <div className="px-6 pt-3 pb-1 bg-surface-container-lowest">
          <Progress value={checklist.percent} aria-label="Setup checklist progress" />
        </div>

        {checklistExpanded && (
          <div className="p-6 space-y-3 bg-surface border-t border-border/50">
            {checklist.items.map((item, index) => {
              const isDone = item.status === 'completed';
              const isFocal = !isDone && index === checklist.completedCount;

              return (
                <div
                  key={item.id}
                  className={`flex items-start gap-4 p-3.5 rounded-xl transition-all ${
                    isFocal
                      ? 'bg-surface-container-low shadow-xs border border-primary/20'
                      : 'bg-surface-container-lowest hover:bg-surface-container-low'
                  }`}
                >
                  {isDone ? (
                    <div className="w-6 h-6 rounded-full bg-success flex items-center justify-center shrink-0 text-white mt-0.5 shadow-xs">
                      <AppIcon name="check" className="text-[15px] font-bold" />
                    </div>
                  ) : isFocal ? (
                    <div className="w-6 h-6 rounded-full bg-primary-container flex items-center justify-center shrink-0 text-on-primary mt-0.5">
                      <span className="w-2 h-2 rounded-full bg-surface animate-ping" />
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-surface-container-high flex items-center justify-center shrink-0 text-text-secondary mt-0.5">
                      <span className="font-metric-sm text-metric-sm font-medium">{index + 1}</span>
                    </div>
                  )}

                  <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`font-label-md text-label-md text-text-primary ${
                            isDone ? 'font-medium' : 'font-semibold'
                          }`}
                        >
                          {item.title}
                        </span>
                        <span
                          className={`font-metric-sm text-metric-sm px-2 py-0.5 rounded-full ${
                            isDone
                              ? 'text-success-strong bg-success/10'
                              : 'bg-secondary-container text-on-secondary-container'
                          }`}
                        >
                          {item.badgeText}
                        </span>
                      </div>
                      <p className="font-body-sm text-xs text-text-secondary mt-0.5">
                        {item.description}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={item.onAction}
                      className={`h-8 px-3 rounded-lg font-label-sm text-xs transition-colors shrink-0 self-start sm:self-auto flex items-center gap-1 cursor-pointer ${
                        isFocal
                          ? 'bg-primary hover:bg-primary/90 text-on-primary shadow-xs font-semibold'
                          : 'bg-surface hover:bg-surface-container text-text-primary border border-border shadow-2xs'
                      }`}
                    >
                      <span>{item.actionLabel}</span>
                      <AppIcon name="arrow_forward" className="text-[14px]" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Launch Resources Grid */}
        <div className="p-6 bg-surface-container-lowest border-t border-border/50">
          <h4 className="font-label-md text-xs uppercase tracking-wider text-text-secondary font-semibold mb-4">
            Setup Guides & Help
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Guide 1 */}
            <button
              type="button"
              onClick={() =>
                setGuideModal({
                  title: 'Connecting your Meta WhatsApp Business number',
                  category: 'WhatsApp Cloud API',
                  steps: [
                    'Open Integrations in the left sidebar and enter your Meta Phone Number ID.',
                    'Configure your webhook callback URL to point to /api/webhooks/whatsapp.',
                    'Once paired, incoming WhatsApp messages route to your AI receptionist to check real staff availability and offer 15-minute slot holds.',
                  ],
                })
              }
              className="p-4 rounded-xl bg-surface border border-border/60 hover:border-primary/40 text-left transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-1.5 text-text-secondary text-xs mb-2">
                <AppIcon name="chat" className="text-[16px] text-primary" />
                <span>WhatsApp Cloud</span>
              </div>
              <h5 className="font-label-md text-xs font-bold text-text-primary group-hover:text-primary transition-colors">
                How to connect WhatsApp Business
              </h5>
              <p className="font-body-sm text-[11px] text-text-secondary mt-1 leading-snug">
                Automate late-night customer DMs so customers can check slots and book anytime.
              </p>
            </button>

            {/* Guide 2 */}
            <button
              type="button"
              onClick={() =>
                setGuideModal({
                  title: 'How 15-minute slot holds and Kora deposits work',
                  category: 'Deposits & Verification',
                  steps: [
                    'When a customer picks a time slot, the calendar locks that staff window for 15 minutes.',
                    'Switchboard generates a unique deposit reference for payment.',
                    'Only after Kora sends a verified transaction status does the booking become Confirmed.',
                    'If the customer does not pay within 15 minutes, the slot automatically re-opens for others.',
                  ],
                })
              }
              className="p-4 rounded-xl bg-surface border border-border/60 hover:border-primary/40 text-left transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-1.5 text-text-secondary text-xs mb-2">
                <AppIcon name="payments" className="text-[16px] text-primary" />
                <span>Kora Deposits</span>
              </div>
              <h5 className="font-label-md text-xs font-bold text-text-primary group-hover:text-primary transition-colors">
                How slot holds & deposits stop no-shows
              </h5>
              <p className="font-body-sm text-[11px] text-text-secondary mt-1 leading-snug">
                Understand how Switchboard prevents double-bookings and safely verifies deposits.
              </p>
            </button>

            {/* Guide 3 */}
            <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200/60 text-left">
              <div className="flex items-center gap-1.5 text-primary text-xs mb-2 font-semibold">
                <AppIcon name="share" className="text-[16px]" />
                <span>Public Booking Link</span>
              </div>
              <h5 className="font-label-md text-xs font-bold text-indigo-950">
                Share your booking link
              </h5>
              <p className="font-body-sm text-[11px] text-indigo-800 mt-1 leading-snug">
                Your live booking link is ready at{' '}
                <code className="font-mono">/b/{workspace.slug}</code>.
              </p>
              <button
                type="button"
                onClick={copyBookingLink}
                className="mt-3 text-xs font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>{copiedSlug ? 'Link Copied!' : 'Copy Link'}</span>
                <AppIcon name="content_copy" className="text-[13px]" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------
                    SECTION EIGHT: DEVELOPER SANDBOX & TESTING (COLLAPSIBLE)
                ------------------------------------------------------------- */}
      <div className="rounded-xl border border-dashed border-border/80 bg-surface-container-lowest/60 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-text-secondary">
            <AppIcon name="tune" className="text-[18px]" />
            <span className="font-label-md text-xs font-semibold text-text-primary">
              Developer Sandbox &amp; Testing Controls
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setDevSandboxOpen((prev) => !prev)}
            className="text-xs h-7"
          >
            {devSandboxOpen ? 'Hide Developer Controls' : 'Show Developer Controls'}
          </Button>
        </div>

        {devSandboxOpen && (
          <div className="mt-4 pt-4 border-t border-border/50 space-y-3">
            <p className="text-xs text-text-secondary">
              These controls allow developers and pair programmers to simulate customer bookings,
              payment webhook verifications, timeouts, and human escalations in local environments.
            </p>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCreateSimulatedBooking}
                className="text-xs h-8"
              >
                <AppIcon name="add_circle" className="text-[14px] text-primary" />
                <span>Simulate Customer Booking</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleTriggerHumanEscalation}
                className="text-xs h-8"
              >
                <AppIcon name="notification_important" className="text-[14px] text-amber-600" />
                <span>Simulate Needs-Attention Escalation</span>
              </Button>

              {bookings.some((b) => b.status === 'held') && (
                <>
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={() => {
                      const held = bookings.find((b) => b.status === 'held');
                      if (held) handleVerifyKoraDeposit(held.id);
                    }}
                    className="text-xs h-8"
                  >
                    <AppIcon name="verified" className="text-[14px]" />
                    <span>Simulate Kora Webhook Verification</span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const held = bookings.find((b) => b.status === 'held');
                      if (held) handleFlagPaymentPendingVerification(held.id);
                    }}
                    className="text-xs h-8"
                  >
                    <AppIcon name="hourglass_empty" className="text-[14px] text-indigo-600" />
                    <span>Simulate Provider Timeout (Pending)</span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const held = bookings.find((b) => b.status === 'held');
                      if (held) handleExpireHold(held.id);
                    }}
                    className="text-xs h-8"
                  >
                    <AppIcon name="history" className="text-[14px] text-slate-600" />
                    <span>Expire Hold (15m Elapsed)</span>
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
