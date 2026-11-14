'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { SwitchboardLogo } from '@/components/SwitchboardLogo';

export default function PostLoginPage() {
  const router = useRouter();

  useEffect(() => {
    let active = true;
    fetch('/api/auth/destination', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data: { destination?: string }) => {
        if (!active) return;
        router.replace(data.destination || '/onboarding');
      })
      .catch(() => {
        if (!active) return;
        router.replace('/onboarding');
      });

    return () => {
      active = false;
    };
  }, [router]);

  return (
    <div className="min-h-screen w-full bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-surface rounded-2xl border border-border/80 shadow-xl p-8 flex flex-col items-center text-center gap-4">
        <SwitchboardLogo href="/" size="md" theme="light" />
        <span className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        <div>
          <h1 className="font-headline-md text-headline-md text-text-primary font-semibold">
            Opening your workspace
          </h1>
          <p className="font-body-sm text-body-sm text-text-secondary mt-1">
            Checking your onboarding status and routing you to the right place...
          </p>
        </div>
      </div>
    </div>
  );
}
