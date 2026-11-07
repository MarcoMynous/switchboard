import Link from 'next/link';

export default function CheckEmailPage() {
  return (
    <div className="min-h-screen w-full bg-background font-body-md text-body-md text-on-surface antialiased flex items-center justify-center p-4 sm:p-6 lg:p-10 selection:bg-primary-container selection:text-white">
      <main className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl border border-border/80 bg-surface p-8 sm:p-10 text-center flex flex-col items-center">
        {/* Email Icon */}
        <div className="w-16 h-16 rounded-2xl bg-primary-container/10 border border-primary-container/20 text-primary-container flex items-center justify-center mb-6 shadow-sm">
          <span className="material-symbols-outlined text-[32px]">mark_email_read</span>
        </div>

        {/* Heading */}
        <h1 className="font-headline-md text-headline-md text-text-primary tracking-tight font-semibold mb-2">
          Check your email
        </h1>
        <p className="font-body-md text-body-md text-text-secondary leading-relaxed mb-6">
          We’ve sent a magic link to your email address. Click the link inside to instantly sign in
          to your Switchboard workspace.
        </p>

        {/* Tip Box */}
        <div className="w-full bg-surface-container-low rounded-xl p-4 text-left border border-border/60 mb-6">
          <div className="flex items-start gap-2.5">
            <span className="material-symbols-outlined text-[20px] text-primary-container shrink-0 mt-0.5">
              info
            </span>
            <div className="text-body-sm font-body-sm text-text-secondary">
              <span className="font-medium text-text-primary">Didn’t receive the email?</span>
              <p className="mt-0.5">
                Check your spam folder, or try requesting another link in a few minutes.
              </p>
            </div>
          </div>
        </div>

        {/* Back Link */}
        <Link
          href="/auth/signin"
          className="w-full h-11 px-4 rounded-lg bg-surface text-text-primary font-label-md text-label-md font-medium flex items-center justify-center gap-2 hover:bg-surface-container-low transition-all shadow-sm border border-border/80 active:scale-[0.99]"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          <span>Back to Sign In</span>
        </Link>
      </main>
    </div>
  );
}
