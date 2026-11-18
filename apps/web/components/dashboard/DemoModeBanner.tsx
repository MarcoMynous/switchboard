'use client';

import { useState } from 'react';
import { AppIcon } from '@/components/AppIcon';
import { Button } from '@/components/ui/button';
import { useDashboard } from './DashboardContext';

export function DemoModeBanner() {
  const {
    apiState,
    demoModified,
    demoBusy,
    demoNotice,
    setDemoNotice,
    resetDemoMode,
    exitDemoMode,
    startGuidedTour,
    runDemoScenario,
    setChatDrawerOpen,
  } = useDashboard();

  const [scenariosOpen, setScenariosOpen] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  if (!apiState.isDemo) {
    return null;
  }

  const handleResetClick = () => {
    if (demoModified) {
      setConfirmResetOpen(true);
    } else {
      void resetDemoMode();
    }
  };

  return (
    <div className="mb-6 rounded-2xl border border-[#22306B]/20 bg-[#22306B] text-white shadow-sm overflow-hidden">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#F5B700] px-2.5 py-0.5 font-label-sm text-xs font-bold text-[#101827]">
            <AppIcon name="science" className="text-[14px]" />
            DEMO MODE
          </span>
          <p className="font-body-md text-sm text-white/95 truncate">
            <strong>Demo Mode</strong> — Sample data. No real payments or customer messages.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <Button
            size="sm"
            variant="secondary"
            className="h-8 bg-white/10 text-white hover:bg-white/20 border border-white/15"
            disabled={demoBusy}
            onClick={() => setScenariosOpen((v) => !v)}
          >
            <AppIcon name="play_circle" className="text-[15px]" />
            Scenarios
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="h-8 bg-white/10 text-white hover:bg-white/20 border border-white/15"
            disabled={demoBusy}
            onClick={handleResetClick}
          >
            <AppIcon name="restart_alt" className="text-[15px]" />
            Reset Demo
          </Button>
          <Button
            size="sm"
            className="h-8 bg-[#F5B700] text-[#101827] hover:bg-[#eab000] font-semibold"
            disabled={demoBusy}
            onClick={startGuidedTour}
          >
            <AppIcon name="tour" className="text-[15px]" />
            Take a Tour
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-white/90 hover:bg-white/15 hover:text-white"
            disabled={demoBusy}
            onClick={() => void exitDemoMode()}
          >
            <AppIcon name="logout" className="text-[15px]" />
            Exit Demo
          </Button>
        </div>
      </div>

      {demoNotice && (
        <div className="flex items-center justify-between gap-3 bg-[#17214d] px-4 py-2 text-xs text-white/90 border-t border-white/10">
          <span>{demoNotice}</span>
          <button
            type="button"
            className="text-white/70 hover:text-white underline shrink-0"
            onClick={() => setDemoNotice(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {scenariosOpen && (
        <div className="bg-[#F5F6FA] text-text-primary px-4 py-4 border-t border-[#22306B]/15">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <h3 className="font-label-md text-sm font-semibold text-[#22306B]">
                Interactive Demo Scenarios (Simulated Backend)
              </h3>
              <p className="text-xs text-text-secondary">
                Executes real booking engine holds &amp; mock Kora verification against this
                isolated demo workspace.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            <button
              type="button"
              disabled={demoBusy}
              onClick={() => void runDemoScenario('run_booking_demo')}
              className="flex flex-col items-start gap-1 rounded-xl border border-border bg-white p-3 text-left transition hover:border-[#22306B]/50 hover:shadow-xs disabled:opacity-50"
            >
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#22306B]">
                <AppIcon name="event_available" className="text-[15px]" />
                Run Booking Demo
              </span>
              <span className="text-xs text-text-secondary">
                Reserves a conflict-free 15-min hold via the booking engine.
              </span>
            </button>

            <button
              type="button"
              disabled={demoBusy}
              onClick={() => void runDemoScenario('simulate_deposit_payment')}
              className="flex flex-col items-start gap-1 rounded-xl border border-border bg-white p-3 text-left transition hover:border-[#22306B]/50 hover:shadow-xs disabled:opacity-50"
            >
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#22306B]">
                <AppIcon name="payments" className="text-[15px]" />
                Simulate Deposit Payment
              </span>
              <span className="text-xs text-text-secondary">
                Emits a mock Kora charge.success event &amp; confirms the held booking.
              </span>
            </button>

            <button
              type="button"
              disabled={demoBusy}
              onClick={() => setChatDrawerOpen(true)}
              className="flex flex-col items-start gap-1 rounded-xl border border-border bg-white p-3 text-left transition hover:border-[#22306B]/50 hover:shadow-xs disabled:opacity-50"
            >
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#22306B]">
                <AppIcon name="smart_toy" className="text-[15px]" />
                Try Maya
              </span>
              <span className="text-xs text-text-secondary">
                Chat with Maya against Fade Republic&apos;s demo catalog &amp; slots.
              </span>
            </button>

            <button
              type="button"
              disabled={demoBusy}
              onClick={() => void runDemoScenario('simulate_human_handoff')}
              className="flex flex-col items-start gap-1 rounded-xl border border-border bg-white p-3 text-left transition hover:border-[#22306B]/50 hover:shadow-xs disabled:opacity-50"
            >
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#22306B]">
                <AppIcon name="support_agent" className="text-[15px]" />
                Simulate Human Handoff
              </span>
              <span className="text-xs text-text-secondary">
                Creates a simulated customer escalation in Needs Attention.
              </span>
            </button>

            <button
              type="button"
              disabled={demoBusy}
              onClick={() => void runDemoScenario('simulate_expired_hold')}
              className="flex flex-col items-start gap-1 rounded-xl border border-border bg-white p-3 text-left transition hover:border-[#22306B]/50 hover:shadow-xs disabled:opacity-50"
            >
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#22306B]">
                <AppIcon name="timer_off" className="text-[15px]" />
                Simulate Expired Hold
              </span>
              <span className="text-xs text-text-secondary">
                Expires an unpaid hold and releases slot availability.
              </span>
            </button>

            <button
              type="button"
              disabled={demoBusy}
              onClick={() => void runDemoScenario('simulate_refund')}
              className="flex flex-col items-start gap-1 rounded-xl border border-border bg-white p-3 text-left transition hover:border-[#22306B]/50 hover:shadow-xs disabled:opacity-50"
            >
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#22306B]">
                <AppIcon name="currency_exchange" className="text-[15px]" />
                Simulate Refund
              </span>
              <span className="text-xs text-text-secondary">
                Records an authorized mock Kora refund without real transfers.
              </span>
            </button>
          </div>
        </div>
      )}

      {confirmResetOpen && (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="demo-reset-confirm-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 text-text-primary shadow-xl">
            <h3 id="demo-reset-confirm-title" className="font-headline-sm text-lg font-semibold">
              Reset Demo Workspace?
            </h3>
            <p className="mt-2 text-sm text-text-secondary">
              You have simulated changes in this demo session. Resetting restores Fade Republic
              Barbershop&apos;s initial sample data and affects only this demo session.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setConfirmResetOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-[#22306B] text-white hover:bg-[#1a2554]"
                onClick={() => {
                  setConfirmResetOpen(false);
                  void resetDemoMode();
                }}
              >
                Confirm Reset
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
