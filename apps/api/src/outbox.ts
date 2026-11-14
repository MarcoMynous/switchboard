import type { Db } from '@switchboard/db';
import { outbox } from '@switchboard/db/schema';
import { inArray, isNull, sql } from 'drizzle-orm';

export interface OutboxEvent {
  /** The outbox row id: Inngest dedupes events by id, so a resend after a crash is harmless. */
  id: string;
  name: string;
  data: Record<string, unknown>;
}

/**
 * Relays undispatched outbox rows to Inngest (transactional outbox). Rows are locked with
 * SKIP LOCKED, so overlapping relay runs split the work instead of double-sending; a send that
 * fails rolls the batch back for the next run, and a crash after sending is deduped by event id.
 */
export async function relayOutbox(
  db: Db,
  send: (events: OutboxEvent[]) => Promise<unknown>,
  batchSize = 100,
): Promise<number> {
  let ids: string[] = [];
  try {
    return await db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(outbox)
        .where(isNull(outbox.dispatchedAt))
        .orderBy(outbox.createdAt)
        .limit(batchSize)
        .for('update', { skipLocked: true });
      if (rows.length === 0) return 0;
      ids = rows.map((r) => r.id);
      await send(rows.map((r) => ({ id: r.id, name: r.topic, data: r.payload })));
      await tx
        .update(outbox)
        .set({ dispatchedAt: sql`now()`, attempts: sql`${outbox.attempts} + 1` })
        .where(inArray(outbox.id, ids));
      return rows.length;
    });
  } catch (e) {
    // Record the failed attempt outside the rolled-back transaction, for the chaos dashboard.
    if (ids.length > 0) {
      await db
        .update(outbox)
        .set({ attempts: sql`${outbox.attempts} + 1` })
        .where(inArray(outbox.id, ids));
    }
    throw e;
  }
}
