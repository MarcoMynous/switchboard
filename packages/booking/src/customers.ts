import { type Customer, customers } from '@switchboard/db/schema';
import { sql } from 'drizzle-orm';
import type { Executor } from './context.ts';
import type { DomainError } from './errors.ts';
import { toE164 } from './phone.ts';
import { err, ok, type Result } from './result.ts';

/**
 * Finds or creates the customer for a phone number, idempotently: concurrent calls for the same
 * number get the same row (UNIQUE (business_id, phone_e164)). A new name only fills a blank one.
 */
export async function upsertCustomer(
  db: Executor,
  input: { businessId: string; phone: string; name?: string },
): Promise<Result<Customer, DomainError>> {
  const phoneE164 = toE164(input.phone);
  if (!phoneE164) return err({ code: 'INVALID_PHONE' });
  const name = input.name?.trim() || null;

  const [row] = await db
    .insert(customers)
    .values({ businessId: input.businessId, phoneE164, name })
    .onConflictDoUpdate({
      target: [customers.businessId, customers.phoneE164],
      // No-op update so RETURNING always yields the row; keep an existing name.
      set: { name: sql`coalesce(${customers.name}, excluded.name)` },
    })
    .returning();
  if (!row) throw new Error('customer upsert returned no row');
  return ok(row);
}
