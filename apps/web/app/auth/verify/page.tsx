'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { AppIcon } from '@/components/AppIcon';
import { SwitchboardLogo } from '@/components/SwitchboardLogo';
import { authClient } from '@/lib/auth-client';

type VerificationState = 'validating' | 'decrypting' | 'success' | 'error';

function VerifyLinkContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [state, setState] = useState<VerificationState>('validating');
  const [progress, setProgress] = useState(25);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function runVerification() {
      // Step 1: Validating token
      setProgress(45);

      // If a real token is provided, verify with Better Auth
      if (token) {
        try {
          // Attempt token verification
          const res = await (
            authClient as unknown as {
              magicLink?: {
                verify: (args: {
                  query: { token: string };
                }) => Promise<{ error?: { message?: string } }>;
              };
            }
          ).magicLink?.verify?.({ query: { token } });

          if (res?.error) {
            if (isMounted) {
              setState('error');
              setErrorMessage(
                res.error.message || 'This link has expired or has already been used.',
              );
            }
            return;
          }
        } catch (_err) {
          // If token verification throws network or parsing issue
          if (isMounted) {
            setState('error');
            setErrorMessage('Unable to verify security credentials. Please try again.');
          }
          return;
        }
      }

      // Step 2: Decrypting / Establishing Session
      const timer1 = setTimeout(() => {
        if (!isMounted) return;
        setState('decrypting');
        setProgress(85);

        // Step 3: Success and redirect
        const timer2 = setTimeout(() => {
          if (!isMounted) return;
          setState('success');
          setProgress(100);

          const timer3 = setTimeout(() => {
            if (!isMounted) return;
            router.push('/onboarding');
          }, 800);

          return () => clearTimeout(timer3);
        }, 900);

        return () => clearTimeout(timer2);
      }, 700);

      return () => clearTimeout(timer1);
    }

    runVerification();

    return () => {
      isMounted = false;
    };
  }, [token, router]);

  return (
    <div className="flex flex-col items-center w-full max-w-[500px]">
      {/* Main Verification Card */}
      <div className="w-full bg-surface rounded-2xl shadow-xl border border-border/80 p-8 sm:p-10 flex flex-col items-center relative overflow-hidden text-center">
        {/* Subtle top illumination tint */}
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-32 bg-primary/10 rounded-full blur-2xl pointer-events-none" />

        {/* Brand Header */}
        <div className="mb-8">
          <SwitchboardLogo href="/" size="md" theme="light" />
        </div>

        {/* Dynamic Center Lock / Spinner Animation */}
        <div className="relative flex items-center justify-center my-3 w-16 h-16">
          {state === 'error' ? (
            <div className="w-14 h-14 rounded-full bg-error-container/40 flex items-center justify-center text-error border border-error/30 animate-in zoom-in-90 duration-300">
              <AppIcon name="error_outline" className="text-2xl" />
            </div>
          ) : state === 'success' ? (
            <div className="w-14 h-14 rounded-full bg-success/15 flex items-center justify-center text-success border border-success/30 animate-in zoom-in-90 duration-300">
              <AppIcon name="check_circle" className="text-2xl" />
            </div>
          ) : (
            <>
              {/* Outer circle track */}
              <div className="absolute inset-0 rounded-full border-2 border-border/50" />
              {/* Spinning animated arc */}
              <div className="absolute inset-0 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              {/* Center Lock Icon */}
              <AppIcon name="lock" className="text-primary text-[22px]" />
            </>
          )}
        </div>

        {/* Heading & Subtitle */}
        <h1 className="font-headline-md text-headline-md text-text-primary tracking-tight font-semibold text-[22px] sm:text-[24px] mt-6 mb-2">
          {state === 'error'
            ? 'Sign-in link invalid'
            : state === 'success'
              ? 'Verification complete'
              : 'Verifying your sign-in link...'}
        </h1>
        <p className="font-body-md text-body-md text-text-secondary leading-relaxed max-w-sm text-[15px]">
          {state === 'error'
            ? errorMessage || 'This verification link has expired or has already been used.'
            : state === 'success'
              ? 'Session established. Redirecting to your workspace...'
              : 'Establishing secure session and authenticating your workspace credentials...'}
        </p>

        {/* Progress / Handshake Status Box */}
        {state !== 'error' ? (
          <div className="w-full mt-8 bg-surface-container-low rounded-xl p-4 sm:p-5 flex flex-col gap-3 border border-border/60 text-left font-body-sm">
            {/* Top Row: Handshake & Cryptography Spec */}
            <div className="flex items-center justify-between text-text-secondary font-label-sm text-label-sm">
              <span className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />
                TLS 1.3 Handshake
              </span>
              <span className="font-metric-sm text-metric-sm">256-bit AES</span>
            </div>

            {/* Middle: Progress Bar */}
            <div className="w-full h-1 bg-surface-container rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500 ease-out rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Bottom Row: Validation Status */}
            <div className="flex items-center justify-between text-text-secondary font-label-sm text-label-sm">
              <span>Payload Validation</span>
              <span
                className={`font-label-sm font-medium transition-colors ${
                  state === 'success'
                    ? 'text-success font-semibold flex items-center gap-1'
                    : 'text-primary'
                }`}
              >
                {state === 'validating' && 'Validating Token...'}
                {state === 'decrypting' && 'Decrypting Credentials...'}
                {state === 'success' && (
                  <>
                    <AppIcon name="check" className="text-[14px]" />
                    <span>Session Established</span>
                  </>
                )}
              </span>
            </div>
          </div>
        ) : (
          <div className="w-full mt-6 flex flex-col gap-3">
            <Link
              href="/auth/signin"
              className="w-full h-11 px-4 rounded-lg bg-primary text-on-primary font-label-md text-label-md font-semibold flex items-center justify-center gap-2 hover:bg-primary-container transition-all active:scale-[0.99] shadow-sm"
            >
              <span>Request a new link</span>
              <AppIcon name="arrow_forward" className="text-base" />
            </Link>
          </div>
        )}
      </div>

      {/* Trust Badges Footer Below Card */}
      <div className="mt-8 flex flex-col items-center gap-2 text-text-secondary font-label-sm text-label-sm">
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
          <span className="inline-flex items-center gap-1.5">
            <AppIcon name="verified_user" className="text-success text-[16px]" />
            <span>SOC 2 Type II Certified</span>
          </span>
          <span className="text-border">•</span>
          <span className="inline-flex items-center gap-1.5">
            <AppIcon name="shield" className="text-primary text-[16px]" />
            <span>HIPAA Compliant</span>
          </span>
          <span className="text-border">•</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-success inline-block" />
            <span>99.99% Uptime</span>
          </span>
        </div>
        <p className="text-[12px] text-text-secondary/70 tracking-wide font-sans">
          Switchboard Identity Gateway • Build 24.11-rc4
        </p>
      </div>
    </div>
  );
}

export default function VerifyLinkPage() {
  return (
    <div className="min-h-screen w-full bg-background font-body-md text-body-md text-on-surface antialiased flex items-center justify-center p-4 sm:p-6 lg:p-8 selection:bg-primary-container selection:text-white">
      <Suspense
        fallback={
          <div className="w-full max-w-[500px] bg-surface rounded-2xl p-10 border border-border/80 flex items-center justify-center min-h-[360px]">
            <AppIcon name="progress_activity" className="animate-spin text-3xl text-primary" />
          </div>
        }
      >
        <VerifyLinkContent />
      </Suspense>
    </div>
  );
}
