'use client';

import { useEffect, useState } from 'react';
import { AppIcon } from './AppIcon';
import { formatNairaFromKobo } from './DepositCard';
import { HoldBand } from './HoldBand';

export type InterledgerUiStatus =
  | 'waiting_for_wallet'
  | 'awaiting_authorization'
  | 'processing_payment'
  | 'verifying_payment'
  | 'confirmed'
  | 'requires_attention'
  | 'expired';

interface QuoteSummary {
  paymentId: string;
  reference: string;
  incomingPaymentId: string;
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

export interface InterledgerCheckoutCardProps {
  slug: string;
  bookingId: string;
  businessName: string;
  receivingWalletAddress: string;
  serviceName: string;
  appointmentLabel: string;
  depositKobo: number;
  remainingSeconds: number;
  environment: 'testnet' | 'production';
  initialCallbackParams?: {
    paymentId: string;
    state: string | null;
    interactRef: string | null;
    hash: string | null;
    result: string | null;
  } | null;
  onConfirmed?: (paymentId: string) => void;
  onPickDifferentSlot?: () => void;
}

function formatMinorUnits(value: string, assetCode: string, assetScale: number): string {
  const num = Number(value) / 10 ** assetScale;
  return `${num.toLocaleString('en-US', {
    minimumFractionDigits: Math.min(assetScale, 2),
    maximumFractionDigits: assetScale,
  })} ${assetCode}`;
}

const STATUS_BADGE: Record<InterledgerUiStatus, { label: string; tone: string }> = {
  waiting_for_wallet: {
    label: 'Waiting for Wallet',
    tone: 'bg-[#F5F6FA] text-[#22306B] border-[#22306B]/20',
  },
  awaiting_authorization: {
    label: 'Awaiting Authorization',
    tone: 'bg-[#F5B700]/15 text-[#7A5900] border-[#F5B700]/40',
  },
  processing_payment: {
    label: 'Processing Payment',
    tone: 'bg-[#22306B]/10 text-[#22306B] border-[#22306B]/25',
  },
  verifying_payment: {
    label: 'Verifying Payment',
    tone: 'bg-[#22306B]/10 text-[#22306B] border-[#22306B]/25',
  },
  confirmed: {
    label: 'Confirmed',
    tone: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  requires_attention: {
    label: 'Requires Attention',
    tone: 'bg-amber-50 text-amber-900 border-amber-300',
  },
  expired: {
    label: 'Expired',
    tone: 'bg-slate-100 text-slate-700 border-slate-300',
  },
};

export function InterledgerCheckoutCard({
  slug,
  bookingId,
  businessName,
  receivingWalletAddress,
  serviceName,
  appointmentLabel,
  depositKobo,
  remainingSeconds,
  environment,
  initialCallbackParams,
  onConfirmed,
  onPickDifferentSlot,
}: InterledgerCheckoutCardProps) {
  const [walletInput, setWalletInput] = useState('');
  const [uiStatus, setUiStatus] = useState<InterledgerUiStatus>('waiting_for_wallet');
  const [quoteData, setQuoteData] = useState<QuoteSummary | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(remainingSeconds);
  const [prepareKey] = useState(() =>
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? `ilp_${crypto.randomUUID()}`
      : `ilp_${Date.now()}`,
  );

  useEffect(() => {
    setSecondsLeft(remainingSeconds);
  }, [remainingSeconds]);

  // Handle return from Open Payments wallet authorization redirect
  useEffect(() => {
    if (!initialCallbackParams?.paymentId) return;
    if (initialCallbackParams.result === 'grant_rejected' || !initialCallbackParams.interactRef) {
      setUiStatus('waiting_for_wallet');
      setErrorMsg(
        'Wallet authorization was cancelled or rejected. Your slot hold remains active until expiry.',
      );
      return;
    }
    if (!initialCallbackParams.state) {
      setUiStatus('requires_attention');
      setErrorMsg('Missing authorization state parameter on callback.');
      return;
    }

    let cancelled = false;
    setUiStatus('processing_payment');
    setErrorMsg(null);

    const completeCallback = async () => {
      try {
        const res = await fetch(
          `/api/public/${encodeURIComponent(slug)}/payments/interledger/callback`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              paymentId: initialCallbackParams.paymentId,
              state: initialCallbackParams.state,
              interact_ref: initialCallbackParams.interactRef,
              ...(initialCallbackParams.hash ? { hash: initialCallbackParams.hash } : {}),
            }),
          },
        );
        const data = (await res.json()) as {
          verification?: { status?: string; message?: string };
          error?: { message?: string };
        };
        if (cancelled) return;
        if (!res.ok) {
          setUiStatus('requires_attention');
          setErrorMsg(data.error?.message ?? 'Could not complete wallet authorization.');
          return;
        }
        const vStatus = data.verification?.status;
        if (vStatus === 'confirmed') {
          setUiStatus('confirmed');
          onConfirmed?.(initialCallbackParams.paymentId);
        } else if (vStatus === 'underpaid' || vStatus === 'late_requires_attention') {
          setUiStatus('requires_attention');
          setErrorMsg('Payment requires review before your appointment can be confirmed.');
        } else {
          setUiStatus('verifying_payment');
        }
      } catch {
        if (!cancelled) {
          setUiStatus('verifying_payment');
        }
      }
    };

    void completeCallback();
    return () => {
      cancelled = true;
    };
  }, [initialCallbackParams, onConfirmed, slug]);

  // Poll authoritative backend status while Verifying Payment
  useEffect(() => {
    const activePaymentId = quoteData?.paymentId ?? initialCallbackParams?.paymentId;
    if (uiStatus !== 'verifying_payment' || !activePaymentId) return;

    let cancelled = false;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/public/${encodeURIComponent(slug)}/payments/interledger/${encodeURIComponent(activePaymentId)}/status`,
          { cache: 'no-store' },
        );
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          paymentStatus?: string;
          bookingStatus?: string;
          lastErrorMessage?: string | null;
        };
        if (cancelled) return;
        if (data.paymentStatus === 'succeeded' && data.bookingStatus === 'confirmed') {
          setUiStatus('confirmed');
          onConfirmed?.(activePaymentId);
        } else if (data.paymentStatus === 'failed') {
          setUiStatus('requires_attention');
          setErrorMsg(data.lastErrorMessage ?? 'Payment verification failed.');
        } else if (data.bookingStatus === 'expired') {
          setUiStatus('expired');
        }
      } catch {
        // Keep polling
      }
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [initialCallbackParams?.paymentId, onConfirmed, quoteData?.paymentId, slug, uiStatus]);

  const handleGetQuote = async () => {
    if (!walletInput.trim()) {
      setErrorMsg('Enter your Open Payments wallet address first.');
      return;
    }
    setIsBusy(true);
    setErrorMsg(null);
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
      const data = (await res.json()) as QuoteSummary & { error?: { message?: string } };
      if (!res.ok || !data.quote) {
        setErrorMsg(data.error?.message ?? 'Unable to generate a quote for this wallet address.');
        return;
      }
      setQuoteData(data);
      setUiStatus('awaiting_authorization');
    } catch {
      setErrorMsg('Network error while contacting Open Payments server.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleAuthorize = async () => {
    if (!quoteData) return;
    setIsBusy(true);
    setErrorMsg(null);
    try {
      const res = await fetch(
        `/api/public/${encodeURIComponent(slug)}/payments/interledger/authorize`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentId: quoteData.paymentId }),
        },
      );
      const data = (await res.json()) as { redirectUrl?: string; error?: { message?: string } };
      if (!res.ok || !data.redirectUrl) {
        setErrorMsg(data.error?.message ?? 'Unable to start wallet authorization.');
        return;
      }
      window.location.assign(data.redirectUrl);
    } catch {
      setErrorMsg('Network error while starting wallet authorization.');
    } finally {
      setIsBusy(false);
    }
  };

  const badge = STATUS_BADGE[uiStatus];
  const holdBandStatus =
    uiStatus === 'confirmed'
      ? 'confirmed'
      : uiStatus === 'expired'
        ? 'expired'
        : uiStatus === 'verifying_payment' || uiStatus === 'processing_payment'
          ? 'pending_verification'
          : 'held';

  return (
    <div className="space-y-4">
      <HoldBand
        status={holdBandStatus}
        remainingSeconds={secondsLeft}
        reference={quoteData?.reference ?? bookingId}
        onExpire={() => setUiStatus('expired')}
      />

      <div className="rounded-xl border border-[#22306B]/15 bg-[#F5F6FA] p-4 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#22306B]">
              Interledger Open Payments
            </p>
            <h3 className="text-base font-bold text-[#111827] mt-0.5">{businessName}</h3>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${badge.tone}`}
            >
              {badge.label}
            </span>
            {environment === 'testnet' && (
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#F5B700]/20 text-[#7A5900] text-[10px] font-semibold">
                Testnet · Simulated Money
              </span>
            )}
          </div>
        </div>

        <div className="rounded-lg bg-white border border-slate-200 p-3 text-xs space-y-1.5">
          <div className="flex justify-between">
            <span className="text-slate-500">Service</span>
            <span className="font-semibold text-[#111827]">{serviceName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Appointment</span>
            <span className="font-semibold text-[#111827]">{appointmentLabel}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Deposit Obligation</span>
            <span className="font-bold text-[#22306B]">{formatNairaFromKobo(depositKobo)}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-slate-500 shrink-0">Receiving Wallet</span>
            <span className="font-mono text-[11px] text-slate-700 truncate">
              {receivingWalletAddress}
            </span>
          </div>
        </div>

        {uiStatus === 'waiting_for_wallet' && (
          <div className="space-y-3">
            <div>
              <label
                htmlFor="ilp-wallet-input"
                className="block text-xs font-semibold text-[#111827] mb-1"
              >
                Your Open Payments Wallet Address
              </label>
              <input
                id="ilp-wallet-input"
                type="text"
                value={walletInput}
                onChange={(e) => setWalletInput(e.target.value)}
                placeholder="https://ilp.interledger-test.dev/your-wallet"
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 bg-white text-sm font-mono text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#22306B]"
              />
            </div>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => void handleGetQuote()}
              className="w-full py-2.5 rounded-xl bg-[#22306B] hover:bg-[#192350] text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-60"
            >
              {isBusy ? 'Preparing quote…' : 'Get payment quote'}
            </button>
          </div>
        )}

        {uiStatus === 'awaiting_authorization' && quoteData && (
          <div className="space-y-3">
            <div className="rounded-lg bg-white border border-[#22306B]/20 p-3 text-xs space-y-1.5">
              <p className="font-semibold text-[#22306B]">Quote Summary</p>
              <div className="flex justify-between">
                <span className="text-slate-500">You will pay</span>
                <span className="font-bold text-[#111827]">
                  {formatMinorUnits(
                    quoteData.quote.debitAmount.value,
                    quoteData.quote.debitAmount.assetCode,
                    quoteData.quote.debitAmount.assetScale,
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Business receives</span>
                <span className="font-semibold text-[#111827]">
                  {formatMinorUnits(
                    quoteData.quote.receiveAmount.value,
                    quoteData.quote.receiveAmount.assetCode,
                    quoteData.quote.receiveAmount.assetScale,
                  )}
                </span>
              </div>
              {quoteData.isCrossCurrency && quoteData.conversionRateUsed && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Conversion policy</span>
                  <span className="text-slate-700">
                    1 NGN = {quoteData.conversionRateUsed} {quoteData.expectedAmount.assetCode}
                  </span>
                </div>
              )}
              {quoteData.quote.expiresAt && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Quote expires</span>
                  <span className="text-slate-700">
                    {new Date(quoteData.quote.expiresAt).toLocaleTimeString()}
                  </span>
                </div>
              )}
            </div>

            <button
              type="button"
              disabled={isBusy}
              onClick={() => void handleAuthorize()}
              className="w-full py-3 rounded-xl bg-[#F5B700] hover:bg-[#e0a800] text-[#111827] text-sm font-bold transition-colors cursor-pointer disabled:opacity-60"
            >
              {isBusy ? 'Redirecting to wallet…' : 'Authorize Payment'}
            </button>
          </div>
        )}

        {(uiStatus === 'processing_payment' || uiStatus === 'verifying_payment') && (
          <div className="rounded-lg bg-white border border-[#22306B]/20 p-4 text-center space-y-1.5">
            <p className="text-sm font-bold text-[#22306B]">Your payment is being verified.</p>
            <p className="text-xs text-slate-600">
              Switchboard is independently confirming receipt on the business wallet before locking
              in your appointment.
            </p>
          </div>
        )}

        {uiStatus === 'confirmed' && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 flex items-start gap-2.5">
            <AppIcon name="check_circle" className="text-emerald-700 text-lg shrink-0" />
            <div>
              <p className="text-sm font-bold text-emerald-900">Appointment confirmed</p>
              <p className="text-xs text-emerald-800 mt-0.5">
                Your Interledger deposit has been verified by Switchboard.
              </p>
            </div>
          </div>
        )}

        {errorMsg && (
          <div
            role="alert"
            className="rounded-lg bg-amber-50 border border-amber-300 p-3 text-xs text-amber-900"
          >
            {errorMsg}
          </div>
        )}

        {uiStatus === 'expired' && onPickDifferentSlot && (
          <button
            type="button"
            onClick={onPickDifferentSlot}
            className="w-full py-2.5 rounded-xl bg-[#22306B] text-white text-xs font-semibold cursor-pointer"
          >
            Pick a different slot
          </button>
        )}
      </div>
    </div>
  );
}
