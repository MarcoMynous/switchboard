import { DEFAULT_CONFIG } from '@switchboard/booking';
import { createDb, createPool } from '@switchboard/db';
import { dbSchema, parseEnv } from '@switchboard/env';
import { afterAll, expect, it } from 'vitest';
import { createApp } from './app.ts';
import { createLogger } from './logger.ts';

const pool = createPool(parseEnv(dbSchema).DATABASE_URL, { max: 1 });
afterAll(() => pool.end());

it('GET /health reaches real Postgres', async () => {
  const res = await createApp({
    pool,
    db: createDb(pool),
    bookingConfig: DEFAULT_CONFIG,
    logger: createLogger({ level: 'silent' }),
  }).request('/health');
  expect(res.status).toBe(200);
});
