'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AppIcon } from './AppIcon';

export function DemoEntryButton() {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLaunchDemo = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/demo/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryOrigin: 'landing' }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error || 'Could not start interactive demo.');
        setLoading(false);
        return;
      }
      setModalOpen(false);
      router.push('/dashboard/overview?tour=welcome');
    } catch {
      setError('Network error starting interactive demo.');
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="inline-flex w-full items-center justify-center gap-2 rounded border border-[#F5B700]/50 bg-[#F5B700]/15 px-6 py-3.5 font-label-md text-label-md text-[#F5B700] backdrop-blur-sm transition-all hover:bg-[#F5B700]/25 sm:w-auto cursor-pointer"
      >
        <AppIcon name="science" className="text-[18px]" />
        <span>Try Interactive Demo</span>
      </button>

      {modalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 text-left backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="landing-demo-modal-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 text-text-primary shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#22306B] text-[#F5B700]">
                <AppIcon name="science" className="text-[20px]" />
              </div>
              <div>
                <span className="inline-flex items-center rounded-full bg-[#F5B700]/20 px-2.5 py-0.5 text-xs font-semibold text-[#22306B]">
                  Isolated Fictional Demo
                </span>
                <h2
                  id="landing-demo-modal-title"
                  className="mt-2 font-headline-sm text-lg font-semibold text-text-primary"
                >
                  Explore Switchboard with Fade Republic Barbershop
                </h2>
                <p className="mt-2 text-sm text-text-secondary leading-relaxed">
                  You are entering a fictional demonstration workspace in an isolated session. Test
                  real booking holds, simulated Kora deposits, Maya AI chat, and Needs Attention
                  workflows. <strong>No real payments or WhatsApp messages are sent.</strong>
                </p>
              </div>
            </div>

            {error && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
            )}

            <div className="mt-6 flex items-center justify-end gap-2.5 border-t border-border/60 pt-4">
              <button
                type="button"
                disabled={loading}
                onClick={() => setModalOpen(false)}
                className="rounded-lg border border-border px-3.5 py-2 text-sm font-medium text-text-secondary hover:bg-surface-container-low cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => void handleLaunchDemo()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#22306B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1a2554] disabled:opacity-60 cursor-pointer"
              >
                <AppIcon name="arrow_forward" className="text-[16px]" />
                <span>{loading ? 'Preparing Demo...' : 'Enter Demo Workspace'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
