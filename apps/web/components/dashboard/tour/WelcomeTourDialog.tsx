'use client';

import { useEffect, useRef } from 'react';
import { AppIcon } from '@/components/AppIcon';

interface WelcomeTourDialogProps {
  open: boolean;
  businessName: string;
  onStartTour: () => void;
  onMaybeLater: () => void;
}

export function WelcomeTourDialog({
  open,
  businessName,
  onStartTour,
  onMaybeLater,
}: WelcomeTourDialogProps) {
  const startButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const frame = requestAnimationFrame(() => {
      startButtonRef.current?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onMaybeLater();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', handleKeyDown);
      if (previousFocusRef.current && document.contains(previousFocusRef.current)) {
        previousFocusRef.current.focus();
      }
    };
  }, [open, onMaybeLater]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#22306B]/55 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-tour-title"
      aria-describedby="welcome-tour-description"
    >
      <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden">
        <div className="bg-[#F5F6FA] px-6 py-5 border-b border-slate-200/80 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#22306B] text-white flex items-center justify-center shrink-0">
              <AppIcon name="explore" className="text-[22px]" />
            </div>
            <div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#F5B700]/20 text-[#22306B] text-[11px] font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-[#F5B700]" />
                Quick 1-minute walkthrough
              </span>
              <h2
                id="welcome-tour-title"
                className="mt-1 text-xl font-bold text-[#22306B] leading-snug"
                style={{
                  fontFamily: 'var(--font-familjen-grotesk), var(--font-geist-sans), sans-serif',
                }}
              >
                Welcome to {businessName || 'Switchboard'}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onMaybeLater}
            aria-label="Close welcome dialog"
            className="p-1.5 rounded-lg text-slate-500 hover:text-[#22306B] hover:bg-white transition-colors cursor-pointer"
          >
            <AppIcon name="close" className="text-[18px]" />
          </button>
        </div>

        <div
          className="px-6 py-5 space-y-4"
          style={{
            fontFamily:
              'var(--font-atkinson-hyperlegible-next), var(--font-geist-sans), sans-serif',
          }}
        >
          <p id="welcome-tour-description" className="text-[15px] text-slate-700 leading-relaxed">
            Your workspace is ready. Take a quick guided tour to see where your daily bookings,
            customer chats, AI receptionist, and booking link live.
          </p>

          <div className="rounded-xl bg-[#F5F6FA] p-3.5 text-xs text-slate-600 flex items-center gap-2.5">
            <AppIcon name="verified_user" className="text-[18px] text-[#22306B] shrink-0" />
            <span>
              This tour is read-only—it won&apos;t send messages, change settings, or create any
              bookings.
            </span>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onMaybeLater}
              className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-[#22306B] hover:bg-[#F5F6FA] transition-colors cursor-pointer"
            >
              Maybe Later
            </button>
            <button
              ref={startButtonRef}
              type="button"
              onClick={onStartTour}
              className="px-5 py-2.5 rounded-xl bg-[#22306B] text-white text-sm font-semibold hover:bg-[#192452] transition-colors cursor-pointer inline-flex items-center justify-center gap-2 shadow-xs"
            >
              <span>Start Tour</span>
              <AppIcon name="arrow_forward" className="text-[16px]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
