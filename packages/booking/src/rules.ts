import { addMinutes } from 'date-fns';
import type { DomainError } from './errors.ts';
import type { LoadedBusiness } from './load.ts';
import { addDaysToLocalDate, type LocalDate, localDateOf } from './time.ts';

// Business booking-window rules from onboarding (advance_days, allow_same_day), shared by
// findSlots and holdSlot so a slot that's offered is never refused for a window reason.

/** null when `date` is bookable, else why not. Past dates are allowed here: they just yield no slots. */
export function checkBookingDate(
  business: Pick<LoadedBusiness, 'timezone' | 'advanceDays' | 'allowSameDay'>,
  date: LocalDate,
  now: Date,
): DomainError | null {
  const today = localDateOf(now, business.timezone);
  if (!business.allowSameDay && date === today) return { code: 'SAME_DAY_NOT_ALLOWED' };
  if (date > addDaysToLocalDate(today, business.advanceDays)) {
    return { code: 'TOO_FAR_AHEAD', advanceDays: business.advanceDays };
  }
  return null;
}

export function earliestStart(now: Date, minLeadMinutes: number): Date {
  return addMinutes(now, minLeadMinutes);
}
