import type { BookingStatus } from '@switchboard/db/schema';

/**
 * The booking state machine (docs/03-data-model.md) as data. Anything not listed is refused.
 *
 *   held ──payment verified──▶ confirmed ──▶ completed
 *    │  └──▶ cancelled            │  └──▶ cancelled
 *    ▼                            ▼
 *  expired                     no_show
 *
 * A no-deposit service skips `held`: hold_slot inserts `confirmed` directly.
 */
export const TRANSITIONS: Readonly<Record<BookingStatus, readonly BookingStatus[]>> = {
  held: ['confirmed', 'expired', 'cancelled'],
  confirmed: ['completed', 'cancelled', 'no_show'],
  expired: [],
  cancelled: [],
  completed: [],
  no_show: [],
};

/** Statuses that occupy the staff member's time (the EXCLUDE constraint's WHERE clause). */
export const ACTIVE_STATUSES = ['held', 'confirmed'] as const satisfies readonly BookingStatus[];

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function isTerminal(status: BookingStatus): boolean {
  return TRANSITIONS[status].length === 0;
}

/** Every status `to` can be reached from: used as the `WHERE status = ANY(...)` guard. */
export function sourcesOf(to: BookingStatus): BookingStatus[] {
  return (Object.keys(TRANSITIONS) as BookingStatus[]).filter((from) => canTransition(from, to));
}
