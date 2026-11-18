export type TourStatus = 'not_started' | 'skipped' | 'completed';

export type TourId =
  | 'intro_v1'
  | 'bookings_v1'
  | 'conversations_v1'
  | 'customers_v1'
  | 'ai-receptionist_v1'
  | 'services-staff_v1'
  | 'payments_v1';

const STORAGE_PREFIX = 'switchboard:product-tour';

function buildStorageKey(scopeKey: string, tourId: TourId): string {
  const safeScope = scopeKey.trim() || 'default';
  return `${STORAGE_PREFIX}:${safeScope}:${tourId}`;
}

export function getTourStatus(scopeKey: string, tourId: TourId = 'intro_v1'): TourStatus {
  if (typeof window === 'undefined') return 'not_started';
  try {
    const raw = window.localStorage.getItem(buildStorageKey(scopeKey, tourId));
    if (raw === 'completed' || raw === 'skipped' || raw === 'not_started') {
      return raw;
    }
    return 'not_started';
  } catch {
    return 'not_started';
  }
}

export function setTourStatus(scopeKey: string, tourId: TourId, status: TourStatus): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(buildStorageKey(scopeKey, tourId), status);
  } catch {
    // Ignore storage quota or private browsing errors
  }
}
