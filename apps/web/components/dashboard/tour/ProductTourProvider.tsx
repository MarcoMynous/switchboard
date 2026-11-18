'use client';

import type { Driver, DriveStep } from 'driver.js';
import { usePathname, useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { type NavSection, useDashboard } from '../DashboardContext';
import {
  INTRO_TOUR_DESKTOP_STEPS,
  INTRO_TOUR_ID,
  INTRO_TOUR_MOBILE_STEPS,
  PAGE_TOURS,
  type TourStepDefinition,
} from './tour-definitions';
import { getTourStatus, setTourStatus, type TourId } from './tour-storage';
import { WelcomeTourDialog } from './WelcomeTourDialog';
import './tour.css';

interface ProductTourContextValue {
  isTourActive: boolean;
  startIntroTour: () => void;
  startPageTour: (section: NavSection) => void;
  canOfferPageTour: (section: NavSection) => boolean;
  getPageTourLabel: (section: NavSection) => string | null;
}

const ProductTourContext = createContext<ProductTourContextValue | null>(null);

interface PendingTourRun {
  tourId: TourId;
  route: string;
  steps: TourStepDefinition[];
}

function isElementVisible(selector: string): boolean {
  const el = document.querySelector(selector);
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  const style = window.getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

function waitForSelector(
  selector: string,
  signal: AbortSignal,
  timeoutMs = 5000,
): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve(false);
      return;
    }

    if (isElementVisible(selector)) {
      resolve(true);
      return;
    }

    let settled = false;
    const finish = (found: boolean) => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      clearTimeout(timeoutId);
      resolve(found);
    };

    const observer = new MutationObserver(() => {
      requestAnimationFrame(() => {
        if (signal.aborted) {
          finish(false);
        } else if (isElementVisible(selector)) {
          finish(true);
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'data-tour'],
    });

    const timeoutId = window.setTimeout(() => finish(isElementVisible(selector)), timeoutMs);

    signal.addEventListener(
      'abort',
      () => {
        finish(false);
      },
      { once: true },
    );
  });
}

function toDriveSteps(definitions: TourStepDefinition[]): DriveStep[] {
  const result: DriveStep[] = [];
  for (const def of definitions) {
    if (def.target && !isElementVisible(def.target)) {
      continue;
    }
    result.push({
      element: def.target,
      popover: {
        title: def.title,
        description: def.description,
        side: def.side,
        align: def.align,
      },
    });
  }
  return result;
}

export function ProductTourProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { workspace, apiState, setSidebarOpenMobile } = useDashboard();

  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [isTourActive, setIsTourActive] = useState(false);

  const driverRef = useRef<Driver | null>(null);
  const pendingRunRef = useRef<PendingTourRun | null>(null);
  const waitAbortRef = useRef<AbortController | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const welcomeCheckedRef = useRef<string | null>(null);

  const scopeKey = useMemo(
    () => workspace.slug || workspace.businessName || 'default',
    [workspace.slug, workspace.businessName],
  );

  const restoreFocus = useCallback(() => {
    const prev = previousFocusRef.current;
    previousFocusRef.current = null;
    if (prev && document.contains(prev)) {
      requestAnimationFrame(() => prev.focus());
    }
  }, []);

  const cleanupDriver = useCallback(() => {
    waitAbortRef.current?.abort();
    waitAbortRef.current = null;
    if (driverRef.current) {
      driverRef.current.destroy();
      driverRef.current = null;
    }
    setIsTourActive(false);
  }, []);

  useEffect(() => {
    return () => {
      cleanupDriver();
    };
  }, [cleanupDriver]);

  // Show first-time welcome dialog once workspace data finishes loading for owners
  useEffect(() => {
    if (apiState.loading) return;
    if (apiState.role !== 'owner') return;
    if (!workspace.businessName && !workspace.slug) return;
    if (welcomeCheckedRef.current === scopeKey) return;

    welcomeCheckedRef.current = scopeKey;
    const status = getTourStatus(scopeKey, INTRO_TOUR_ID);
    if (status === 'not_started') {
      setWelcomeOpen(true);
    }
  }, [apiState.loading, apiState.role, scopeKey, workspace.businessName, workspace.slug]);

  const launchDriver = useCallback(
    async (tourId: TourId, stepDefinitions: TourStepDefinition[]) => {
      cleanupDriver();
      setSidebarOpenMobile(false);

      previousFocusRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;

      const steps = toDriveSteps(stepDefinitions);
      if (steps.length === 0) {
        return;
      }

      const { driver } = await import('driver.js');
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      let outcomeRecorded = false;

      const recordOutcome = (status: 'completed' | 'skipped') => {
        if (outcomeRecorded) return;
        outcomeRecorded = true;
        setTourStatus(scopeKey, tourId, status);
      };

      const instance = driver({
        steps,
        animate: !prefersReducedMotion,
        duration: prefersReducedMotion ? 0 : 300,
        overlayColor: '#22306B',
        overlayOpacity: 0.56,
        stagePadding: 10,
        stageRadius: 12,
        smoothScroll: !prefersReducedMotion,
        scrollIntoView: { block: 'center', inline: 'nearest' },
        allowClose: true,
        allowKeyboardControl: true,
        disableActiveInteraction: true,
        skipMissingElement: true,
        popoverClass: 'switchboard-tour-popover',
        popoverOffset: 12,
        showProgress: true,
        progressText: 'Step {{current}} of {{total}}',
        nextBtnText: 'Next',
        prevBtnText: 'Back',
        doneBtnText: 'Finish',
        closeBtnLabel: 'Close tour',
        showButtons: ['previous', 'next', 'close'],
        onPopoverRender: (popover, opts) => {
          popover.wrapper.setAttribute('aria-label', 'Guided product tour');
          popover.description.setAttribute('aria-live', 'polite');
          popover.previousButton.setAttribute('aria-label', 'Previous tour step');
          popover.closeButton.setAttribute('aria-label', 'Close tour');

          const isLast = opts.driver.isLastStep();
          popover.nextButton.setAttribute('aria-label', isLast ? 'Finish tour' : 'Next tour step');

          const existingSkip = popover.footerButtons.querySelector('.switchboard-tour-skip-btn');
          if (!isLast && !existingSkip) {
            const skipBtn = document.createElement('button');
            skipBtn.type = 'button';
            skipBtn.className = 'switchboard-tour-skip-btn';
            skipBtn.textContent = 'Skip tour';
            skipBtn.setAttribute('aria-label', 'Skip guided tour');
            skipBtn.addEventListener('click', () => {
              recordOutcome('skipped');
              opts.driver.destroy();
            });
            popover.footerButtons.insertBefore(skipBtn, popover.previousButton);
          }
        },
        onDoneClick: (_el, _step, opts) => {
          recordOutcome('completed');
          opts.driver.destroy();
        },
        onCloseClick: (_el, _step, opts) => {
          recordOutcome('skipped');
          opts.driver.destroy();
        },
        onDestroyed: (_el, _step, opts) => {
          if (!outcomeRecorded) {
            recordOutcome(opts.reason === 'done' ? 'completed' : 'skipped');
          }
          driverRef.current = null;
          setIsTourActive(false);
          setSidebarOpenMobile(false);
          restoreFocus();
        },
      });

      driverRef.current = instance;
      setIsTourActive(true);
      instance.drive(0);
    },
    [cleanupDriver, restoreFocus, scopeKey, setSidebarOpenMobile],
  );

  // Resume pending cross-route tour once target route and element mount
  useEffect(() => {
    const pending = pendingRunRef.current;
    if (!pending) return;

    const isOnTargetRoute =
      pending.route === '/dashboard'
        ? pathname === '/dashboard' || pathname === '/dashboard/overview'
        : pathname.startsWith(pending.route);

    if (!isOnTargetRoute) return;

    const firstTarget = pending.steps.find((s) => Boolean(s.target))?.target;
    waitAbortRef.current?.abort();
    const controller = new AbortController();
    waitAbortRef.current = controller;

    const run = async () => {
      if (firstTarget) {
        await waitForSelector(firstTarget, controller.signal);
      }
      if (controller.signal.aborted) return;
      pendingRunRef.current = null;
      await launchDriver(pending.tourId, pending.steps);
    };

    void run();

    return () => {
      controller.abort();
    };
  }, [pathname, launchDriver]);

  const startTourOnRoute = useCallback(
    (tourId: TourId, route: string, steps: TourStepDefinition[]) => {
      setWelcomeOpen(false);
      const isOnTargetRoute =
        route === '/dashboard'
          ? pathname === '/dashboard' || pathname === '/dashboard/overview'
          : pathname.startsWith(route);

      if (!isOnTargetRoute) {
        pendingRunRef.current = { tourId, route, steps };
        router.push(route);
        return;
      }

      void launchDriver(tourId, steps);
    },
    [launchDriver, pathname, router],
  );

  const startIntroTour = useCallback(() => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;
    const steps = isMobile ? INTRO_TOUR_MOBILE_STEPS : INTRO_TOUR_DESKTOP_STEPS;
    startTourOnRoute(INTRO_TOUR_ID, '/dashboard', steps);
  }, [startTourOnRoute]);

  const startPageTour = useCallback(
    (section: NavSection) => {
      const config = PAGE_TOURS[section];
      if (!config) return;
      startTourOnRoute(config.tourId, config.route, config.steps);
    },
    [startTourOnRoute],
  );

  const canOfferPageTour = useCallback((section: NavSection) => Boolean(PAGE_TOURS[section]), []);

  const getPageTourLabel = useCallback(
    (section: NavSection) => PAGE_TOURS[section]?.label ?? null,
    [],
  );

  const handleMaybeLater = useCallback(() => {
    setWelcomeOpen(false);
    setTourStatus(scopeKey, INTRO_TOUR_ID, 'skipped');
  }, [scopeKey]);

  const value = useMemo<ProductTourContextValue>(
    () => ({
      isTourActive,
      startIntroTour,
      startPageTour,
      canOfferPageTour,
      getPageTourLabel,
    }),
    [isTourActive, startIntroTour, startPageTour, canOfferPageTour, getPageTourLabel],
  );

  return (
    <ProductTourContext.Provider value={value}>
      {children}
      <WelcomeTourDialog
        open={welcomeOpen}
        businessName={workspace.businessName}
        onStartTour={startIntroTour}
        onMaybeLater={handleMaybeLater}
      />
    </ProductTourContext.Provider>
  );
}

export function useProductTour(): ProductTourContextValue {
  const ctx = useContext(ProductTourContext);
  if (!ctx) {
    throw new Error('useProductTour must be used within a ProductTourProvider');
  }
  return ctx;
}
