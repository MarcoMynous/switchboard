'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { computeKoraFeeKobo } from '@/components/DepositCard';
import { formatNairaFromKobo, useDashboard } from '../DashboardContext';

interface PaymentTransactionItem {
  id: string;
  bookingId: string | null;
  provider: 'kora' | 'interledger';
  providerEnvironment: string;
  reference: string;
  amountKobo: number;
  assetCode: string;
  assetScale: number;
  providerExpectedAmount: string | null;
  providerReceivedAmount: string | null;
  isSimulated: boolean;
  status: string;
  createdAt: string;
  customerName: string | null;
  serviceName: string | null;
  recoveryStatus: string | null;
}

interface PaymentsSummary {
  koraVerifiedKobo: number;
  interledgerByAsset: Array<{
    assetCode: string;
    assetScale: number;
    realMinor: string;
    simulatedMinor: string;
  }>;
}

function formatProviderMinor(value: string, assetCode: string, assetScale: number): string {
  const num = Number(value) / 10 ** assetScale;
  return `${num.toLocaleString('en-US', {
    minimumFractionDigits: Math.min(assetScale, 2),
    maximumFractionDigits: assetScale,
  })} ${assetCode}`;
}

export function PaymentsSettingsView({ title = 'Payments' }: { title?: string }) {
  const {
    workspace,
    setWorkspace,
    savingPaymentSettings,
    paymentSaveNotice,
    handleSavePaymentSettings,
  } = useDashboard();

  const [providerFilter, setProviderFilter] = useState<'all' | 'kora' | 'interledger'>('all');
  const [transactions, setTransactions] = useState<PaymentTransactionItem[]>([]);
  const [summary, setSummary] = useState<PaymentsSummary>({
    koraVerifiedKobo: 0,
    interledgerByAsset: [],
  });
  const [loadingTx, setLoadingTx] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoadingTx(true);
    const qs = providerFilter === 'all' ? '' : `?provider=${providerFilter}`;
    fetch(`/api/payments${qs}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then(
        (data: {
          ok?: boolean;
          transactions?: PaymentTransactionItem[];
          summary?: PaymentsSummary;
        }) => {
          if (cancelled || !data.ok) return;
          setTransactions(data.transactions ?? []);
          if (data.summary) setSummary(data.summary);
        },
      )
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingTx(false);
      });
    return () => {
      cancelled = true;
    };
  }, [providerFilter]);

  return (
    <div
      data-tour="kora-payment-status"
      className="bg-surface rounded-xl p-6 sm:p-8 border border-border space-y-6"
    >
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{title}</h1>
          <p className="text-sm text-text-secondary mt-1">
            Persisted configuration for {workspace.businessName} ({workspace.timezone})
          </p>
        </div>
        <Link
          href="/onboarding"
          className="px-4 py-2 rounded-lg bg-primary-container text-white text-xs font-semibold hover:bg-primary"
        >
          Edit in Setup Wizard
        </Link>
      </div>

      <div className="space-y-6">
        {/* Phase 2: Business-wide Kora Fee & Free-Cancel Window */}
        <div data-tour="payments-kora-settings" className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-border bg-surface-container-low/50 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-text-primary">Who bears the Kora fee</h3>
                <p className="text-xs text-text-secondary">
                  Sets <code>merchant_bears_cost</code> on virtual bank-transfer charges
                </p>
              </div>
              <span className="px-2 py-0.5 rounded bg-secondary-container text-[10px] font-mono font-bold text-on-secondary-fixed">
                KORA
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setWorkspace((prev) => ({ ...prev, merchantBearsCost: false }))}
                className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                  !workspace.merchantBearsCost
                    ? 'border-primary-container bg-white ring-2 ring-primary-container/30'
                    : 'border-border bg-white/70 hover:bg-white'
                }`}
              >
                <p className="text-xs font-bold text-text-primary">Customer pays fee</p>
                <p className="text-[11px] text-text-secondary mt-0.5">
                  Adds{' '}
                  {formatNairaFromKobo(computeKoraFeeKobo((workspace.depositAmount || 1500) * 100))}{' '}
                  to ₦{(workspace.depositAmount || 1500).toLocaleString()}
                </p>
              </button>

              <button
                type="button"
                onClick={() => setWorkspace((prev) => ({ ...prev, merchantBearsCost: true }))}
                className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                  workspace.merchantBearsCost
                    ? 'border-primary-container bg-white ring-2 ring-primary-container/30'
                    : 'border-border bg-white/70 hover:bg-white'
                }`}
              >
                <p className="text-xs font-bold text-text-primary">Business absorbs fee</p>
                <p className="text-[11px] text-text-secondary mt-0.5">
                  Customer transfers exact ₦{(workspace.depositAmount || 1500).toLocaleString()}
                </p>
              </button>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-border bg-surface-container-low/50 space-y-3">
            <div>
              <h3 className="text-sm font-bold text-text-primary">
                Default free-cancel refund window
              </h3>
              <p className="text-xs text-text-secondary">
                Cancellations inside this window receive an automatic Kora refund
              </p>
            </div>

            <div className="flex items-center gap-3">
              <select
                aria-label="Default free cancellation window in hours"
                value={workspace.freeCancelHours ?? 4}
                onChange={(e) => {
                  const hours = Number(e.target.value);
                  setWorkspace((prev) => ({
                    ...prev,
                    freeCancelHours: hours,
                    cancellationPolicy: `Full refund if cancelled at least ${hours} hours before your scheduled slot.`,
                  }));
                }}
                className="flex-1 px-3 py-2 rounded-lg border border-border bg-white text-sm font-semibold text-text-primary outline-none cursor-pointer"
              >
                <option value={2}>2 hours before slot</option>
                <option value={4}>4 hours before slot (Recommended)</option>
                <option value={12}>12 hours before slot</option>
                <option value={24}>24 hours before slot</option>
                <option value={48}>48 hours before slot</option>
              </select>
            </div>
          </div>
        </div>

        {/* Phase 2: Per-Service Deposit Rule Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-base font-bold text-text-primary">Deposit rule per service</h3>
              <p className="text-xs text-text-secondary">
                Configure fixed Naira, percentage, full upfront, or no-deposit (direct confirmation)
                per service.
              </p>
            </div>
            <button
              type="button"
              disabled={savingPaymentSettings}
              onClick={() => void handleSavePaymentSettings()}
              className="px-4 py-2 rounded-lg bg-primary-container text-white text-xs font-semibold hover:bg-primary transition-colors cursor-pointer disabled:opacity-60"
            >
              {savingPaymentSettings ? 'Saving rules...' : 'Save payment settings'}
            </button>
          </div>

          {paymentSaveNotice && (
            <div className="px-3.5 py-2 rounded-lg bg-success/10 border border-success/30 text-xs font-medium text-success-strong">
              {paymentSaveNotice}
            </div>
          )}

          <div className="rounded-xl border border-border divide-y divide-border overflow-hidden bg-white">
            {workspace.services.map((svc, idx) => {
              const rule = svc.depositType ?? (svc.depositRequired === false ? 'none' : 'fixed');
              return (
                <div
                  key={svc.id}
                  className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-3 items-center"
                >
                  <div className="lg:col-span-4">
                    <p className="text-sm font-semibold text-text-primary">{svc.name}</p>
                    <p className="text-xs font-mono text-text-secondary">
                      ₦{svc.price.toLocaleString()} • {svc.duration} mins
                    </p>
                  </div>

                  <div className="lg:col-span-3">
                    <label
                      htmlFor={`dep-rule-${svc.id}`}
                      className="text-[11px] font-mono text-text-secondary block mb-1"
                    >
                      Deposit type
                    </label>
                    <select
                      id={`dep-rule-${svc.id}`}
                      value={rule}
                      onChange={(e) => {
                        const nextRule = e.target.value as 'fixed' | 'percent' | 'full' | 'none';
                        setWorkspace((prev) => {
                          const updated = [...prev.services];
                          const current = updated[idx];
                          if (current) {
                            updated[idx] = {
                              ...current,
                              depositType: nextRule,
                              depositRequired: nextRule !== 'none',
                              depositAmount:
                                nextRule === 'none'
                                  ? 0
                                  : nextRule === 'full'
                                    ? current.price
                                    : nextRule === 'percent'
                                      ? Math.min(100, current.depositValue || 30)
                                      : current.depositAmount || 1500,
                              depositValue:
                                nextRule === 'percent'
                                  ? Math.min(100, current.depositValue || 30)
                                  : undefined,
                            };
                          }
                          return { ...prev, services: updated };
                        });
                      }}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-surface text-xs font-semibold text-text-primary outline-none cursor-pointer"
                    >
                      <option value="fixed">Fixed amount (₦)</option>
                      <option value="percent">Percentage (%)</option>
                      <option value="full">Full price upfront</option>
                      <option value="none">No deposit (direct confirm)</option>
                    </select>
                  </div>

                  <div className="lg:col-span-3">
                    <label
                      htmlFor={`dep-val-${svc.id}`}
                      className="text-[11px] font-mono text-text-secondary block mb-1"
                    >
                      {rule === 'percent'
                        ? 'Percentage (%)'
                        : rule === 'fixed'
                          ? 'Deposit (₦)'
                          : 'Calculated deposit'}
                    </label>
                    {rule === 'fixed' || rule === 'percent' ? (
                      <input
                        id={`dep-val-${svc.id}`}
                        type="number"
                        min={rule === 'percent' ? 5 : 0}
                        max={rule === 'percent' ? 100 : svc.price}
                        step={rule === 'percent' ? 5 : 500}
                        value={
                          rule === 'percent'
                            ? (svc.depositValue ?? svc.depositAmount ?? 30)
                            : svc.depositAmount
                        }
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setWorkspace((prev) => {
                            const updated = [...prev.services];
                            const current = updated[idx];
                            if (current) {
                              updated[idx] = {
                                ...current,
                                depositAmount: val,
                                depositValue: rule === 'percent' ? val : undefined,
                              };
                            }
                            return { ...prev, services: updated };
                          });
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-white text-xs font-mono font-bold text-text-primary outline-none"
                      />
                    ) : (
                      <div className="px-2.5 py-1.5 rounded-lg border border-border bg-surface-container-low text-xs font-mono text-text-secondary">
                        {rule === 'full'
                          ? `₦${svc.price.toLocaleString()} (100%)`
                          : '₦0 (Instant confirm)'}
                      </div>
                    )}
                  </div>

                  <div className="lg:col-span-2">
                    <label
                      htmlFor={`cancel-hrs-${svc.id}`}
                      className="text-[11px] font-mono text-text-secondary block mb-1"
                    >
                      Free cancel
                    </label>
                    <select
                      id={`cancel-hrs-${svc.id}`}
                      value={svc.freeCancelHours ?? workspace.freeCancelHours ?? 4}
                      onChange={(e) => {
                        const hrs = Number(e.target.value);
                        setWorkspace((prev) => {
                          const updated = [...prev.services];
                          const current = updated[idx];
                          if (current) {
                            updated[idx] = { ...current, freeCancelHours: hrs };
                          }
                          return { ...prev, services: updated };
                        });
                      }}
                      className="w-full px-2 py-1.5 rounded-lg border border-border bg-surface text-xs font-mono text-text-primary outline-none cursor-pointer"
                    >
                      <option value={2}>2h</option>
                      <option value={4}>4h</option>
                      <option value={12}>12h</option>
                      <option value={24}>24h</option>
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Provider-Separated Reporting & Transactions Ledger */}
        <div className="space-y-4 pt-4 border-t border-border">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-text-primary">Transactions</h2>
              <p className="text-xs text-text-secondary">
                Verified deposits separated by provider, currency, and testnet simulation status.
              </p>
            </div>
            <div className="flex items-center gap-1.5 bg-surface-container-low p-1 rounded-lg border border-border">
              {(['all', 'kora', 'interledger'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setProviderFilter(f)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                    providerFilter === f
                      ? 'bg-[#22306B] text-white'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {f === 'all' ? 'All Providers' : f === 'kora' ? 'Kora' : 'Interledger'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-4 rounded-xl border border-border bg-white">
              <p className="text-[11px] font-semibold uppercase text-text-secondary">
                Kora Verified Deposits (NGN)
              </p>
              <p className="text-xl font-bold text-text-primary mt-1">
                {formatNairaFromKobo(summary.koraVerifiedKobo)}
              </p>
            </div>
            <div className="p-4 rounded-xl border border-border bg-white">
              <p className="text-[11px] font-semibold uppercase text-text-secondary">
                Interledger Verified (Real)
              </p>
              <p className="text-xl font-bold text-text-primary mt-1">
                {summary.interledgerByAsset.some((a) => BigInt(a.realMinor) > 0n)
                  ? summary.interledgerByAsset
                      .filter((a) => BigInt(a.realMinor) > 0n)
                      .map((a) => formatProviderMinor(a.realMinor, a.assetCode, a.assetScale))
                      .join(' · ')
                  : '0.00 (Production disabled)'}
              </p>
            </div>
            <div className="p-4 rounded-xl border border-[#F5B700]/40 bg-[#F5B700]/5">
              <p className="text-[11px] font-semibold uppercase text-[#7A5900]">
                Interledger Test Wallet (Simulated)
              </p>
              <p className="text-xl font-bold text-[#7A5900] mt-1">
                {summary.interledgerByAsset.some((a) => BigInt(a.simulatedMinor) > 0n)
                  ? summary.interledgerByAsset
                      .filter((a) => BigInt(a.simulatedMinor) > 0n)
                      .map((a) => formatProviderMinor(a.simulatedMinor, a.assetCode, a.assetScale))
                      .join(' · ')
                  : '0.00 USD (Simulated)'}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border overflow-x-auto bg-white">
            {loadingTx ? (
              <p className="p-4 text-xs text-text-secondary">Loading payment transactions…</p>
            ) : transactions.length === 0 ? (
              <p className="p-4 text-xs text-text-secondary">
                No payment transactions recorded for this filter yet.
              </p>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-container-low border-b border-border text-text-secondary uppercase text-[10px]">
                  <tr>
                    <th className="px-4 py-2.5">Customer & Booking</th>
                    <th className="px-4 py-2.5">Provider</th>
                    <th className="px-4 py-2.5">Amount & Asset</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5">Reference</th>
                    <th className="px-4 py-2.5">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {transactions.map((tx) => (
                    <tr key={tx.id}>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-text-primary">
                          {tx.customerName ?? 'Customer'}
                        </p>
                        <p className="text-[11px] text-text-secondary">
                          {tx.serviceName ?? tx.bookingId ?? '—'}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-text-primary">
                          {tx.provider === 'interledger' ? 'Interledger Open Payments' : 'Kora'}
                        </span>
                        {tx.isSimulated && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded bg-[#F5B700]/20 text-[#7A5900] text-[10px] font-semibold">
                            Simulated
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono">
                        {tx.provider === 'interledger' && tx.providerExpectedAmount
                          ? formatProviderMinor(
                              tx.providerReceivedAmount ?? tx.providerExpectedAmount,
                              tx.assetCode,
                              tx.assetScale,
                            )
                          : formatNairaFromKobo(tx.amountKobo)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 font-semibold">
                          {tx.status}
                        </span>
                        {tx.recoveryStatus && (
                          <p className="text-[10px] text-amber-700 mt-0.5">{tx.recoveryStatus}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-text-secondary">
                        {tx.reference}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {new Date(tx.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
