import { createDb, createPool } from '@switchboard/db';
import { apiSchema, parseEnv } from '@switchboard/env';
import {
  createRealOpenPaymentsAdapter,
  type OpenPaymentsAdapter,
} from '@switchboard/open-payments';
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

  let cachedAdapter: Promise<OpenPaymentsAdapter | null> | null = null;
  const getAdapter = () => {
    if (!env.OPEN_PAYMENTS_ENABLED) return Promise.resolve(null);
    if (!cachedAdapter) {
      cachedAdapter = createRealOpenPaymentsAdapter({
        walletAddressUrl: env.OPEN_PAYMENTS_CLIENT_WALLET_ADDRESS ?? '',
        privateKeyPem: env.OPEN_PAYMENTS_PRIVATE_KEY_PEM ?? '',
        keyId: env.OPEN_PAYMENTS_KEY_ID ?? '',
      });
    }
    return cachedAdapter;
  };

  return {
    env,
    logger,
    pool,
    app: createApp({
      pool,
      db,
      bookingConfig,
      logger,
      publicAppUrl: env.PUBLIC_APP_URL,
      openPayments: {
        ngnToUsdRate: env.OPEN_PAYMENTS_NGN_TO_USD_RATE,
        tokenEncryptionKey: env.OPEN_PAYMENTS_TOKEN_ENCRYPTION_KEY ?? env.BETTER_AUTH_SECRET,
        getAdapter,
      },
    }),
  };
}
