'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

function SandboxConsentContent() {
  const params = useSearchParams();
  const callback = params.get('callback') ?? '';
  const interactRef = params.get('interact_ref') ?? 'ilp_ref_sim';
  const amount = params.get('amount') ?? '0';
  const assetCode = params.get('assetCode') ?? 'USD';
  const assetScale = Number(params.get('assetScale') ?? '2');
  const wallet = params.get('wallet') ?? 'https://ilp.interledger-test.dev/customer';

  const [submitting, setSubmitting] = useState(false);

  const formattedAmount = `${(Number(amount) / 10 ** assetScale).toLocaleString('en-US', {
    minimumFractionDigits: Math.min(assetScale, 2),
    maximumFractionDigits: assetScale,
  })} ${assetCode}`;

  const handleApprove = () => {
    if (!callback) return;
    setSubmitting(true);
    const target = new URL(callback);
    target.searchParams.set('interact_ref', interactRef);
    window.location.assign(target.toString());
  };

  const handleReject = () => {
    if (!callback) return;
    setSubmitting(true);
    const target = new URL(callback);
    target.searchParams.set('result', 'grant_rejected');
    window.location.assign(target.toString());
  };

  return (
    <main className="min-h-screen bg-[#F5F6FA] flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-sm p-6 space-y-5">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#22306B]">
              Interledger Test Wallet
            </p>
            <h1 className="text-lg font-bold text-[#111827] mt-0.5">Authorize Payment Grant</h1>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-[#F5B700]/20 text-[#7A5900] text-[11px] font-semibold">
            Testnet · Simulated
          </span>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          Switchboard is requesting a one-time outgoing payment grant from your Interledger wallet
          to complete your booking deposit.
        </p>

        <div className="rounded-xl bg-[#F5F6FA] border border-slate-200 p-4 space-y-2 text-xs">
          <div className="flex justify-between gap-2">
            <span className="text-slate-500">Sender Wallet</span>
            <span className="font-mono text-[#111827] truncate">{wallet}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-slate-500">Maximum Debit</span>
            <span className="font-bold text-[#22306B] text-sm">{formattedAmount}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-slate-500">Scope</span>
            <span className="font-semibold text-[#111827]">Single outgoing-payment create</span>
          </div>
        </div>

        {!callback ? (
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
            Missing callback URL. Please start payment authorization from the Switchboard booking
            page.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              disabled={submitting}
              onClick={handleReject}
              className="py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer disabled:opacity-60"
            >
              Reject
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleApprove}
              className="py-2.5 rounded-xl bg-[#22306B] hover:bg-[#192350] text-white text-xs font-bold cursor-pointer disabled:opacity-60"
            >
              {submitting ? 'Authorizing…' : `Approve & Pay ${formattedAmount}`}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

export default function SandboxAuthorizePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F5F6FA] flex items-center justify-center text-xs text-slate-500">
          Loading Interledger Wallet consent…
        </div>
      }
    >
      <SandboxConsentContent />
    </Suspense>
  );
}
