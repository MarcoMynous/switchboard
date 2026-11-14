import { expireHold, sweepExpiredHolds } from '@switchboard/booking';
import type { Db } from '@switchboard/db';
import { Inngest, type InngestFunction } from 'inngest';
import { relayOutbox } from './outbox.ts';

// Dev vs cloud is picked from INNGEST_DEV / INNGEST_BASE_URL / INNGEST_*_KEY (validated in @switchboard/env).
export const inngest = new Inngest({ id: 'switchboard' });

/** Slack after the deadline so app/Inngest clock skew can't wake us before Postgres agrees it's due. */
const EXPIRY_GRACE_MS = 5_000;

export function createFunctions({ db }: { db: Db }): InngestFunction.Any[] {
  /**
   * hold.expire (docs/04-booking-engine.md → Expire): sleep until the hold's deadline, then expire
   * it if it's still held. One run per booking; a confirmed/cancelled hold makes this a no-op.
   */
  const holdExpire = inngest.createFunction(
    {
      id: 'hold-expire',
      triggers: [{ event: 'booking.held' }],
      idempotency: 'event.data.bookingId',
      retries: 5,
    },
    async ({ event, step }) => {
      const { bookingId, holdExpiresAt } = event.data as {
        bookingId: string;
        holdExpiresAt: string;
      };
      await step.sleepUntil(
        'until-deadline',
        new Date(Date.parse(holdExpiresAt) + EXPIRY_GRACE_MS),
      );
      const expired = await step.run('expire', () => expireHold(db, bookingId));
      return { bookingId, expired };
    },
  );

  /** Sweeper: catches any hold whose expire run was missed or failed (guarantee 3). */
  const holdSweeper = inngest.createFunction(
    { id: 'hold-sweeper', triggers: [{ cron: '*/5 * * * *' }] },
    async ({ step }) => {
      const expired = await step.run('sweep', () => sweepExpiredHolds(db));
      return { expired: expired.length };
    },
  );

  /** Outbox relay: turns committed state changes into Inngest events (booking.held → hold-expire). */
  const outboxRelay = inngest.createFunction(
    { id: 'outbox-relay', triggers: [{ cron: '* * * * *' }], concurrency: { limit: 1 } },
    async ({ step }) => {
      const relayed = await step.run('relay', () =>
        relayOutbox(db, (events) => inngest.send(events)),
      );
      return { relayed };
    },
  );

  return [holdExpire, holdSweeper, outboxRelay];
}
