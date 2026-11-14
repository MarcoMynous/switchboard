import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrateSchema, parseEnv } from '@switchboard/env';
import { afterAll, describe, expect, it } from 'vitest';
import { createPool } from './client.ts';

if (!process.env.DATABASE_URL_UNPOOLED && typeof process.loadEnvFile === 'function') {
  const rootEnv = resolve(fileURLToPath(import.meta.url), '../../../../.env');
  if (existsSync(rootEnv)) {
    process.loadEnvFile(rootEnv);
  }
}

// Runs after `pnpm db:migrate` (CI integration job, or `docker compose exec api pnpm test:int`).
const pool = createPool(parseEnv(migrateSchema).DATABASE_URL_UNPOOLED, { max: 1 });
afterAll(() => pool.end());

describe('migrations', () => {
  it('installs btree_gist (needed by the I1 overlap constraint)', async () => {
    const { rowCount } = await pool.query(
      `SELECT 1 FROM pg_extension WHERE extname = 'btree_gist'`,
    );
    expect(rowCount).toBe(1);
  });

  it('creates businesses with a unique slug', async () => {
    const { rows } = await pool.query<{ indexdef: string }>(
      `SELECT indexdef FROM pg_indexes WHERE tablename = 'businesses' AND indexdef ILIKE '%UNIQUE%(slug)%'`,
    );
    expect(rows).toHaveLength(1);
  });

  it('creates Better Auth tables, foreign keys, and indexes', async () => {
    const { rows: tables } = await pool.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('user', 'session', 'account', 'verification') ORDER BY tablename`,
    );
    expect(tables.map((r) => r.tablename)).toEqual(['account', 'session', 'user', 'verification']);

    const { rows: fks } = await pool.query<{ conname: string }>(
      `SELECT conname FROM pg_constraint WHERE contype = 'f' AND conname IN ('account_user_id_user_id_fk', 'session_user_id_user_id_fk') ORDER BY conname`,
    );
    expect(fks.map((r) => r.conname)).toEqual([
      'account_user_id_user_id_fk',
      'session_user_id_user_id_fk',
    ]);

    const { rows: indexes } = await pool.query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname IN ('account_userId_idx', 'session_userId_idx', 'verification_identifier_idx') ORDER BY indexname`,
    );
    expect(indexes.map((r) => r.indexname)).toEqual([
      'account_userId_idx',
      'session_userId_idx',
      'verification_identifier_idx',
    ]);
  });

  it('creates onboarding tables (services, staff, staff_services, working_hours) and business columns', async () => {
    const { rows: tables } = await pool.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('services', 'staff', 'staff_services', 'working_hours') ORDER BY tablename`,
    );
    expect(tables.map((r) => r.tablename)).toEqual([
      'services',
      'staff',
      'staff_services',
      'working_hours',
    ]);

    const { rows: cols } = await pool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'businesses' AND column_name IN ('owner_user_id', 'phone', 'location', 'schedule', 'default_deposit_kobo', 'free_cancel_hours', 'merchant_bears_cost', 'assistant_name', 'capabilities', 'onboarding_completed') ORDER BY column_name`,
    );
    expect(cols.map((r) => r.column_name)).toEqual([
      'assistant_name',
      'capabilities',
      'default_deposit_kobo',
      'free_cancel_hours',
      'location',
      'merchant_bears_cost',
      'onboarding_completed',
      'owner_user_id',
      'phone',
      'schedule',
    ]);
  });
  it('enforces I1 with the bookings_no_overlap EXCLUDE constraint on held/confirmed only', async () => {
    const { rows } = await pool.query<{ def: string }>(
      `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'bookings_no_overlap' AND contype = 'x'`,
    );
    expect(rows).toHaveLength(1);
    const def = rows[0]?.def ?? '';
    expect(def).toContain('staff_id WITH =');
    expect(def).toContain("tstzrange(starts_at, ends_at, '[)'::text) WITH &&");
    expect(def).toMatch(/held.*confirmed/);
  });

  it('enforces I3/I4 with unique idempotency and event-key indexes', async () => {
    const { rows } = await pool.query<{ indexname: string; indexdef: string }>(
      `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public'
         AND indexname IN ('bookings_idem', 'payments_idem', 'payment_events_provider_key_uq', 'customers_business_phone_uq')
       ORDER BY indexname`,
    );
    expect(rows.map((r) => r.indexname)).toEqual([
      'bookings_idem',
      'customers_business_phone_uq',
      'payment_events_provider_key_uq',
      'payments_idem',
    ]);
    for (const r of rows) expect(r.indexdef).toContain('UNIQUE');
  });
});
