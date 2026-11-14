'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { AppIcon } from '@/components/AppIcon';
import { SwitchboardLogo } from '@/components/SwitchboardLogo';
import { authClient } from '@/lib/auth-client';

function CheckEmailContent() {
  const searchParams = useSearchParams();
  const initialEmail = searchParams.get('email') || 'hello@acmeenterprises.com';

  const [email, setEmail] = useState(initialEmail);
  const [cooldown, setCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<'idle' | 'resent' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  // Handle countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleResend = async () => {
    if (cooldown > 0 || isResending) return;
    setIsResending(true);
    setResendStatus('idle');

    try {
      const res = await authClient.signIn.magicLink({
        email,
        callbackURL: '/onboarding',
      });

      if (res?.error) {
        setResendStatus('error');
        setErrorMessage(res.error.message || 'Unable to dispatch a new link. Please try again.');
      } else {
        setResendStatus('resent');
        setCooldown(60); // 60 seconds cooldown
      }
    } catch (_err) {
      setResendStatus('error');
      setErrorMessage('Network interruption. Please check your connection.');
    } finally {
      setIsResending(false);
    }
  };

  const handlePromptEmailEdit = () => {
    const updated = window.prompt('Enter your work email address:', email);
    if (updated?.includes('@') && updated.includes('.')) {
      setEmail(updated.trim());
      setResendStatus('idle');
      setCooldown(0);
    }
  };

  // Determine mail provider link based on email domain
  const isGmail = email.toLowerCase().includes('gmail.com');
  const isOutlook =
    email.toLowerCase().includes('outlook.com') || email.toLowerCase().includes('hotmail.com');
  const mailUrl = isOutlook ? 'https://outlook.live.com/mail/' : 'https://mail.google.com';
  const mailLabel = isOutlook ? 'Open Outlook' : isGmail ? 'Open Gmail' : 'Open Email Client';

  const formatCooldown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="w-full max-w-[440px] bg-surface rounded-2xl shadow-xl border border-border/80 p-6 sm:p-8 flex flex-col relative overflow-hidden">
      {/* Subtle top iris illumination tint */}
      <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-32 bg-primary/10 rounded-full blur-2xl pointer-events-none" />

      {/* Header Navigation Context */}
      <div className="flex items-center justify-between w-full pb-6 mb-2">
        <SwitchboardLogo href="/" size="sm" theme="light" />
        <Link
          href="/auth/signin"
          className="font-label-md text-label-md text-text-secondary hover:text-primary transition-colors flex items-center gap-1 group"
        >
          <AppIcon
            name="arrow_back"
            className="text-base transition-transform group-hover:-translate-x-0.5"
          />
          <span>Sign in</span>
        </Link>
      </div>

      {/* Dynamic Hero Visual */}
      <div className="relative flex flex-col items-center justify-center my-3">
        <div className="absolute w-24 h-24 rounded-full bg-primary/15 blur-xl transition-all duration-500" />
        <div className="relative w-16 h-16 rounded-2xl bg-surface-container-low flex items-center justify-center shadow-sm border border-border/60">
          <AppIcon
            name={resendStatus === 'resent' ? 'task_alt' : 'mark_email_read'}
            className="text-primary text-3xl"
          />
        </div>
      </div>

      {/* Text Block */}
      <div className="text-center mt-3 mb-5 flex flex-col items-center">
        <h1 className="font-headline-md text-headline-md text-text-primary tracking-tight font-semibold">
          Check your inbox
        </h1>
        <p className="font-body-md text-body-md text-text-secondary mt-1 max-w-sm">
          We&apos;ve sent a secure sign-in link to your email address.
        </p>

        {/* Recipient Chip with Quick Action */}
        <div className="mt-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-low border border-border/60">
          <AppIcon name="alternate_email" className="text-text-secondary text-sm" />
          <span className="font-metric-md text-metric-md text-text-primary font-medium max-w-[220px] truncate">
            {email}
          </span>
          <span className="text-surface-variant mx-1">|</span>
          <button
            type="button"
            onClick={handlePromptEmailEdit}
            className="font-label-sm text-label-sm text-primary hover:text-primary-container font-semibold transition-colors"
          >
            Change
          </button>
        </div>
      </div>

      {/* State Notification Banners */}
      <div className="w-full mb-4">
        {resendStatus === 'resent' ? (
          <div className="bg-surface-container-low rounded-lg p-3 flex items-start gap-2.5 border border-success/30 animate-in fade-in duration-200">
            <AppIcon name="task_alt" className="text-success-strong text-lg mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-body-sm text-body-sm text-text-primary font-medium">
                New sign-in link dispatched
              </p>
              <p className="font-body-sm text-body-sm text-text-secondary mt-0.5">
                A fresh token was transmitted to{' '}
                <span className="font-metric-sm text-metric-sm text-text-primary font-medium">
                  {email}
                </span>
                . Previous links are now invalidated.
              </p>
            </div>
          </div>
        ) : resendStatus === 'error' ? (
          <div className="bg-error-container/40 rounded-lg p-3 flex items-start gap-2.5 border border-error/30 animate-in fade-in duration-200">
            <AppIcon name="error_outline" className="text-error text-lg mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-body-sm text-body-sm text-error font-medium">
                Unable to send message
              </p>
              <p className="font-body-sm text-body-sm text-text-secondary mt-0.5">
                {errorMessage || 'Our message relay encountered an interruption. Please try again.'}
              </p>
            </div>
          </div>
        ) : cooldown > 0 ? (
          <div className="bg-secondary-container/40 rounded-lg p-3 flex items-start gap-2.5 border border-border/40 animate-in fade-in duration-200">
            <AppIcon name="hourglass_top" className="text-primary text-lg mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-body-sm text-body-sm text-text-primary font-medium">
                Email in transit
              </p>
              <p className="font-body-sm text-body-sm text-text-secondary mt-0.5">
                Please allow a few moments for delivery. You can resend again in{' '}
                {formatCooldown(cooldown)}.
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-surface-container-low rounded-lg p-3 flex items-start gap-2.5 border border-border/40">
            <AppIcon name="verified_user" className="text-primary text-lg mt-0.5 shrink-0" />
            <p className="font-body-sm text-body-sm text-on-surface-variant leading-snug">
              Open the email and click the verification link to proceed to your Switchboard
              workspace. No password or OTP required.
            </p>
          </div>
        )}
      </div>

      {/* Primary Interactive Control Area */}
      <div className="w-full flex flex-col gap-2.5 pt-1 pb-3">
        {/* Open Email Client (Gmail / Outlook) Button */}
        <a
          href={mailUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full h-11 rounded-lg bg-primary text-on-primary font-label-md text-label-md font-semibold flex items-center justify-center gap-2 hover:bg-primary-container transition-all active:scale-[0.99] shadow-sm"
        >
          <AppIcon name="mail" className="text-base" />
          <span>{mailLabel}</span>
          <AppIcon name="open_in_new" className="text-sm opacity-80" />
        </a>

        {/* Resend Button with Cooldown Timer */}
        <button
          type="button"
          onClick={handleResend}
          disabled={cooldown > 0 || isResending}
          className="w-full h-11 rounded-lg bg-surface-container-low hover:bg-surface-container text-text-primary font-label-md text-label-md font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed border border-border/60"
        >
          {isResending ? (
            <>
              <AppIcon name="progress_activity" className="text-base animate-spin" />
              <span>Sending fresh link...</span>
            </>
          ) : (
            <>
              <AppIcon name="refresh" className="text-base" />
              <span>Resend email</span>
              {cooldown > 0 && (
                <span className="font-metric-sm text-metric-sm px-2 py-0.5 rounded-full bg-surface-container text-text-secondary ml-1">
                  {formatCooldown(cooldown)}
                </span>
              )}
            </>
          )}
        </button>

        {/* Return Link */}
        <Link
          href="/auth/signin"
          className="w-full py-2 text-center font-label-md text-label-md text-text-secondary hover:text-text-primary transition-colors flex items-center justify-center gap-1.5"
        >
          <AppIcon name="arrow_left_alt" className="text-sm" />
          <span>Return to Sign In</span>
        </Link>
      </div>

      {/* Troubleshooting Guidance Note */}
      <div className="w-full pt-4 mt-2 border-t border-border/40 flex flex-col gap-2">
        <div className="flex items-start gap-2">
          <AppIcon name="help_outline" className="text-text-secondary text-base mt-0.5 shrink-0" />
          <p className="font-body-sm text-body-sm text-text-secondary leading-relaxed">
            Didn&apos;t receive the email? Check your spam folder or verify your company firewall
            permits dispatch from{' '}
            <span className="font-metric-sm text-metric-sm text-text-primary">
              auth@switchboard.ai
            </span>
            .
          </p>
        </div>

        {/* Security / Verification Token Badge */}
        <div className="mt-2 py-2 px-3 rounded-lg bg-surface-container-low border border-border/50 flex items-center justify-center gap-2 text-center">
          <AppIcon name="lock" className="text-primary text-sm" />
          <span className="font-metric-sm text-metric-sm text-text-secondary">
            256-bit Encrypted Magic Link • Single-use &amp; expires in 15m
          </span>
        </div>
      </div>
    </div>
  );
}

export default function CheckEmailPage() {
  return (
    <div className="min-h-screen w-full bg-background font-body-md text-body-md text-on-surface antialiased flex items-center justify-center p-4 sm:p-6 lg:p-8 selection:bg-primary-container selection:text-white">
      <Suspense
        fallback={
          <div className="w-full max-w-[440px] bg-surface rounded-2xl p-8 border border-border/80 flex items-center justify-center min-h-[400px]">
            <AppIcon name="progress_activity" className="animate-spin text-2xl text-primary" />
          </div>
        }
      >
        <CheckEmailContent />
      </Suspense>
    </div>
  );
}
