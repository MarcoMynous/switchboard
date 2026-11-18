import { expireHold, sweepExpiredHolds } from '@switchboard/booking';
import { type Db, payments } from '@switchboard/db';
import type { OpenPaymentsAdapter } from '@switchboard/open-payments';
import { and, eq, inArray } from 'drizzle-orm';
import { Inngest, type InngestFunction } from 'inngest';
import type { Logger } from './logger.ts';
import { relayOutbox } from './outbox.ts';
import { verifyAndSettleInterledgerPayment } from './payments/verify-interledger.ts';

// Dev vs cloud is picked from INNGEST_DEV / INNGEST_BASE_URL / INNGEST_*_KEY (validated in @switchboard/env).
export const inngest = new Inngest({ id: 'switchboard' });

/** Slack after the deadline so app/Inngest clock skew can't wake us before Postgres agrees it's due. */
const EXPIRY_GRACE_MS = 5_000;

export function createFunctions({
  db,
  logger,
  getOpenPaymentsAdapter,
}: {
  db: Db;
  logger?: Logger;
  getOpenPaymentsAdapter?: () => Promise<OpenPaymentsAdapter | null>;
}): InngestFunction.Any[] {
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

  /** Durable Interledger receipt verification with automatic retries on provider timeout/delay. */
  const interledgerVerify = inngest.createFunction(
    {
      id: 'interledger-payment-verify',
      triggers: [{ event: 'interledger/payment.verify' }],
      idempotency: 'event.data.paymentId',
      retries: 5,
    },
    async ({ event, step }) => {
      const { paymentId } = event.data as { paymentId: string };
      if (!getOpenPaymentsAdapter || !logger) {
        return { status: 'skipped', reason: 'adapter_not_configured' };
      }
      const adapter = await getOpenPaymentsAdapter();
      if (!adapter) {
        return { status: 'skipped', reason: 'adapter_disabled' };
      }
      const outcome = await step.run('verify-receipt', () =>
        verifyAndSettleInterledgerPayment({ db, adapter, logger, paymentId }),
      );
      if (outcome.status === 'pending_verification') {
        throw new Error(`Interledger verification pending: ${outcome.reason}`);
      }
      return outcome;
    },
  );

  /** Reconciliation cron: sweeps pending_verification Interledger payments every 5 minutes. */
  const interledgerReconcile = inngest.createFunction(
    { id: 'interledger-reconcile', triggers: [{ cron: '*/5 * * * *' }] },
    async ({ step }) => {
      if (!getOpenPaymentsAdapter || !logger) {
        return { checked: 0 };
      }
      const adapter = await getOpenPaymentsAdapter();
      if (!adapter) return { checked: 0 };

      const pendingRows = await step.run('load-pending', () =>
        db.query.payments.findMany({
          where: and(
            eq(payments.provider, 'interledger'),
            inArray(payments.status, ['pending_verification']),
          ),
          limit: 50,
        }),
      );

      let confirmed = 0;
      for (const row of pendingRows) {
        const res = await step.run(`verify-${row.id}`, () =>
          verifyAndSettleInterledgerPayment({ db, adapter, logger, paymentId: row.id }),
        );
        if (res.status === 'confirmed') confirmed++;
      }
      return { checked: pendingRows.length, confirmed };
    },
  );

  return [holdExpire, holdSweeper, outboxRelay, interledgerVerify, interledgerReconcile];
}
