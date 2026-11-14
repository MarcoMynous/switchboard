import { createDb, createPool } from '@switchboard/db';
import { apiSchema, parseEnv } from '@switchboard/env';
import { createApp } from './app.ts';
import { createLogger } from './logger.ts';

/** Wire real dependencies from validated env. Crashes at boot if env is wrong. */
export function boot() {
  const env = parseEnv(apiSchema);
  const logger = createLogger({ level: env.NODE_ENV === 'production' ? 'info' : 'debug' });
  const pool = createPool(env.DATABASE_URL);
  pool.on('error', (err) => logger.error({ err }, 'pg pool idle client error'));
  const db = createDb(pool);
  const bookingConfig = {
    holdMinutes: env.HOLD_MINUTES,
    minLeadMinutes: env.MIN_LEAD_MINUTES,
    slotStepMinutes: env.SLOT_STEP_MINUTES,
  };
  return { env, logger, pool, app: createApp({ pool, db, bookingConfig, logger }) };
}
