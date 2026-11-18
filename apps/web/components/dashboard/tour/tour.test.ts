import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import {
  INTRO_TOUR_DESKTOP_STEPS,
  INTRO_TOUR_ID,
  INTRO_TOUR_MOBILE_STEPS,
  PAGE_TOURS,
} from './tour-definitions.ts';
import { getTourStatus, setTourStatus } from './tour-storage.ts';

function createMockStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
}

describe('tour-storage', () => {
  const originalWindow = globalThis.window;

  beforeEach(() => {
    const localStorage = createMockStorage();
    Object.defineProperty(globalThis, 'window', {
      value: { localStorage },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'window', {
      value: originalWindow,
      configurable: true,
      writable: true,
    });
  });

  it('defaults to not_started for a new workspace', () => {
    assert.equal(getTourStatus('fade-republic', INTRO_TOUR_ID), 'not_started');
  });

  it('persists skipped and completed states scoped by business', () => {
    setTourStatus('fade-republic', INTRO_TOUR_ID, 'skipped');
    assert.equal(getTourStatus('fade-republic', INTRO_TOUR_ID), 'skipped');
    assert.equal(getTourStatus('other-salon', INTRO_TOUR_ID), 'not_started');

    setTourStatus('fade-republic', INTRO_TOUR_ID, 'completed');
    assert.equal(getTourStatus('fade-republic', INTRO_TOUR_ID), 'completed');
  });

  it('tracks page-specific tours independently from the intro tour', () => {
    setTourStatus('fade-republic', INTRO_TOUR_ID, 'completed');
    setTourStatus('fade-republic', 'bookings_v1', 'skipped');

    assert.equal(getTourStatus('fade-republic', INTRO_TOUR_ID), 'completed');
    assert.equal(getTourStatus('fade-republic', 'bookings_v1'), 'skipped');
  });
});

describe('tour-definitions', () => {
  it('defines a 12-step desktop intro tour with stable data-tour selectors', () => {
    assert.equal(INTRO_TOUR_DESKTOP_STEPS.length, 12);
    const targets = INTRO_TOUR_DESKTOP_STEPS.filter((s) => s.target).map((s) => s.target);
    assert.ok(targets.every((t) => t?.startsWith('[data-tour="')));
    assert.equal(INTRO_TOUR_DESKTOP_STEPS.at(-1)?.id, 'tour-complete');
    assert.equal(INTRO_TOUR_DESKTOP_STEPS.at(-1)?.target, undefined);
  });

  it('uses a shorter mobile tour that avoids hidden desktop sidebar items', () => {
    assert.ok(INTRO_TOUR_MOBILE_STEPS.length < INTRO_TOUR_DESKTOP_STEPS.length);
    const targets = INTRO_TOUR_MOBILE_STEPS.map((s) => s.target ?? '');
    assert.ok(targets.includes('[data-tour="mobile-nav-trigger"]'));
    assert.ok(targets.includes('[data-tour="mobile-bottom-nav"]'));
    assert.ok(!targets.some((t) => t.includes('nav-bookings')));
    assert.ok(!targets.some((t) => t.includes('workspace-switcher')));
  });

  it('only registers page-specific tours for implemented pages', () => {
    assert.ok(PAGE_TOURS.bookings);
    assert.ok(PAGE_TOURS.conversations);
    assert.ok(PAGE_TOURS.customers);
    assert.ok(PAGE_TOURS['ai-receptionist']);
    assert.ok(PAGE_TOURS['services-staff']);
    assert.ok(PAGE_TOURS.payments);

    // Placeholder pages must not offer tours
    assert.equal(PAGE_TOURS['working-hours'], undefined);
    assert.equal(PAGE_TOURS.integrations, undefined);
    assert.equal(PAGE_TOURS.analytics, undefined);
    assert.equal(PAGE_TOURS['team-permissions'], undefined);
  });
});
