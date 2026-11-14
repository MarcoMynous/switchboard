import {
  type BookingConfig,
  type Clock,
  DEFAULT_CONFIG,
  type Executor,
  systemClock,
} from './context.ts';
import type { DomainError } from './errors.ts';
import {
  dayBounds,
  loadBusiness,
  loadBusy,
  loadEligibleStaff,
  loadService,
  loadWorkingWindows,
} from './load.ts';
import { err, ok, type Result } from './result.ts';
import { checkBookingDate, earliestStart } from './rules.ts';
import { computeSlots, type Slot } from './slots.ts';
import { parseLocalDate } from './time.ts';

export interface FindSlotsInput {
  businessId: string;
  serviceId: string;
  /** Business-local calendar date, 'YYYY-MM-DD'. */
  date: string;
  staffId?: string;
  limit?: number;
}

export interface FindSlotsDeps {
  config?: BookingConfig;
  clock?: Clock;
}

/**
 * Read-only availability for one business-local day (docs/04-booking-engine.md → Availability).
 * A suggestion only: holdSlot + the EXCLUDE constraint decide the truth.
 */
export async function findSlots(
  db: Executor,
  input: FindSlotsInput,
  deps: FindSlotsDeps = {},
): Promise<Result<Slot[], DomainError>> {
  const config = deps.config ?? DEFAULT_CONFIG;
  const now = (deps.clock ?? systemClock)();

  const date = parseLocalDate(input.date);
  if (!date) return err({ code: 'INVALID_DATE' });

  const business = await loadBusiness(db, input.businessId);
  if (!business) return err({ code: 'NOT_FOUND', entity: 'business' });
  const service = await loadService(db, input.businessId, input.serviceId);
  if (!service) return err({ code: 'NOT_FOUND', entity: 'service' });

  const windowError = checkBookingDate(business, date, now);
  if (windowError) return err(windowError);

  const eligible = await loadEligibleStaff(db, input.businessId, input.serviceId, input.staffId);
  if (input.staffId && eligible.length === 0) return err({ code: 'STAFF_CANNOT_DO_SERVICE' });

  const ids = eligible.map((s) => s.id);
  const windows = await loadWorkingWindows(db, ids, date, business.timezone);
  const busy = await loadBusy(db, ids, dayBounds(date, business.timezone));

  return ok(
    computeSlots({
      staff: ids.map((id) => ({
        staffId: id,
        windows: windows.get(id) ?? [],
        busy: busy.get(id) ?? [],
      })),
      durationMin: service.durationMin,
      stepMin: config.slotStepMinutes,
      earliestStart: earliestStart(now, config.minLeadMinutes),
      limit: input.limit ?? 12,
    }),
  );
}
