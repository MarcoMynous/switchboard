import type { BookingStatus } from '@switchboard/db/schema';

/** Every way a booking operation can be refused. The HTTP layer maps `code` to a status. */
export type DomainError =
  | { code: 'NOT_FOUND'; entity: 'business' | 'service' | 'staff' | 'booking' }
  /** The EXCLUDE constraint refused the insert: someone else holds an overlapping slot. */
  | { code: 'SLOT_TAKEN' }
  | { code: 'OUTSIDE_WORKING_HOURS' }
  | { code: 'TOO_SOON'; minLeadMinutes: number }
  | { code: 'TOO_FAR_AHEAD'; advanceDays: number }
  | { code: 'SAME_DAY_NOT_ALLOWED' }
  | { code: 'STAFF_CANNOT_DO_SERVICE' }
  | { code: 'INVALID_PHONE' }
  | { code: 'INVALID_DATE' }
  /** The same idempotency key was already used for a different service or time. */
  | { code: 'IDEMPOTENCY_KEY_REUSED'; bookingId: string }
  | { code: 'INVALID_TRANSITION'; from: BookingStatus; to: BookingStatus }
  /** Optimistic concurrency: the booking changed since the caller read it. */
  | { code: 'STALE_VERSION'; currentVersion: number };

export type DomainErrorCode = DomainError['code'];
