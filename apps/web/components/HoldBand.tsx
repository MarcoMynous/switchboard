'use client';

import { useEffect, useState } from 'react';
import { AppIcon } from './AppIcon';

export type HoldBandStatus =
  | 'held'
  | 'pending_verification'
  | 'confirmed'
  | 'expired'
  | 'cancelled';

export interface HoldBandProps {
  status: HoldBandStatus;
  /** Remaining hold time in seconds (out of totalSeconds, default 900 = 15 mins) */
  remainingSeconds?: number;
  /** Total hold window in seconds (default 900 = 15 mins) */
  totalSeconds?: number;
  /** Whether the component should tick down every second when status === 'held' */
  autoTick?: boolean;
  /** Surface theme: 'light' for /b/[slug] & /dashboard, 'dark' for /chaos Midnight (#101827) */
  theme?: 'light' | 'dark';
  /** Compact mode for dense calendar tiles */
  compact?: boolean;
  /** Optional booking or Kora reference (e.g. sb_dep_01JFADEREP98K2) */
  reference?: string;
  /** Optional callback when timer hits 0 */
  onExpire?: () => void;
}

function formatHoldCountdown(seconds: number): string {
  const clamped = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function HoldBand({
  status,
  remainingSeconds = 900,
  totalSeconds = 900,
  autoTick = false,
  theme = 'light',
  compact = false,
  reference,
  onExpire,
}: HoldBandProps) {
  const [secondsLeft, setSecondsLeft] = useState<number>(remainingSeconds);

  useEffect(() => {
    setSecondsLeft(remainingSeconds);
  }, [remainingSeconds]);

  useEffect(() => {
    if (!autoTick || status !== 'held') return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          onExpire?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [autoTick, status, onExpire]);

  const effectiveStatus: HoldBandStatus =
    status === 'held' && secondsLeft <= 0 ? 'expired' : status;

  const progressPct =
    effectiveStatus === 'confirmed'
      ? 100
      : effectiveStatus === 'expired' || effectiveStatus === 'cancelled'
        ? 0
        : effectiveStatus === 'pending_verification'
          ? Math.max(15, Math.min(100, (secondsLeft / Math.max(1, totalSeconds)) * 100))
          : Math.max(0, Math.min(100, (secondsLeft / Math.max(1, totalSeconds)) * 100));

  const isDark = theme === 'dark';

  return (
    <div
      className={`rounded-xl border transition-all duration-300 ${
        isDark
          ? 'bg-[#101827] border-slate-800 text-[#F8FAFC]'
          : effectiveStatus === 'confirmed'
            ? 'bg-[#6258E8]/5 border-[#6258E8]/25 text-[#111827]'
            : effectiveStatus === 'held' || effectiveStatus === 'pending_verification'
              ? 'bg-[#FFFBEB] border-[#F59E0B]/35 text-[#111827]'
              : 'bg-slate-50 border-[#E5E7EB] text-[#64748B]'
      } ${compact ? 'p-2.5 space-y-2' : 'p-3.5 space-y-2.5'}`}
      aria-live="polite"
    >
      {/* Top Status & Countdown Row */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {effectiveStatus === 'held' && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold bg-[#F59E0B]/15 text-[#92400E] dark:text-[#FBBF24]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B] animate-pulse" />
              Slot held · awaiting deposit
            </span>
          )}

          {effectiveStatus === 'pending_verification' && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold bg-[#F59E0B]/20 text-[#92400E]">
              <AppIcon name="sync" className="text-[12px] animate-spin" />
              Pending Kora verification (I7)
            </span>
          )}

          {effectiveStatus === 'confirmed' && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold bg-[#10B981]/15 text-[#047857]">
              <AppIcon name="verified" className="text-[13px] text-[#10B981]" />
              Confirmed · slot locked
            </span>
          )}

          {effectiveStatus === 'expired' && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold bg-[#EF4444]/15 text-[#B91C1C]">
              <AppIcon name="timer" className="text-[12px]" />
              Hold expired · slot released
            </span>
          )}

          {effectiveStatus === 'cancelled' && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold bg-slate-200/80 text-slate-600">
              <AppIcon name="cancel" className="text-[12px]" />
              Cancelled
            </span>
          )}

          {reference && !compact && (
            <span
              className={`text-[11px] font-mono ${isDark ? 'text-slate-400' : 'text-[#64748B]'}`}
            >
              {reference}
            </span>
          )}
        </div>

        {/* Right-side timer or lock state */}
        <div className="flex items-center gap-1.5 font-mono">
          {effectiveStatus === 'held' && (
            <span
              className={`text-xs font-bold tabular-nums ${
                secondsLeft <= 120 ? 'text-[#EF4444]' : isDark ? 'text-[#FBBF24]' : 'text-[#92400E]'
              }`}
            >
              {formatHoldCountdown(secondsLeft)} left
            </span>
          )}

          {effectiveStatus === 'pending_verification' && (
            <span className="text-xs font-semibold text-[#92400E]">Reconciling…</span>
          )}

          {effectiveStatus === 'confirmed' && (
            <span className="text-xs font-semibold text-[#6258E8]">Locked</span>
          )}

          {(effectiveStatus === 'expired' || effectiveStatus === 'cancelled') && (
            <span className="text-xs font-semibold text-[#64748B]">00:00</span>
          )}
        </div>
      </div>

      {/* The Hold Band Bar: drains left-to-right in #F59E0B; floods #6258E8 on confirm (300ms) */}
      <div
        className={`w-full rounded-full overflow-hidden ${
          compact ? 'h-1.5' : 'h-2'
        } ${isDark ? 'bg-slate-800' : 'bg-slate-200/85'}`}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progressPct)}
        aria-label={`Booking slot status: ${effectiveStatus}`}
      >
        <div
          className={`h-full rounded-full transition-all duration-300 ease-out ${
            effectiveStatus === 'confirmed'
              ? 'bg-[#6258E8]'
              : effectiveStatus === 'held'
                ? secondsLeft <= 120
                  ? 'bg-[#EF4444]'
                  : 'bg-[#F59E0B]'
                : effectiveStatus === 'pending_verification'
                  ? 'bg-[#F59E0B] animate-pulse'
                  : 'bg-slate-400'
          }`}
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </div>
  );
}
