'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { AppIcon } from '@/components/AppIcon';
import { formatNairaFromKobo } from '@/components/DepositCard';
import { SwitchboardIconSvg } from '@/components/SwitchboardLogo';

interface ReceiptApiResponse {
  paymentId: string;
  reference: string | null;
  paymentStatus: string;
  bookingStatus: string | null;
  isSimulated: boolean;
  amountKobo: number;
  assetCode: string;
  assetScale: number;
  expectedAmount: string | null;
  receivedAmount: string | null;
  quoteDebitAmount: string | null;
  quoteDebitAssetCode: string | null;
  quoteDebitAssetScale: number | null;
  incomingPaymentId: string | null;
  outgoingPaymentId: string | null;
  createdAt: string;
  verifiedAt: string | null;
  receipt?: {
    businessName: string;
    businessLocation: string | null;
    timezone: string;
    serviceName: string | null;
    staffName: string | null;
    customerName: string | null;
    startsAt: string | null;
    endsAt: string | null;
  };
  error?: { message?: string };
}

function formatMinor(value: string | null, code: string | null, scale: number | null): string {
  if (!value || !code) return '—';
  const s = scale ?? 2;
  const num = Number(value) / 10 ** s;
  return `${num.toLocaleString('en-US', {
    minimumFractionDigits: Math.min(s, 2),
    maximumFractionDigits: s,
  })} ${code}`;
}

function formatDateTimeInTz(iso: string | null, tz = 'Africa/Lagos'): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('en-NG', {
      timeZone: tz,
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function ReceiptContent() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? 'fade-republic';
  const searchParams = useSearchParams();
  const paymentId = searchParams.get('paymentId');

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReceiptApiResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!paymentId) {
      setErrorMsg('Missing payment reference.');
      setLoading(false);
      return;
    }

    let cancelled = false;
    fetch(
      `/api/public/${encodeURIComponent(slug)}/payments/interledger/${encodeURIComponent(paymentId)}/status`,
      { cache: 'no-store' },
    )
      .then((r) => r.json())
      .then((res: ReceiptApiResponse) => {
        if (cancelled) return;
        if (!res.paymentId) {
          setErrorMsg(res.error?.message ?? 'Receipt not found.');
        } else {
          setData(res);
        }
      })
      .catch(() => {
        if (!cancelled) setErrorMsg('Could not load payment receipt.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [paymentId, slug]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F5F6FA] flex items-center justify-center p-4">
        <p className="text-sm font-medium text-[#22306B]">Loading verified booking receipt…</p>
      </main>
    );
  }

  if (errorMsg || !data) {
    return (
      <main className="min-h-screen bg-[#F5F6FA] flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-6 text-center space-y-4">
          <p className="text-sm font-semibold text-slate-900">{errorMsg ?? 'Receipt not found'}</p>
          <Link
            href={`/b/${encodeURIComponent(slug)}`}
            className="inline-block px-4 py-2.5 rounded-xl bg-[#22306B] text-white text-xs font-semibold"
          >
            Back to booking page
          </Link>
        </div>
      </main>
    );
  }

  const isConfirmed = data.paymentStatus === 'succeeded' && data.bookingStatus === 'confirmed';
  const tz = data.receipt?.timezone ?? 'Africa/Lagos';

  return (
    <main className="min-h-screen bg-[#F5F6FA] py-10 px-4">
      <div className="max-w-lg mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <Link
            href={`/b/${encodeURIComponent(slug)}`}
            className="inline-flex items-center gap-2 text-xs font-semibold text-[#22306B] hover:underline"
          >
            <SwitchboardIconSvg className="w-5 h-5" />
            <span>{data.receipt?.businessName ?? 'Switchboard'}</span>
          </Link>
          {data.isSimulated && (
            <span className="px-2.5 py-1 rounded-full bg-[#F5B700]/20 text-[#7A5900] text-[11px] font-bold">
              Test Money · Interledger Testnet
            </span>
          )}
        </div>

        <div className="rounded-2xl bg-white border border-slate-200 shadow-xs overflow-hidden">
          <div
            className={`px-6 py-5 border-b ${
              isConfirmed
                ? 'bg-emerald-50/70 border-emerald-200'
                : 'bg-amber-50/70 border-amber-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  isConfirmed ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'
                }`}
              >
                <AppIcon name={isConfirmed ? 'check_circle' : 'schedule'} className="text-xl" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-[#111827]">
                  {isConfirmed ? 'Booking Confirmed & Paid' : 'Payment Verification Pending'}
                </h1>
                <p className="text-xs text-slate-600 mt-0.5">
                  {isConfirmed
                    ? 'Switchboard independently verified receipt on the business Interledger wallet.'
                    : 'Your payment is still being verified before confirming the appointment.'}
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-5 text-xs">
            {/* Appointment Details */}
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#22306B]">
                Appointment Details
              </p>
              <div className="rounded-xl bg-[#F5F6FA] border border-slate-200/80 p-3.5 space-y-2">
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Business</span>
                  <span className="font-semibold text-[#111827]">
                    {data.receipt?.businessName ?? '—'}
                  </span>
                </div>
                {data.receipt?.businessLocation && (
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Location</span>
                    <span className="font-medium text-slate-700 text-right">
                      {data.receipt.businessLocation}
                    </span>
                  </div>
                )}
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Customer</span>
                  <span className="font-semibold text-[#111827]">
                    {data.receipt?.customerName ?? '—'}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Service</span>
                  <span className="font-semibold text-[#111827]">
                    {data.receipt?.serviceName ?? '—'}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Staff</span>
                  <span className="font-semibold text-[#111827]">
                    {data.receipt?.staffName ?? 'Any available staff'}
                  </span>
                </div>
                <div className="flex justify-between gap-2 pt-1 border-t border-slate-200/80">
                  <span className="text-slate-500">Booking Time</span>
                  <span className="font-bold text-[#22306B]">
                    {formatDateTimeInTz(data.receipt?.startsAt ?? null, tz)} (WAT)
                  </span>
                </div>
              </div>
            </div>

            {/* Payment Receipt */}
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#22306B]">
                Payment Receipt
              </p>
              <div className="rounded-xl bg-white border border-slate-200 p-3.5 space-y-2">
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Payment Method</span>
                  <span className="font-semibold text-[#111827]">Interledger Open Payments</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Order / Paid Time</span>
                  <span className="font-semibold text-[#111827]">
                    {formatDateTimeInTz(data.verifiedAt ?? data.createdAt, tz)}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Booking Deposit Obligation</span>
                  <span className="font-semibold text-[#111827]">
                    {formatNairaFromKobo(data.amountKobo)}
                  </span>
                </div>
                {data.quoteDebitAmount && data.quoteDebitAssetCode && (
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Wallet Debited</span>
                    <span className="font-bold text-[#111827]">
                      {formatMinor(
                        data.quoteDebitAmount,
                        data.quoteDebitAssetCode,
                        data.quoteDebitAssetScale,
                      )}
                    </span>
                  </div>
                )}
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Business Received</span>
                  <span className="font-bold text-emerald-700">
                    {formatMinor(
                      data.receivedAmount ?? data.expectedAmount,
                      data.assetCode,
                      data.assetScale,
                    )}
                  </span>
                </div>
                <div className="flex justify-between gap-2 pt-1 border-t border-slate-100">
                  <span className="text-slate-500">Reference</span>
                  <span className="font-mono text-[11px] text-slate-700">
                    {data.reference ?? data.paymentId}
                  </span>
                </div>
                {data.outgoingPaymentId && (
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500 shrink-0">Outgoing Payment</span>
                    <span className="font-mono text-[10px] text-slate-500 truncate max-w-[240px]">
                      {data.outgoingPaymentId}
                    </span>
                  </div>
                )}
                {data.incomingPaymentId && (
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500 shrink-0">Incoming Payment</span>
                    <span className="font-mono text-[10px] text-slate-500 truncate max-w-[240px]">
                      {data.incomingPaymentId}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-1">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-[#111827] cursor-pointer"
              >
                Print receipt
              </button>
              <Link
                href={`/b/${encodeURIComponent(slug)}`}
                className="flex-1 py-2.5 rounded-xl bg-[#22306B] hover:bg-[#192350] text-white text-xs font-semibold text-center"
              >
                Book another appointment
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function InterledgerReceiptPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F5F6FA] flex items-center justify-center text-xs text-slate-500">
          Loading receipt…
        </div>
      }
    >
      <ReceiptContent />
    </Suspense>
  );
}
