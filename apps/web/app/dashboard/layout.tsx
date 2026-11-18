import { Atkinson_Hyperlegible_Next, Familjen_Grotesk } from 'next/font/google';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { DashboardProvider } from '@/components/dashboard/DashboardContext';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { ProductTourProvider } from '@/components/dashboard/tour/ProductTourProvider';
import { resolveAuthDestination } from '@/lib/auth-destination';

const familjenGrotesk = Familjen_Grotesk({
  variable: '--font-familjen-grotesk',
  subsets: ['latin'],
  display: 'swap',
});

const atkinsonHyperlegibleNext = Atkinson_Hyperlegible_Next({
  variable: '--font-atkinson-hyperlegible-next',
  subsets: ['latin'],
  display: 'swap',
});

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
    <div className={`${familjenGrotesk.variable} ${atkinsonHyperlegibleNext.variable}`}>
      <DashboardProvider>
        <ProductTourProvider>
          <DashboardShell>{children}</DashboardShell>
        </ProductTourProvider>
      </DashboardProvider>
    </div>
  );
}
