'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { authClient } from '@/lib/auth-client';

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setClientError(null);
    setServerError(null);

    const trimmed = email.trim();
    if (!trimmed) {
      setClientError('Please enter your work email address.');
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(trimmed)) {
      setClientError('Please enter a valid work email address (e.g. name@domain.com).');
      return;
    }

    setIsLoading(true);

    try {
      const res = await authClient.signIn.magicLink({
        email: trimmed,
        callbackURL: '/',
      });

      if (res?.error) {
        setServerError(
          res.error.message ||
            'Unable to verify enterprise credentials. Please check your network or try again.',
        );
        setIsLoading(false);
        return;
      }

      setIsSuccess(true);
      setTimeout(() => {
        router.push('/auth/check-email');
      }, 1000);
    } catch (_err) {
      setServerError(
        'Workspace connection failure. Unable to verify enterprise credentials. Please check your network or try again.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setClientError(null);
    setServerError(null);
    setIsLoading(true);

    try {
      const res = await authClient.signIn.social({
        provider: 'google',
        callbackURL: '/',
      });

      if (res?.error) {
        setServerError(
          res.error.message || 'Failed to authenticate with Google. Please try again.',
        );
      }
    } catch (_err) {
      setServerError('Unable to initiate Google sign-in. Please verify your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-background font-body-md text-body-md text-on-surface antialiased flex items-center justify-center p-4 sm:p-6 lg:p-10 selection:bg-primary-container selection:text-white">
      {/* Centered spacious responsive auth container */}
      <main className="w-full max-w-6xl min-h-[720px] lg:min-h-[780px] rounded-2xl overflow-hidden shadow-2xl border border-border/80 bg-surface flex flex-col lg:flex-row transition-all">
        {/* Left Showcase Panel (52% on desktop, full width on mobile) */}
        <div className="w-full lg:w-[52%] bg-midnight-hero p-6 sm:p-8 lg:p-12 relative flex flex-col justify-between overflow-hidden text-surface">
          {/* Ambient Iris Glows */}
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary-container/20 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-primary/25 rounded-full blur-[120px] pointer-events-none" />

          {/* Top Branding */}
          <div className="relative z-10 flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-3 group">
              <div className="w-9 h-9 rounded-lg bg-primary-container flex items-center justify-center text-on-primary shadow-md group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined text-[20px]">hub</span>
              </div>
              <span className="font-headline-sm text-headline-sm text-surface tracking-tight font-medium">
                Switchboard
              </span>
            </Link>
            <div className="px-3 py-1 rounded-full bg-surface/10 backdrop-blur-md flex items-center space-x-1.5 border border-surface/10">
              <span className="w-1.5 h-1.5 rounded-full bg-iris-light animate-pulse" />
              <span className="font-metric-sm text-metric-sm text-iris-light tracking-wide">
                v2.4 Enterprise Auth
              </span>
            </div>
          </div>

          {/* Hero Statement */}
          <div className="relative z-10 my-8 sm:my-10 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 text-iris-light font-label-sm text-label-sm mb-4 border border-iris-light/20">
              <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
              <span>AUTONOMOUS WORKFORCE ENGINE</span>
            </div>
            <h1 className="font-headline-lg text-headline-lg text-surface tracking-tight leading-tight mb-4">
              Your business, <br className="hidden sm:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-surface via-iris-light to-primary-fixed">
                always ready.
              </span>
            </h1>
            <p className="font-body-md text-body-md text-text-secondary leading-relaxed max-w-md">
              Deploy intelligent AI assistants that answer customers, orchestrate requests, and keep
              operations moving around the clock.
            </p>
          </div>

          {/* Live AI Interaction Preview Card */}
          <div className="relative z-10 w-full rounded-xl bg-surface/5 p-5 shadow-2xl backdrop-blur-md border border-surface/10 mb-6 lg:mb-0">
            {/* Card Header */}
            <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-surface/10">
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary-container to-iris-light p-0.5 shadow-sm">
                    <Image
                      alt="Assistant Maya"
                      className="w-full h-full object-cover rounded-full"
                      width={40}
                      height={40}
                      unoptimized
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuCLCGJi8lzUXoink1Zf6Pwog9pgoJCPE1C9JZOB37M2p-BoL992Igz8JUjW4Ku_pkXbjbRRZVt2UQ12-EPW2cu5W5ecXinR34khuExqod5ZI0pkQFOiTjusse8TFcXhr8FFMWYtUGk-83b-06napdQ8AoN9tWjteE4W2WVvXfMX_KCC-AFnkn7wmurjGwUUufIReeoItfry8Dn6W_kNpN0lox6_x8k-WBbaP29tQdw"
                    />
                  </div>
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-success ring-2 ring-midnight-hero" />
                </div>
                <div>
                  <div className="flex items-center space-x-1.5">
                    <span className="font-body-sm text-body-sm text-surface font-medium">
                      Assistant Maya
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-surface/10 font-metric-sm text-[10px] text-surface/80">
                      VOICE AI
                    </span>
                  </div>
                  <p className="font-label-sm text-label-sm text-text-secondary">
                    Clinical Dispatch Routing
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className="font-metric-sm text-metric-sm text-iris-light flex items-center gap-1.5 bg-surface/10 px-2 py-0.5 rounded">
                  <span className="w-1.5 h-1.5 rounded-full bg-iris-light animate-pulse" />
                  184ms
                </span>
              </div>
            </div>

            {/* Waveform Visualization */}
            <div className="h-10 bg-midnight-hero/60 rounded-lg px-3 py-2 flex items-center justify-between gap-1 mb-3.5 border border-surface/5">
              <span className="h-2 w-1 bg-iris-light/40 rounded-full animate-pulse" />
              <span className="h-4 w-1 bg-iris-light rounded-full" />
              <span className="h-6 w-1 bg-primary-container rounded-full" />
              <span className="h-3 w-1 bg-iris-light/80 rounded-full" />
              <span className="h-7 w-1 bg-primary-fixed rounded-full" />
              <span className="h-5 w-1 bg-iris-light rounded-full" />
              <span className="h-2 w-1 bg-iris-light/50 rounded-full" />
              <span className="h-6 w-1 bg-primary-container rounded-full" />
              <span className="h-8 w-1 bg-primary-fixed rounded-full" />
              <span className="h-4 w-1 bg-iris-light rounded-full" />
              <span className="h-3 w-1 bg-iris-light/60 rounded-full" />
              <span className="h-6 w-1 bg-primary-container rounded-full" />
              <span className="h-7 w-1 bg-iris-light rounded-full" />
              <span className="h-3 w-1 bg-iris-light/40 rounded-full" />
              <span className="h-5 w-1 bg-primary-container rounded-full" />
              <span className="h-2 w-1 bg-iris-light/30 rounded-full" />
            </div>

            {/* Transcript Preview */}
            <div className="bg-surface/5 rounded-lg p-3 flex flex-col gap-2 border border-surface/5">
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-[16px] text-iris-light mt-0.5">
                  record_voice_over
                </span>
                <p className="font-body-sm text-body-sm text-surface/90 leading-snug">
                  “Checking Dr. Reynolds’ schedule for 2:30 PM tomorrow...”
                </p>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="px-2 py-0.5 rounded-full bg-success/15 text-success font-metric-sm text-[11px] inline-flex items-center gap-1 border border-success/20">
                  <span className="material-symbols-outlined text-[12px]">check_circle</span>
                  Verified Action • Slot Held
                </span>
                <span className="font-metric-sm text-[10px] text-text-secondary">Sync 0.14s</span>
              </div>
            </div>
          </div>

          {/* Trust Badges Footer */}
          <div className="relative z-10 pt-4 flex items-center justify-between text-text-secondary border-t border-surface/10">
            <div className="flex items-center space-x-2">
              <span className="material-symbols-outlined text-[18px] text-success">
                verified_user
              </span>
              <span className="font-label-md text-label-md text-surface/70">
                99.99% Availability • SOC 2 Type II Certified
              </span>
            </div>
            <span className="font-metric-sm text-metric-sm text-surface/40">ISO 27001</span>
          </div>
        </div>

        {/* Right Authentication Panel (48% on desktop, full width on mobile) */}
        <div className="w-full lg:w-[48%] bg-surface-bright p-6 sm:p-8 lg:p-12 flex flex-col justify-between">
          {/* Back Navigation */}
          <div className="flex items-center justify-between mb-8">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 font-label-md text-label-md text-text-secondary hover:text-text-primary transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              <span>Back to website</span>
            </Link>
            <span className="font-label-sm text-label-sm text-text-secondary uppercase tracking-wider font-medium">
              SECURE AUTH GATE
            </span>
          </div>

          {/* Main Form Wrapper */}
          <div className="w-full max-w-[420px] mx-auto my-auto flex flex-col">
            {/* Emblem & Header */}
            <div className="text-left mb-6">
              <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center text-primary-container mb-3 shadow-sm border border-border/50">
                <span className="material-symbols-outlined text-[24px]">dataset</span>
              </div>
              <h2 className="font-headline-md text-headline-md text-text-primary tracking-tight font-semibold">
                Welcome to Switchboard
              </h2>
              <p className="font-body-md text-body-md text-text-secondary mt-1">
                Sign in or create an account to get started.
              </p>
            </div>

            {/* Server Error Notification Banner */}
            {serverError && (
              <div className="mb-4 p-3.5 rounded-lg bg-error-container text-on-error-container text-body-sm font-body-sm flex items-start gap-2.5 border border-error/30 animate-in fade-in duration-200">
                <span className="material-symbols-outlined text-[18px] text-error mt-0.5 shrink-0">
                  error
                </span>
                <div>
                  <p className="font-medium text-error">Authentication failed</p>
                  <p className="text-on-error-container text-body-sm mt-0.5">{serverError}</p>
                </div>
              </div>
            )}

            {/* Passwordless Auth Form */}
            <form className="space-y-4" onSubmit={handleFormSubmit}>
              <div>
                <label
                  className="block font-label-md text-label-md text-text-primary mb-1.5 font-medium"
                  htmlFor="work-email"
                >
                  Work Email
                </label>
                <div className="relative">
                  <input
                    id="work-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    disabled={isLoading}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (clientError) setClientError(null);
                      if (serverError) setServerError(null);
                    }}
                    placeholder="you@company.com"
                    className={`w-full px-3.5 py-2.5 rounded-lg bg-surface text-text-primary placeholder:text-text-secondary/60 text-body-md font-body-md shadow-sm outline-none transition-all duration-150 border ${
                      clientError
                        ? 'border-error bg-error-container/20 text-error focus:ring-1 focus:ring-error'
                        : 'border-border focus:border-primary focus:ring-1 focus:ring-primary'
                    }`}
                  />
                </div>
                <p
                  className={`mt-1.5 font-body-sm text-body-sm ${
                    clientError ? 'text-error font-medium' : 'text-text-secondary'
                  }`}
                >
                  {clientError || "We'll email you a secure one-click sign in link."}
                </p>
              </div>

              {/* Primary Submit CTA */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 px-4 rounded-lg bg-primary-container text-on-primary font-label-md text-label-md font-medium tracking-wide flex items-center justify-center gap-2 hover:bg-primary active:scale-[0.99] transition-all shadow-md disabled:opacity-75 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-[18px]">
                      progress_activity
                    </span>
                    <span>Sending Magic Link...</span>
                  </>
                ) : isSuccess ? (
                  <>
                    <span className="material-symbols-outlined text-[18px]">mark_email_read</span>
                    <span>Check Your Inbox</span>
                  </>
                ) : (
                  <>
                    <span>Continue with email</span>
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="relative my-6 flex items-center justify-center">
              <div className="w-full h-px bg-surface-container-high" />
              <span className="absolute bg-surface-bright px-3 font-label-sm text-label-sm text-text-secondary uppercase tracking-wider">
                or continue with
              </span>
            </div>

            {/* Google OAuth Option */}
            <button
              type="button"
              onClick={handleGoogleAuth}
              disabled={isLoading}
              className="w-full h-11 px-4 rounded-lg bg-surface text-text-primary font-label-md text-label-md font-medium flex items-center justify-center gap-3 hover:bg-surface-container-low transition-all shadow-sm border border-border/80 active:scale-[0.99] disabled:opacity-75"
            >
              <svg aria-hidden="true" className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.87c2.26-2.09 3.675-5.17 3.675-9.15z"
                  fill="#4285F4"
                />
                <path
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.87-3.05c-1.08.72-2.45 1.16-4.06 1.16-3.13 0-5.78-2.11-6.73-4.96H1.25v3.15C3.25 21.36 7.33 24 12 24z"
                  fill="#34A853"
                />
                <path
                  d="M5.27 14.24c-.25-.72-.38-1.49-.38-2.24s.13-1.52.38-2.24V6.61H1.25C.45 8.22 0 10.05 0 12s.45 3.78 1.25 5.39l4.02-3.15z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.25 2.64 1.25 6.61l4.02 3.15c.95-2.85 3.6-4.96 6.73-4.96z"
                  fill="#EA4335"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            {/* Dynamic Success Toast */}
            {isSuccess && (
              <div className="mt-4 p-3 rounded-lg bg-surface-container text-success font-body-sm text-body-sm flex items-center justify-between shadow-sm border border-success/30 animate-in fade-in duration-200">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">mark_email_read</span>
                  <span>Link sent! Navigating to check inbox...</span>
                </div>
                <span className="font-metric-sm text-metric-sm text-text-secondary">
                  /auth/check-email
                </span>
              </div>
            )}

            {/* Legal Disclaimer Footer */}
            <p className="mt-6 text-center font-label-sm text-label-sm text-text-secondary leading-relaxed">
              By continuing, you agree to our{' '}
              <Link href="/terms" className="underline hover:text-text-primary transition-colors">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="underline hover:text-text-primary transition-colors">
                Privacy Policy
              </Link>
              . No password required.
            </p>
          </div>

          {/* Compliance & Status */}
          <div className="flex items-center justify-between pt-6 text-text-secondary font-label-sm text-label-sm border-t border-border/40 mt-6 lg:mt-0">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-success" />
              Switchboard Systems Operational
            </span>
            <span>Secure Enclave 256-bit</span>
          </div>
        </div>
      </main>
    </div>
  );
}
