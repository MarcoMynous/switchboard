'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AppIcon } from '@/components/AppIcon';
import { computeKoraFeeKobo, DepositCard, type DepositCardStatus } from '@/components/DepositCard';
import { HoldBand, type HoldBandStatus } from '@/components/HoldBand';
import { SwitchboardLogo } from '@/components/SwitchboardLogo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export function HoldBandWorkbench() {
  const [status, setStatus] = useState<HoldBandStatus>('held');
  const [remainingSeconds, setRemainingSeconds] = useState<number>(840);
  const [autoTick, setAutoTick] = useState<boolean>(true);
  const [depositCardStatus, setDepositCardStatus] = useState<DepositCardStatus>('held');
  const [merchantBearsCost, setMerchantBearsCost] = useState<boolean>(false);

  const baseDepositKobo = 150_000;
  const koraFeeKobo = merchantBearsCost ? 0 : computeKoraFeeKobo(baseDepositKobo);
  const expectedKobo = baseDepositKobo + koraFeeKobo;

  return (
    <div className="min-h-screen bg-[#F7F8FB] text-[#111827] font-sans">
      <header className="w-full border-b border-[#E5E7EB] bg-white px-6 py-4">
        <div className="max-w-[1080px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SwitchboardLogo href="/" size="sm" theme="light" />
            <Badge variant="secondary" className="font-mono text-xs">
              /dev/components · Dev Only
            </Badge>
          </div>
          <div className="flex items-center gap-2.5">
            <Link
              href="/b/fade-republic"
              className="px-3 py-1.5 rounded-lg border border-[#E5E7EB] bg-white text-xs font-semibold text-[#111827] hover:bg-slate-50 transition-colors"
            >
              Open /b/fade-republic
            </Link>
            <Link
              href="/dashboard"
              className="px-3 py-1.5 rounded-lg bg-[#6258E8] text-white text-xs font-semibold hover:bg-[#5247d8] transition-colors"
            >
              Open Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-[1080px] mx-auto px-6 py-10 space-y-10">
        <div className="space-y-2">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#6258E8]">
            PHASE 1 COMPONENT WORKBENCH
          </span>
          <h1 className="text-3xl font-bold tracking-tight text-[#111827]">
            Hold Band &amp; Slot State Machine
          </h1>
          <p className="text-sm text-[#64748B] max-w-2xl">
            Storybook-free component harness (excluded in production). Exercises the 15-minute
            draining Warning band (<code>#F59E0B</code>), pending Kora verification (Invariant I7),
            and the 300ms Iris flood (<code>#6258E8</code>) on confirmed payment (Invariant I2).
          </p>
        </div>

        {/* Interactive Controller */}
        <section className="bg-white rounded-2xl border border-[#E5E7EB] p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-[#111827]">Interactive State Controller</h2>
              <p className="text-xs text-[#64748B]">
                Trigger state transitions and scrub the 15-minute hold window
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {(
                [
                  { id: 'held', label: 'Held (Draining #F59E0B)' },
                  { id: 'pending_verification', label: 'Pending Verification (I7)' },
                  { id: 'confirmed', label: 'Confirmed (Flood #6258E8)' },
                  { id: 'expired', label: 'Expired (00:00)' },
                  { id: 'cancelled', label: 'Cancelled' },
                ] as const
              ).map((preset) => (
                <Button
                  key={preset.id}
                  type="button"
                  size="sm"
                  variant={status === preset.id ? 'default' : 'outline'}
                  onClick={() => {
                    setStatus(preset.id);
                    if (preset.id === 'held' && remainingSeconds === 0) {
                      setRemainingSeconds(900);
                    }
                  }}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Time Scrubber */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            <div className="md:col-span-8 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-[#64748B]">
                  Remaining hold window: <strong>{remainingSeconds}s</strong> / 900s
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRemainingSeconds(900)}
                    className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-[#111827]"
                  >
                    15:00
                  </button>
                  <button
                    type="button"
                    onClick={() => setRemainingSeconds(450)}
                    className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-[#111827]"
                  >
                    07:30
                  </button>
                  <button
                    type="button"
                    onClick={() => setRemainingSeconds(90)}
                    className="px-2 py-0.5 rounded bg-red-50 hover:bg-red-100 text-[#EF4444]"
                  >
                    01:30 (Urgent)
                  </button>
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={900}
                step={5}
                value={remainingSeconds}
                onChange={(e) => setRemainingSeconds(Number(e.target.value))}
                className="w-full accent-[#6258E8] cursor-pointer"
                aria-label="Hold remaining seconds"
              />
            </div>

            <div className="md:col-span-4 flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAutoTick((prev) => !prev)}
              >
                <AppIcon name="timer" className="text-[16px]" />
                {autoTick ? 'Pause Live Tick' : 'Resume Live Tick'}
              </Button>
            </div>
          </div>

          {/* Live Light & Dark Previews */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
            <div className="space-y-2">
              <span className="text-xs font-mono font-semibold text-[#64748B] uppercase">
                1. Light Surface (/b/[slug] &amp; Owner Dashboard)
              </span>
              <HoldBand
                status={status}
                remainingSeconds={remainingSeconds}
                totalSeconds={900}
                autoTick={autoTick}
                theme="light"
                reference="sb_dep_01JFADEREP98K2"
                onExpire={() => setStatus('expired')}
              />
            </div>

            <div className="space-y-2">
              <span className="text-xs font-mono font-semibold text-[#64748B] uppercase">
                2. Midnight Surface (#101827 /chaos Projector Mode)
              </span>
              <HoldBand
                status={status}
                remainingSeconds={remainingSeconds}
                totalSeconds={900}
                autoTick={autoTick}
                theme="dark"
                reference="sb_dep_01JFADEREP98K2"
                onExpire={() => setStatus('expired')}
              />
            </div>
          </div>
        </section>

        {/* All Static Reference Variants */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-[#111827]">All Canonical States</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-xl border border-[#E5E7EB] space-y-2">
              <p className="text-xs font-semibold text-[#64748B]">
                Held · Fresh 15-minute slot lock (14:25 remaining)
              </p>
              <HoldBand
                status="held"
                remainingSeconds={865}
                totalSeconds={900}
                reference="sb_dep_01JFADE001"
              />
            </div>

            <div className="bg-white p-4 rounded-xl border border-[#E5E7EB] space-y-2">
              <p className="text-xs font-semibold text-[#64748B]">
                Held · Final 2 minutes warning (01:15 remaining)
              </p>
              <HoldBand
                status="held"
                remainingSeconds={75}
                totalSeconds={900}
                reference="sb_dep_01JFADE002"
              />
            </div>

            <div className="bg-white p-4 rounded-xl border border-[#E5E7EB] space-y-2">
              <p className="text-xs font-semibold text-[#64748B]">
                Pending Verification · Timeout ≠ failure (Invariant I7)
              </p>
              <HoldBand
                status="pending_verification"
                remainingSeconds={540}
                totalSeconds={900}
                reference="sb_dep_01JFADE003"
              />
            </div>

            <div className="bg-white p-4 rounded-xl border border-[#E5E7EB] space-y-2">
              <p className="text-xs font-semibold text-[#64748B]">
                Confirmed · Kora charge.success + re-verify (Invariant I2)
              </p>
              <HoldBand
                status="confirmed"
                remainingSeconds={900}
                totalSeconds={900}
                reference="sb_dep_01JFADE004"
              />
            </div>
          </div>
        </section>

        {/* Phase 2: Kora Deposit Card Harness */}
        <section className="bg-white rounded-2xl border border-[#E5E7EB] p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-[#111827]">
                Phase 2 · Kora Bank-Transfer Deposit Card
              </h2>
              <p className="text-xs text-[#64748B]">
                Exercises bank details, Copy account number, exact amount, 3s polling, and Confirmed
                / Underpaid / Expired states.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                type="button"
                size="sm"
                variant={merchantBearsCost ? 'default' : 'outline'}
                onClick={() => setMerchantBearsCost((prev) => !prev)}
              >
                {merchantBearsCost ? 'Merchant bears fee' : 'Customer pays Kora fee'}
              </Button>
              {(['held', 'underpaid', 'pending_verification', 'confirmed', 'expired'] as const).map(
                (st) => (
                  <Button
                    key={st}
                    type="button"
                    size="sm"
                    variant={depositCardStatus === st ? 'default' : 'outline'}
                    onClick={() => setDepositCardStatus(st)}
                  >
                    {st}
                  </Button>
                ),
              )}
            </div>
          </div>

          <div className="max-w-lg">
            <DepositCard
              reference="sb_dep_01JFADEREP98K2"
              businessName="Fade Republic"
              customerName="Tobi A."
              customerPhone="+234 803 123 4567"
              baseDepositKobo={baseDepositKobo}
              koraFeeKobo={koraFeeKobo}
              amountExpectedKobo={expectedKobo}
              amountPaidKobo={depositCardStatus === 'underpaid' ? 90_000 : 0}
              merchantBearsCost={merchantBearsCost}
              initialStatus={depositCardStatus}
              remainingSeconds={depositCardStatus === 'expired' ? 0 : 840}
              freeCancelHours={4}
              enablePolling={false}
              onStatusChange={(next) => setDepositCardStatus(next)}
              onPickDifferentSlot={() => setDepositCardStatus('held')}
            />
          </div>
        </section>
      </main>
    </div>
  );
}
