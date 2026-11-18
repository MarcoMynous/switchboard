'use client';

import { type DriveStep, driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppIcon } from '@/components/AppIcon';
import { Button } from '@/components/ui/button';
import { useDashboard } from './DashboardContext';

interface TourStepConfig {
  route: string;
  selector: string;
  title: string;
  description: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
}

const TOUR_STEPS: TourStepConfig[] = [
  {
    route: '/dashboard/overview',
    selector: '[data-tour="overview-header"]',
    title: '1. Business Overview',
    description:
      'Your daily command center for Fade Republic Barbershop. Every metric here is derived directly from live booking, conversation, and Kora payment records.',
    side: 'bottom',
  },
  {
    route: '/dashboard/bookings',
    selector: '[data-tour="confirmed-bookings"]',
    title: '2. Confirmed Bookings',
    description:
      'Confirmed appointments only appear here after a Kora deposit is verified (or for no-deposit services). PostgreSQL exclusion constraints guarantee zero double-bookings.',
    side: 'bottom',
  },
  {
    route: '/dashboard/bookings',
    selector: '[data-tour="active-holds"]',
    title: '3. Active Slot Holds',
    description:
      'Temporary 15-minute holds reserve a barber chair while a customer completes their Kora deposit. If unpaid, the hold expires and frees the slot automatically.',
    side: 'bottom',
  },
  {
    route: '/dashboard/conversations',
    selector: '[data-tour="conversations-panel"]',
    title: '4. Conversations',
    description:
      'Review web-chat and simulated WhatsApp threads side-by-side, including Maya AI replies and human-handoff requests.',
    side: 'top',
  },
  {
    route: '/dashboard/customers',
    selector: '[data-tour="customers-panel"]',
    title: '5. Customer Profiles',
    description:
      'Each customer profile unifies phone numbers, visit history, verified Kora deposits, and open support issues.',
    side: 'top',
  },
  {
    route: '/dashboard/needs-attention',
    selector: '[data-tour="needs-attention-panel"]',
    title: '6. Needs Attention',
    description:
      'Human handoffs and pending Kora payment verifications surface here so your team never misses an urgent customer request.',
    side: 'top',
  },
  {
    route: '/dashboard/ai-receptionist',
    selector: '[data-tour="ai-receptionist-panel"]',
    title: '7. AI Receptionist (Maya)',
    description:
      'Configure Maya’s greeting, tone, FAQs, and escalation contact. In Demo Mode, Maya answers using Fade Republic’s sample catalog and hours.',
    side: 'top',
  },
  {
    route: '/dashboard/payments',
    selector: '[data-tour="kora-payment-status"]',
    title: '8. Kora Payment Status',
    description:
      'Manage deposit rules, cancellation windows, and Kora verification status. Demo Mode uses simulated Kora events with no real transfers.',
    side: 'bottom',
  },
  {
    route: '/dashboard/overview',
    selector: '[data-tour="public-booking-link"]',
    title: '9. Public Booking Page',
    description:
      'Share this link with customers so they can pick a service, choose a barber, and lock in a slot with a deposit. You can preview the live demo booking page anytime.',
    side: 'bottom',
  },
];

function waitForElement(selector: string, timeoutMs = 4500): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    const immediate = document.querySelector<HTMLElement>(selector);
    if (immediate) {
      resolve(immediate);
      return;
    }

    const start = Date.now();
    const timer = window.setInterval(() => {
      const found = document.querySelector<HTMLElement>(selector);
      if (found) {
        window.clearInterval(timer);
        resolve(found);
        return;
      }
      if (Date.now() - start >= timeoutMs) {
        window.clearInterval(timer);
        resolve(null);
      }
    }, 60);
  });
}

export function DemoTourController() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { apiState, demoTourRequestId, exitDemoMode } = useDashboard();
  const [welcomeModalOpen, setWelcomeModalOpen] = useState(false);
  const driverRef = useRef<ReturnType<typeof driver> | null>(null);
  const lastTourReqRef = useRef(0);
  const pathnameRef = useRef(pathname);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (apiState.isDemo && searchParams.get('tour') === 'welcome') {
      setWelcomeModalOpen(true);
    }
  }, [apiState.isDemo, searchParams]);

  const launchTour = useCallback(async () => {
    setWelcomeModalOpen(false);
    if (driverRef.current) {
      driverRef.current.destroy();
      driverRef.current = null;
    }

    const firstStep = TOUR_STEPS[0];
    if (!firstStep) return;

    if (pathnameRef.current !== firstStep.route) {
      router.push(firstStep.route);
    }

    const firstEl = await waitForElement(firstStep.selector);
    if (!firstEl) return;

    const navigateAndStep = async (targetIdx: number, direction: 'next' | 'prev') => {
      const stepCfg = TOUR_STEPS[targetIdx];
      if (!stepCfg || !driverRef.current) return;

      if (pathnameRef.current !== stepCfg.route) {
        router.push(stepCfg.route);
      }
      const el = await waitForElement(stepCfg.selector);
      if (!el || !driverRef.current) return;

      if (direction === 'next') {
        driverRef.current.moveNext();
      } else {
        driverRef.current.movePrevious();
      }
    };

    const steps: DriveStep[] = TOUR_STEPS.map((step, idx) => ({
      element: step.selector,
      popover: {
        title: step.title,
        description: step.description,
        side: step.side ?? 'bottom',
        align: 'start',
        onNextClick: () => {
          if (idx >= TOUR_STEPS.length - 1) {
            driverRef.current?.destroy();
            return;
          }
          void navigateAndStep(idx + 1, 'next');
        },
        onPrevClick: () => {
          if (idx <= 0) return;
          void navigateAndStep(idx - 1, 'prev');
        },
      },
    }));

    const d = driver({
      showProgress: true,
      animate: true,
      smoothScroll: true,
      allowClose: true,
      nextBtnText: 'Next',
      prevBtnText: 'Back',
      doneBtnText: 'Finish',
      steps,
      onDestroyStarted: () => {
        d.destroy();
      },
    });

    driverRef.current = d;
    d.drive(0);
  }, [router]);

  useEffect(() => {
    if (demoTourRequestId > 0 && demoTourRequestId !== lastTourReqRef.current) {
      lastTourReqRef.current = demoTourRequestId;
      void launchTour();
    }
  }, [demoTourRequestId, launchTour]);

  useEffect(() => {
    return () => {
      if (driverRef.current) {
        driverRef.current.destroy();
        driverRef.current = null;
      }
    };
  }, []);

  if (!apiState.isDemo || !welcomeModalOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="demo-welcome-title"
    >
      <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#22306B] text-[#F5B700]">
            <AppIcon name="science" className="text-[22px]" />
          </div>
          <div>
            <span className="inline-flex items-center rounded-full bg-[#F5B700]/20 px-2.5 py-0.5 font-label-sm text-xs font-semibold text-[#22306B]">
              Fictional Demo Workspace
            </span>
            <h2
              id="demo-welcome-title"
              className="mt-2 font-headline-md text-xl font-semibold text-text-primary"
            >
              Welcome to Fade Republic Barbershop (Demo)
            </h2>
            <p className="mt-2 font-body-md text-sm text-text-secondary leading-relaxed">
              You are exploring an isolated demonstration workspace with realistic sample bookings,
              simulated WhatsApp &amp; web-chat transcripts, and mock Kora deposits.{' '}
              <strong className="text-text-primary">
                No real payments or customer messages are ever sent.
              </strong>
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-end gap-2.5 border-t border-border/60 pt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setWelcomeModalOpen(false);
              void exitDemoMode();
            }}
          >
            Exit Demo
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWelcomeModalOpen(false)}>
            Explore Myself
          </Button>
          <Button
            size="sm"
            className="bg-[#22306B] text-white hover:bg-[#1a2554]"
            onClick={() => void launchTour()}
          >
            <AppIcon name="tour" className="text-[16px]" />
            Start Guided Tour
          </Button>
        </div>
      </div>
    </div>
  );
}
