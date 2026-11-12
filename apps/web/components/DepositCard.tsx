'use client';

import { useEffect, useState } from 'react';
import { AppIcon } from './AppIcon';
import { HoldBand, type HoldBandStatus } from './HoldBand';

export type DepositCardStatus =
  | 'held'
  | 'pending_verification'
  | 'confirmed'
  | 'underpaid'
  | 'expired'
  | 'cancelled';

export interface DepositCardProps {
  reference: string;
  businessName: string;
  customerName?: string;
  customerPhone?: string;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  /** Base deposit amount in integer kobo (Invariant I6) */
  baseDepositKobo: number;
  /** Kora processing fee in integer kobo (Invariant I6) */
  koraFeeKobo?: number;
  /** Total amount the customer must transfer in integer kobo */
  amountExpectedKobo: number;
  /** Amount received so far in integer kobo (for underpaid tracking) */
  amountPaidKobo?: number;
  merchantBearsCost?: boolean;
  initialStatus: DepositCardStatus;
  remainingSeconds?: number;
  freeCancelHours?: number;
  /** Poll interval in milliseconds (default 3000ms = 3s per Phase 2 spec) */
  pollIntervalMs?: number;
  /** Enable/disable live HTTP polling against /api/booking-status */
  enablePolling?: boolean;
  onStatusChange?: (nextStatus: DepositCardStatus, amountPaidKobo?: number) => void;
  onPickDifferentSlot?: () => void;
  showSandboxControls?: boolean;
}

export function formatNairaFromKobo(kobo: number): string {
  return `₦${Math.round(kobo / 100).toLocaleString('en-NG')}`;
}

export function computeKoraFeeKobo(baseDepositKobo: number): number {
  if (baseDepositKobo <= 0) return 0;
  // Standard Nigerian local transfer/checkout estimate: 1.5%, capped at ₦2,000 (200,000 kobo)
  return Math.min(200_000, Math.round(baseDepositKobo * 0.015));
}

function isTerminal(status: DepositCardStatus): boolean {
  return status === 'confirmed' || status === 'expired' || status === 'cancelled';
}

export function DepositCard({
  reference,
  businessName,
  customerName,
  customerPhone,
  bankName = 'Wema Bank',
  accountNumber = '7829104482',
  accountName,
  baseDepositKobo,
  koraFeeKobo = 0,
  amountExpectedKobo,
  amountPaidKobo: initialPaidKobo = 0,
  merchantBearsCost = false,
  initialStatus,
  remainingSeconds = 900,
  freeCancelHours = 4,
  pollIntervalMs = 3000,
  enablePolling = true,
  onStatusChange,
  onPickDifferentSlot,
  showSandboxControls = true,
}: DepositCardProps) {
  const [status, setStatus] = useState<DepositCardStatus>(initialStatus);
  const [amountPaidKobo, setAmountPaidKobo] = useState<number>(initialPaidKobo);
  const [secondsLeft, setSecondsLeft] = useState<number>(remainingSeconds);
  const [copiedAccount, setCopiedAccount] = useState(false);
  const [copiedAmount, setCopiedAmount] = useState(false);
  const [isPollingActive, setIsPollingActive] = useState(
    enablePolling && !isTerminal(initialStatus),
  );
  const [lastPolledAt, setLastPolledAt] = useState<string | null>(null);

  useEffect(() => {
    setStatus(initialStatus);
    setIsPollingActive(enablePolling && !isTerminal(initialStatus));
  }, [initialStatus, enablePolling]);

  useEffect(() => {
    setAmountPaidKobo(initialPaidKobo);
  }, [initialPaidKobo]);

  useEffect(() => {
    setSecondsLeft(remainingSeconds);
  }, [remainingSeconds]);

  // Poll every 3s while in non-terminal state; stop automatically on terminal state
  useEffect(() => {
    if (!enablePolling || isTerminal(status)) {
      setIsPollingActive(false);
      return;
    }

    setIsPollingActive(true);
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`/api/booking-status?reference=${encodeURIComponent(reference)}`, {
          cache: 'no-store',
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          ok?: boolean;
          found?: boolean;
          status?: DepositCardStatus;
          amountPaidKobo?: number;
          remainingSeconds?: number;
          terminal?: boolean;
        };
        if (cancelled) return;
        setLastPolledAt(
          new Date().toLocaleTimeString('en-NG', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
        );

        if (data.ok && data.found && data.status) {
          if (typeof data.amountPaidKobo === 'number') {
            setAmountPaidKobo(data.amountPaidKobo);
          }
          if (typeof data.remainingSeconds === 'number') {
            setSecondsLeft(data.remainingSeconds);
          }
          if (data.status !== status) {
            setStatus(data.status);
            onStatusChange?.(data.status, data.amountPaidKobo);
          }
          if (data.terminal || isTerminal(data.status)) {
            setIsPollingActive(false);
          }
        }
      } catch {
        // Keep current client state on transient poll errors
      }
    };

    const interval = setInterval(() => {
      void poll();
    }, pollIntervalMs);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [enablePolling, status, reference, pollIntervalMs, onStatusChange]);

  const shortfallKobo = Math.max(0, amountExpectedKobo - amountPaidKobo);
  const holdBandStatus: HoldBandStatus = status === 'underpaid' ? 'held' : status;

  const triggerSandboxTransition = async (nextStatus: DepositCardStatus, paidKobo?: number) => {
    const resolvedPaid =
      paidKobo ??
      (nextStatus === 'confirmed'
        ? amountExpectedKobo
        : nextStatus === 'underpaid'
          ? Math.max(10_000, Math.round(amountExpectedKobo * 0.6))
          : 0);

    setStatus(nextStatus);
    setAmountPaidKobo(resolvedPaid);
    if (isTerminal(nextStatus)) {
      setIsPollingActive(false);
    }
    onStatusChange?.(nextStatus, resolvedPaid);

    try {
      await fetch('/api/booking-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference,
          status: nextStatus,
          amountExpectedKobo,
          amountPaidKobo: resolvedPaid,
          bankName,
          accountNumber,
          accountName: accountName || `${businessName} via Switchboard`,
        }),
      });
    } catch {
      // ignore if offline
    }
  };

  return (
    <div className="space-y-4">
      <HoldBand
        status={holdBandStatus}
        remainingSeconds={secondsLeft}
        totalSeconds={900}
        autoTick={status === 'held' || status === 'underpaid'}
        reference={reference}
        onExpire={() => {
          void triggerSandboxTransition('expired', amountPaidKobo);
        }}
      />

      {/* HELD / AWAITING TRANSFER */}
      {status === 'held' && (
        <div className="p-4 rounded-xl bg-[#F7F8FB] border border-[#E5E7EB] space-y-3.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#64748B] font-semibold">
              Kora virtual bank transfer
            </span>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-[#6258E8] font-semibold">
              <span
                className={`w-1.5 h-1.5 rounded-full bg-[#6258E8] ${isPollingActive ? 'animate-ping' : ''}`}
              />
              {isPollingActive ? 'Live polling (3s)' : 'Standby'}
            </span>
          </div>

          <div className="bg-white rounded-lg border border-[#E5E7EB] p-3 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#64748B]">Bank</span>
              <span className="font-semibold text-[#111827]">{bankName}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#64748B]">Account name</span>
              <span className="font-semibold text-[#111827]">
                {accountName || `${businessName} via Switchboard`}
              </span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <div>
                <p className="text-[10px] text-[#64748B] uppercase font-mono">Account number</p>
                <p className="text-[16px] font-mono font-bold text-[#111827] tracking-wider">
                  {accountNumber}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(accountNumber);
                  setCopiedAccount(true);
                  setTimeout(() => setCopiedAccount(false), 2000);
                }}
                className="px-2.5 py-1.5 rounded-lg border border-[#E5E7EB] bg-white text-xs font-semibold text-[#6258E8] hover:bg-slate-50 cursor-pointer"
              >
                {copiedAccount ? 'Copied!' : 'Copy account number'}
              </button>
            </div>
          </div>

          {/* Exact Amount to Transfer */}
          <div className="bg-white rounded-lg border border-[#6258E8]/25 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-[#64748B] uppercase font-mono">
                  Exact amount to transfer
                </p>
                <p className="text-[18px] font-mono font-bold text-[#6258E8]">
                  {formatNairaFromKobo(amountExpectedKobo)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(String(Math.round(amountExpectedKobo / 100)));
                  setCopiedAmount(true);
                  setTimeout(() => setCopiedAmount(false), 2000);
                }}
                className="px-2.5 py-1.5 rounded-lg border border-[#E5E7EB] bg-white text-xs font-semibold text-[#111827] hover:bg-slate-50 cursor-pointer"
              >
                {copiedAmount ? 'Copied!' : 'Copy amount'}
              </button>
            </div>

            <div className="text-[11px] text-[#64748B] flex items-center justify-between pt-1.5 border-t border-slate-100">
              <span>
                Deposit: {formatNairaFromKobo(baseDepositKobo)}
                {!merchantBearsCost && koraFeeKobo > 0
                  ? ` + Kora fee: ${formatNairaFromKobo(koraFeeKobo)}`
                  : ' (Kora fee absorbed by shop)'}
              </span>
              {lastPolledAt && <span className="font-mono">Checked {lastPolledAt}</span>}
            </div>
          </div>

          <p className="text-[11px] text-[#64748B] leading-relaxed">
            Transfer the exact amount above. Free refund if cancelled at least{' '}
            <strong>{freeCancelHours} hours</strong> before your slot. Slot confirms only after Kora{' '}
            <code>charge.success</code> + transaction re-verification (Invariant I2).
          </p>
        </div>
      )}

      {/* UNDERPAID */}
      {status === 'underpaid' && (
        <div className="p-4 rounded-xl bg-[#FFFBEB] border border-[#F59E0B]/45 space-y-3">
          <div className="flex items-start gap-2.5">
            <AppIcon name="warning" className="text-[20px] text-[#B45309] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-[13px] font-bold text-[#92400E]">
                Partial deposit received — {formatNairaFromKobo(shortfallKobo)} shortfall remaining
              </p>
              <p className="text-[12px] text-[#78350F] leading-relaxed">
                Kora confirmed a transfer of{' '}
                <strong className="font-mono">{formatNairaFromKobo(amountPaidKobo)}</strong> out of{' '}
                <strong className="font-mono">{formatNairaFromKobo(amountExpectedKobo)}</strong>.
                Your slot stays held while you transfer the remaining{' '}
                <strong className="font-mono">{formatNairaFromKobo(shortfallKobo)}</strong> to
                account <span className="font-mono font-bold">{accountNumber}</span> ({bankName}).
              </p>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-[#F59E0B]/30 p-3 flex items-center justify-between text-xs">
            <div>
              <span className="text-[#64748B] block">Remaining balance to confirm</span>
              <span className="text-base font-mono font-bold text-[#B45309]">
                {formatNairaFromKobo(shortfallKobo)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(accountNumber);
                setCopiedAccount(true);
                setTimeout(() => setCopiedAccount(false), 2000);
              }}
              className="px-3 py-1.5 rounded-lg border border-[#F59E0B]/40 text-xs font-semibold text-[#B45309] hover:bg-amber-50 cursor-pointer"
            >
              {copiedAccount ? 'Copied!' : `Copy ${accountNumber}`}
            </button>
          </div>
        </div>
      )}

      {/* PENDING VERIFICATION (Invariant I7) */}
      {status === 'pending_verification' && (
        <div className="p-4 rounded-xl bg-[#FFFBEB] border border-[#F59E0B]/40 space-y-2">
          <p className="text-[13px] font-bold text-[#B45309]">
            Verifying your transfer with Kora (Invariant I7)
          </p>
          <p className="text-[12px] text-[#78350F] leading-relaxed">
            Kora acknowledged activity for reference <span className="font-mono">{reference}</span>.
            We never guess on a timeout — polling every 3s until transaction verification completes.
          </p>
        </div>
      )}

      {/* CONFIRMED */}
      {status === 'confirmed' && (
        <div className="p-4 rounded-xl bg-[#10B981]/10 border border-[#10B981]/30 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-bold text-[#047857]">
              Appointment confirmed{customerName ? ` for ${customerName}` : ''}
            </p>
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#10B981]/15 text-[#047857] font-semibold">
              Polling stopped
            </span>
          </div>
          <p className="text-[12px] text-[#065F46] leading-relaxed">
            {amountExpectedKobo === 0
              ? 'This service requires no upfront deposit, so your slot was confirmed directly.'
              : `Your Kora deposit of ${formatNairaFromKobo(amountExpectedKobo)} is verified and your slot is locked.`}
            {customerPhone && (
              <>
                {' '}
                A WhatsApp confirmation has been queued for{' '}
                <span className="font-mono font-semibold">{customerPhone}</span>.
              </>
            )}
          </p>
        </div>
      )}

      {/* EXPIRED */}
      {status === 'expired' && (
        <div className="p-4 rounded-xl bg-[#FEF2F2] border border-[#EF4444]/30 space-y-3">
          <div className="flex items-start gap-2.5">
            <AppIcon name="timer" className="text-[18px] text-[#B91C1C] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-[13px] font-bold text-[#991B1B]">
                15-minute hold expired — slot released
              </p>
              <p className="text-[12px] text-[#7F1D1D] leading-relaxed">
                This time slot is now open for other customers. If you already transferred after the
                timer ran out, Switchboard checks availability automatically and issues an instant
                Kora refund if the slot was taken.
              </p>
            </div>
          </div>
          {onPickDifferentSlot && (
            <button
              type="button"
              onClick={onPickDifferentSlot}
              className="w-full py-2 rounded-lg bg-[#EF4444] hover:bg-[#DC2626] text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              Pick a new time slot
            </button>
          )}
        </div>
      )}

      {/* SANDBOX DEMO CONTROLS (For Judge Walkthrough / Testing Phase 2 States) */}
      {showSandboxControls && !isTerminal(status) && (
        <div className="p-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 space-y-2">
          <p className="text-[10px] font-mono uppercase tracking-wider text-[#64748B] font-semibold">
            Sandbox webhook &amp; state simulator (Mock Kora)
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void triggerSandboxTransition('confirmed', amountExpectedKobo)}
              className="py-2 px-2.5 rounded-lg bg-[#101827] hover:bg-slate-800 text-white text-[11px] font-mono font-semibold transition-colors cursor-pointer"
            >
              Simulate full pay → Confirm
            </button>
            <button
              type="button"
              onClick={() =>
                void triggerSandboxTransition(
                  'underpaid',
                  Math.max(10_000, Math.round(amountExpectedKobo * 0.6)),
                )
              }
              className="py-2 px-2.5 rounded-lg border border-[#F59E0B]/50 bg-[#FFFBEB] hover:bg-amber-100/70 text-[#92400E] text-[11px] font-mono font-semibold transition-colors cursor-pointer"
            >
              Simulate partial (Underpaid)
            </button>
            <button
              type="button"
              onClick={() => void triggerSandboxTransition('pending_verification', 0)}
              className="py-2 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-[#111827] text-[11px] font-mono font-semibold transition-colors cursor-pointer"
            >
              Simulate timeout (Pending I7)
            </button>
            <button
              type="button"
              onClick={() => void triggerSandboxTransition('expired', 0)}
              className="py-2 px-2.5 rounded-lg border border-[#EF4444]/40 bg-[#FEF2F2] hover:bg-red-100/70 text-[#991B1B] text-[11px] font-mono font-semibold transition-colors cursor-pointer"
            >
              Simulate 15m expiry
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
