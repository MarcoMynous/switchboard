import type { Db } from '@switchboard/db';

/** A database handle or an open transaction: lets callers compose booking ops into their own tx. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export type Executor = Db | Tx;

/** Defaults match @switchboard/env bookingSchema (docs/04-booking-engine.md → Configuration). */
export interface BookingConfig {
  holdMinutes: number;
  minLeadMinutes: number;
  slotStepMinutes: number;
}

export const DEFAULT_CONFIG: BookingConfig = {
  holdMinutes: 15,
  minLeadMinutes: 30,
  slotStepMinutes: 15,
};

/** Injected clock for app-side rules (lead time, booking window). Hold expiry uses Postgres now(). */
export type Clock = () => Date;
export const systemClock: Clock = () => new Date();
