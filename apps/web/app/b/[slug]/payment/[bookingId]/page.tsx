'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { AppIcon } from '@/components/AppIcon';
import { formatNairaFromKobo } from '@/components/DepositCard';
import { SwitchboardIconSvg } from '@/components/SwitchboardLogo';

type PaymentScreenState =
  | 'preparing_checkout'
  | 'awaiting_wallet_address'
  | 'getting_quote'
  | 'ready_to_authorize'
  | 'awaiting_wallet_approval'
  | 'processing_payment'
  | 'verifying_payment'
  | 'booking_confirmed'
  | 'payment_failed'
  | 'hold_expired'
  | 'requires_attention';

interface AuthoritativeBookingResponse {
  business: {
    id: string;
    name: string;
    slug: string;
    location: string | null;
    timezone: string;
    interledgerPaymentEnabled?: boolean;
    interledgerEnvironment?: 'testnet' | 'production';
    interledgerWalletAddress?: string | null;
  };
  booking: {
    id: string;
    reference: string;
    status: string;
    startsAt: string;
    endsAt: string;
    holdExpiresAt: string | null;
    service: {
      id: string;
      name: string;
      durationMin: number;
      priceKobo: number;
      depositType: string;
      depositKobo: number;
      freeCancelHours: number;
    } | null;
    staff: { id: string; name: string } | null;
    customer: { name: string; phoneMasked: string | null } | null;
  };
  payment: {
    id: string;
    provider: string;
    reference: string | null;
    status: string;
    isSimulated: boolean;
    amountKobo: number;
    assetCode: string;
    assetScale: number;
    expectedAmount: string | null;
    receivedAmount: string | null;
    verifiedAt: string | null;
    attempt: {
      grantState: string;
      senderWalletAddress: string;
      recipientWalletAddress: string;
      incomingPaymentId: string | null;
      outgoingPaymentId: string | null;
      quoteId: string | null;
      quoteDebitAmount: string | null;
      quoteDebitAssetCode: string | null;
      quoteDebitAssetScale: number | null;
      quoteReceiveAmount: string | null;
      quoteExpiresAt: string | null;
      lastErrorCode: string | null;
      lastErrorMessage: string | null;
    } | null;
  } | null;
}

interface PreparedQuoteState {
  paymentId: string;
  reference: string;
  isSimulated: boolean;
  expectedAmount: { value: string; assetCode: string; assetScale: number };
  isCrossCurrency: boolean;
  conversionRateUsed: number | null;
  quote: {
    id: string;
    debitAmount: { value: string; assetCode: string; assetScale: number };
    receiveAmount: { value: string; assetCode: string; assetScale: number };
    expiresAt: string | null;
  };
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

function formatDateTime(iso: string, tz = 'Africa/Lagos'): string {
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

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const STATE_BADGE: Record<PaymentScreenState, { label: string; className: string }> = {
  preparing_checkout: {
    label: 'Preparing Checkout',
    className: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  awaiting_wallet_address: {
    label: 'Awaiting Wallet Address',
    className: 'bg-[#F5F6FA] text-[#22306B] border-[#22306B]/20',
  },
  getting_quote: {
    label: 'Getting Quote',
    className: 'bg-[#22306B]/10 text-[#22306B] border-[#22306B]/20',
  },
  ready_to_authorize: {
    label: 'Ready to Authorize',
    className: 'bg-[#F5B700]/20 text-[#7A5900] border-[#F5B700]/40',
  },
  awaiting_wallet_approval: {
    label: 'Awaiting Wallet Approval',
    className: 'bg-[#F5B700]/20 text-[#7A5900] border-[#F5B700]/40',
  },
  processing_payment: {
    label: 'Processing Payment',
    className: 'bg-[#22306B]/10 text-[#22306B] border-[#22306B]/20',
  },
  verifying_payment: {
    label: 'Verifying Payment',
    className: 'bg-[#22306B]/10 text-[#22306B] border-[#22306B]/20',
  },
  booking_confirmed: {
    label: 'Booking Confirmed',
    className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  payment_failed: {
    label: 'Payment Failed',
    className: 'bg-rose-50 text-rose-800 border-rose-200',
  },
  hold_expired: {
    label: 'Hold Expired',
    className: 'bg-slate-100 text-slate-700 border-slate-300',
  },
  requires_attention: {
    label: 'Requires Attention',
    className: 'bg-amber-50 text-amber-900 border-amber-300',
  },
};

function PaymentScreenContent() {
  const params = useParams<{ slug: string; bookingId: string }>();
  const slug = params?.slug ?? 'fade-republic';
  const bookingId = params?.bookingId ?? '';
  const searchParams = useSearchParams();
  const ilpPaymentParam = searchParams.get('ilp_payment');
  const ilpStatusParam = searchParams.get('ilp_status');
  const ilpReasonParam = searchParams.get('ilp_reason') ?? searchParams.get('ilp_code');

  const [data, setData] = useState<AuthoritativeBookingResponse | null>(null);
  const [screenState, setScreenState] = useState<PaymentScreenState>('preparing_checkout');
  const [walletInput, setWalletInput] = useState('');
  const [quoteState, setQuoteState] = useState<PreparedQuoteState | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(900);
  const [prepareKey, setPrepareKey] = useState<string>(() =>
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? `ilp_${crypto.randomUUID()}`
      : `ilp_${Date.now()}`,
  );

  const loadAuthoritativeBooking = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/public/${encodeURIComponent(slug)}/bookings/${encodeURIComponent(bookingId)}`,
        { cache: 'no-store' },
      );
      if (!res.ok) {
        setScreenState('requires_attention');
        setErrorMsg('Booking record could not be found.');
        return;
      }
      const json = (await res.json()) as AuthoritativeBookingResponse;
      setData(json);

      if (json.booking.holdExpiresAt) {
        setSecondsLeft(
          Math.max(
            0,
            Math.floor((new Date(json.booking.holdExpiresAt).getTime() - Date.now()) / 1000),
          ),
        );
      }

      if (json.booking.status === 'confirmed') {
        setScreenState('booking_confirmed');
        return;
      }
      if (json.booking.status === 'expired') {
        setScreenState('hold_expired');
        return;
      }

      const p = json.payment;
      if (p?.provider === 'interledger' && p.attempt) {
        setWalletInput((prev) => prev || p.attempt?.senderWalletAddress || '');
        if (p.status === 'pending_verification') {
          setScreenState('verifying_payment');
          return;
        }
        if (p.status === 'failed') {
          if (p.attempt.lastErrorCode === 'UNDERPAID') {
            setScreenState('requires_attention');
            setErrorMsg(
              p.attempt.lastErrorMessage ?? 'Payment received was less than the deposit.',
            );
          } else if (
            ilpStatusParam === 'rejected' ||
            p.attempt.lastErrorCode === 'GRANT_REJECTED'
          ) {
            setScreenState('awaiting_wallet_address');
            setErrorMsg(
              'Wallet authorization was cancelled. Your 15-minute hold is still active—you can try again.',
            );
          } else {
            setScreenState('payment_failed');
            setErrorMsg(p.attempt.lastErrorMessage ?? 'Payment authorization failed.');
          }
          return;
        }
        if (
          p.attempt.grantState === 'quoted' &&
          p.attempt.quoteId &&
          p.attempt.quoteDebitAmount &&
          p.attempt.quoteDebitAssetCode
        ) {
          const quoteExpired =
            p.attempt.quoteExpiresAt && new Date(p.attempt.quoteExpiresAt).getTime() <= Date.now();
          if (!quoteExpired) {
            setQuoteState({
              paymentId: p.id,
              reference: p.reference ?? p.id,
              isSimulated: p.isSimulated,
              expectedAmount: {
                value: p.expectedAmount ?? '0',
                assetCode: p.assetCode,
                assetScale: p.assetScale,
              },
              isCrossCurrency: p.attempt.quoteDebitAssetCode !== p.assetCode,
              conversionRateUsed: null,
              quote: {
                id: p.attempt.quoteId,
                debitAmount: {
                  value: p.attempt.quoteDebitAmount,
                  assetCode: p.attempt.quoteDebitAssetCode,
                  assetScale: p.attempt.quoteDebitAssetScale ?? 2,
                },
                receiveAmount: {
                  value: p.attempt.quoteReceiveAmount ?? p.expectedAmount ?? '0',
                  assetCode: p.assetCode,
                  assetScale: p.assetScale,
                },
                expiresAt: p.attempt.quoteExpiresAt,
              },
            });
            setScreenState('ready_to_authorize');
            return;
          }
        }
      }

      if (ilpStatusParam === 'rejected') {
        setErrorMsg('Wallet authorization was cancelled. Your slot hold remains active.');
      } else if (ilpStatusParam === 'error' || ilpStatusParam === 'invalid_state') {
        const detail = json.payment?.attempt?.lastErrorMessage;
        setErrorMsg(
          detail ??
            (ilpReasonParam
              ? `Authorization callback could not be verified (${ilpReasonParam}). Please request a new quote.`
              : 'Authorization callback could not be verified. Please request a new quote.'),
        );
      }

      setScreenState('awaiting_wallet_address');
    } catch {
      setScreenState('requires_attention');
      setErrorMsg('Network error loading booking state.');
    }
  }, [bookingId, ilpReasonParam, ilpStatusParam, slug]);

  useEffect(() => {
    void loadAuthoritativeBooking();
  }, [loadAuthoritativeBooking]);

  // 1-second hold countdown
  useEffect(() => {
    if (screenState === 'booking_confirmed' || screenState === 'hold_expired') return;
    if (!data?.booking.holdExpiresAt) return;
    const timer = setInterval(() => {
      const next = Math.max(
        0,
        Math.floor((new Date(data.booking.holdExpiresAt ?? '').getTime() - Date.now()) / 1000),
      );
      setSecondsLeft(next);
      if (next <= 0) {
        setScreenState('hold_expired');
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [data?.booking.holdExpiresAt, screenState]);

  // Poll authoritative DB state while verifying_payment
  useEffect(() => {
    if (screenState !== 'verifying_payment') return;
    const timer = setInterval(() => {
      void loadAuthoritativeBooking();
    }, 3000);
    return () => clearInterval(timer);
  }, [loadAuthoritativeBooking, screenState]);

  const handleGetQuote = async () => {
    if (!walletInput.trim()) {
      setErrorMsg(
        'Enter your Interledger wallet address (e.g. $ilp.interledger-test.dev/1ca580ac).',
      );
      return;
    }
    setErrorMsg(null);
    setScreenState('getting_quote');
    try {
      const res = await fetch(
        `/api/public/${encodeURIComponent(slug)}/payments/interledger/prepare`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookingId,
            customerWalletAddress: walletInput.trim(),
            idempotencyKey: prepareKey,
          }),
        },
      );
      const payload = (await res.json()) as PreparedQuoteState & {
        error?: { code?: string; message?: string };
      };
      if (!res.ok || !payload.quote) {
        setScreenState('awaiting_wallet_address');
        setErrorMsg(payload.error?.message ?? 'Unable to generate a quote for this wallet.');
        return;
      }
      setQuoteState(payload);
      setScreenState('ready_to_authorize');
    } catch {
      setScreenState('awaiting_wallet_address');
      setErrorMsg('Network error while requesting Open Payments quote.');
    }
  };

  const handleAuthorize = async () => {
    if (!quoteState) return;
    setErrorMsg(null);
    setScreenState('awaiting_wallet_approval');
    try {
      const res = await fetch(
        `/api/public/${encodeURIComponent(slug)}/payments/interledger/authorize`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentId: quoteState.paymentId }),
        },
      );
      const payload = (await res.json()) as {
        redirectUrl?: string;
        error?: { code?: string; message?: string };
      };
      if (!res.ok || !payload.redirectUrl) {
        setScreenState('ready_to_authorize');
        setErrorMsg(payload.error?.message ?? 'Could not initiate wallet authorization.');
        if (payload.error?.code === 'QUOTE_EXPIRED') {
          setQuoteState(null);
          setPrepareKey(`ilp_${Date.now()}`);
          setScreenState('awaiting_wallet_address');
        }
        return;
      }
      window.location.assign(payload.redirectUrl);
    } catch {
      setScreenState('ready_to_authorize');
      setErrorMsg('Network error while redirecting to wallet consent screen.');
    }
  };

  if (screenState === 'preparing_checkout' || !data) {
    return (
      <main className="min-h-screen bg-[#F5F6FA] flex items-center justify-center p-6">
        <div className="flex items-center gap-3 text-sm font-medium text-[#22306B]">
          <span className="w-4 h-4 rounded-full border-2 border-[#22306B] border-t-transparent animate-spin" />
          <span>Preparing secure Interledger checkout…</span>
        </div>
      </main>
    );
  }

  const { business, booking, payment } = data;
  const badge = STATE_BADGE[screenState];
  const priceKobo = booking.service?.priceKobo ?? 0;
  const depositKobo = booking.service?.depositKobo ?? 0;
  const remainingKobo = Math.max(0, priceKobo - depositKobo);
  const activePaymentId = quoteState?.paymentId ?? payment?.id ?? ilpPaymentParam;

  return (
    <div className="min-h-screen bg-[#F5F6FA] text-[#111827]">
      {/* Compact Header */}
      <header className="h-14 bg-white border-b border-slate-200/80 px-4 sm:px-6 flex items-center justify-between">
        <Link href={`/b/${encodeURIComponent(slug)}`} className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#22306B] text-white flex items-center justify-center shrink-0">
            <SwitchboardIconSvg className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-[#111827] truncate">{business.name}</p>
            <p className="text-[11px] text-slate-500">Interledger Checkout</p>
          </div>
        </Link>

        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F5B700]/20 text-[#7A5900] text-[11px] font-bold">
          Test Money
        </span>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* LEFT: Authoritative Booking & Deposit Summary */}
          <section className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h1 className="text-sm font-bold uppercase tracking-wider text-[#22306B]">
                Booking Summary
              </h1>
              {booking.status === 'held' && (
                <span className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-xs font-mono font-bold text-amber-900">
                  Hold {formatCountdown(secondsLeft)}
                </span>
              )}
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Business</span>
                <span className="font-semibold text-[#111827]">{business.name}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Service</span>
                <span className="font-semibold text-[#111827]">{booking.service?.name ?? '—'}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Staff</span>
                <span className="font-semibold text-[#111827]">
                  {booking.staff?.name ?? 'Anyone available'}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Date & Time</span>
                <span className="font-semibold text-[#111827]">
                  {formatDateTime(booking.startsAt, business.timezone)} (WAT)
                </span>
              </div>
              <div className="pt-2.5 border-t border-slate-100 flex justify-between gap-2">
                <span className="text-slate-500">Total Service Price</span>
                <span className="font-semibold text-[#111827]">
                  {formatNairaFromKobo(priceKobo)}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Deposit Required</span>
                <span className="font-bold text-[#22306B]">{formatNairaFromKobo(depositKobo)}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">Remaining at Venue</span>
                <span className="font-semibold text-slate-700">
                  {formatNairaFromKobo(remainingKobo)}
                </span>
              </div>
            </div>

            {depositKobo > 0 && (
              <p className="text-[11px] text-slate-500 bg-[#F5F6FA] rounded-xl p-3 border border-slate-200/70 leading-relaxed">
                This service is priced in NGN. For this demonstration, Switchboard settles an
                explicitly configured <strong>USD test deposit</strong> into the business&apos;s
                Interledger Test Wallet using <strong>Test Money</strong>.
              </p>
            )}
          </section>

          {/* RIGHT: Interledger Test Wallet Checkout Panel */}
          <section className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#22306B]">
                  Payment Method
                </p>
                <h2 className="text-lg font-bold text-[#111827] mt-0.5">Interledger Test Wallet</h2>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold border ${badge.className}`}
              >
                {badge.label}
              </span>
            </div>

            {screenState === 'booking_confirmed' ? (
              <div className="space-y-4">
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 flex items-start gap-3">
                  <AppIcon name="check_circle" className="text-emerald-700 text-2xl shrink-0" />
                  <div>
                    <h3 className="text-base font-bold text-emerald-900">Booking Confirmed</h3>
                    <p className="text-xs text-emerald-800 mt-0.5">
                      Switchboard independently verified receipt in the business&apos;s Interledger
                      Test Wallet (Test Money).
                    </p>
                  </div>
                </div>

                <div className="rounded-xl bg-[#F5F6FA] border border-slate-200 p-4 text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Booking Reference</span>
                    <span className="font-mono font-semibold text-[#111827]">
                      {payment?.reference ?? booking.reference}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Payment Method</span>
                    <span className="font-semibold text-[#111827]">
                      Interledger Test Wallet (Test Money)
                    </span>
                  </div>
                  {payment?.attempt?.quoteDebitAmount && payment.attempt.quoteDebitAssetCode && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Wallet Debited</span>
                      <span className="font-bold text-[#111827]">
                        {formatMinor(
                          payment.attempt.quoteDebitAmount,
                          payment.attempt.quoteDebitAssetCode,
                          payment.attempt.quoteDebitAssetScale,
                        )}
                      </span>
                    </div>
                  )}
                  {payment && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Verified Received</span>
                      <span className="font-bold text-emerald-700">
                        {formatMinor(
                          payment.receivedAmount ?? payment.expectedAmount,
                          payment.assetCode,
                          payment.assetScale,
                        )}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-3">
                  {activePaymentId && (
                    <Link
                      href={`/b/${encodeURIComponent(slug)}/receipt?paymentId=${encodeURIComponent(activePaymentId)}`}
                      className="flex-1 py-2.5 rounded-xl bg-[#22306B] hover:bg-[#192350] text-white text-xs font-semibold text-center"
                    >
                      View Full Receipt
                    </Link>
                  )}
                  <Link
                    href={`/b/${encodeURIComponent(slug)}`}
                    className="flex-1 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-[#111827] text-center"
                  >
                    Return to Business
                  </Link>
                </div>
              </div>
            ) : screenState === 'hold_expired' ? (
              <div className="space-y-4">
                <div className="rounded-xl bg-slate-100 border border-slate-300 p-4 text-xs text-slate-700">
                  <p className="font-bold text-slate-900">Your 15-minute hold has expired</p>
                  <p className="mt-1">
                    No payment was confirmed before the deadline, so this slot has been released.
                  </p>
                </div>
                <Link
                  href={`/b/${encodeURIComponent(slug)}`}
                  className="block w-full py-2.5 rounded-xl bg-[#22306B] text-white text-xs font-semibold text-center"
                >
                  Choose another time slot
                </Link>
              </div>
            ) : screenState === 'verifying_payment' || screenState === 'processing_payment' ? (
              <div className="space-y-4">
                <div className="rounded-xl bg-[#F5F6FA] border border-[#22306B]/20 p-5 text-center space-y-2">
                  <div className="w-6 h-6 mx-auto rounded-full border-2 border-[#22306B] border-t-transparent animate-spin" />
                  <p className="text-sm font-bold text-[#22306B]">Verifying Payment</p>
                  <p className="text-xs text-slate-600">
                    Switchboard is independently verifying receipt on{' '}
                    <span className="font-mono">{business.interledgerWalletAddress}</span>.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void loadAuthoritativeBooking()}
                  className="w-full py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-[#111827] cursor-pointer"
                >
                  Recheck Payment Status
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Wallet Address Entry */}
                {(screenState === 'awaiting_wallet_address' ||
                  screenState === 'getting_quote' ||
                  screenState === 'payment_failed') && (
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <label
                          htmlFor="ilp-customer-wallet"
                          className="text-xs font-semibold text-[#111827]"
                        >
                          Your Interledger Test Wallet Address
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            setWalletInput('https://ilp.interledger-test.dev/1ca580ac')
                          }
                          className="text-[11px] font-semibold text-[#22306B] hover:underline cursor-pointer"
                        >
                          Use EUR test wallet
                        </button>
                      </div>
                      <input
                        id="ilp-customer-wallet"
                        type="text"
                        value={walletInput}
                        onChange={(e) => setWalletInput(e.target.value)}
                        placeholder="https://ilp.interledger-test.dev/1ca580ac"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-mono text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#22306B]"
                      />
                    </div>

                    <button
                      type="button"
                      disabled={screenState === 'getting_quote'}
                      onClick={() => void handleGetQuote()}
                      className="w-full py-3 rounded-xl bg-[#22306B] hover:bg-[#192350] text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-60"
                    >
                      {screenState === 'getting_quote' ? 'Getting Quote…' : 'Get Payment Quote'}
                    </button>
                  </div>
                )}

                {/* Live Provider Quote & Authorize CTA */}
                {(screenState === 'ready_to_authorize' ||
                  screenState === 'awaiting_wallet_approval') &&
                  quoteState && (
                    <div className="space-y-4">
                      <div className="rounded-xl bg-[#F5F6FA] border border-[#22306B]/20 p-4 text-xs space-y-2">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Paying Wallet Currency</span>
                          <span className="font-semibold text-[#111827]">
                            {quoteState.quote.debitAmount.assetCode}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Business Receiving Currency</span>
                          <span className="font-semibold text-[#111827]">
                            {quoteState.quote.receiveAmount.assetCode}
                          </span>
                        </div>
                        <div className="flex justify-between pt-1.5 border-t border-slate-200/80">
                          <span className="text-slate-500">You Will Pay (Quote Debit)</span>
                          <span className="font-bold text-sm text-[#111827]">
                            {formatMinor(
                              quoteState.quote.debitAmount.value,
                              quoteState.quote.debitAmount.assetCode,
                              quoteState.quote.debitAmount.assetScale,
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Business Receives</span>
                          <span className="font-bold text-[#22306B]">
                            {formatMinor(
                              quoteState.quote.receiveAmount.value,
                              quoteState.quote.receiveAmount.assetCode,
                              quoteState.quote.receiveAmount.assetScale,
                            )}
                          </span>
                        </div>
                        {quoteState.quote.expiresAt && (
                          <div className="flex justify-between">
                            <span className="text-slate-500">Quote Expires</span>
                            <span className="text-slate-700">
                              {new Date(quoteState.quote.expiresAt).toLocaleTimeString()}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2.5">
                        <button
                          type="button"
                          onClick={() => {
                            setQuoteState(null);
                            setPrepareKey(`ilp_${Date.now()}`);
                            setScreenState('awaiting_wallet_address');
                          }}
                          className="sm:w-1/3 py-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-[#111827] cursor-pointer"
                        >
                          Change Wallet
                        </button>
                        <button
                          type="button"
                          disabled={screenState === 'awaiting_wallet_approval'}
                          onClick={() => void handleAuthorize()}
                          className="sm:w-2/3 py-3 rounded-xl bg-[#F5B700] hover:bg-[#e0a800] text-[#111827] text-sm font-bold transition-colors cursor-pointer disabled:opacity-60"
                        >
                          {screenState === 'awaiting_wallet_approval'
                            ? 'Redirecting to Wallet…'
                            : 'Authorize Test Payment'}
                        </button>
                      </div>
                    </div>
                  )}

                {errorMsg && (
                  <div
                    role="alert"
                    className="rounded-xl bg-amber-50 border border-amber-300 p-3 text-xs text-amber-900"
                  >
                    {errorMsg}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

export default function InterledgerPaymentPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F5F6FA] flex items-center justify-center text-xs text-slate-500">
          Preparing Interledger checkout…
        </div>
      }
    >
      <PaymentScreenContent />
    </Suspense>
  );
}
