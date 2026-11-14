import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { DashboardProvider } from '@/components/dashboard/DashboardContext';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { resolveAuthDestination } from '@/lib/auth-destination';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const dest = await resolveAuthDestination(await headers());
  if (!dest.authenticated) {
    redirect('/auth/signin');
  }
  if (!dest.onboarded) {
    redirect('/onboarding');
  }

  return (
    <DashboardProvider>
      <DashboardShell>{children}</DashboardShell>
    </DashboardProvider>
  );
}
