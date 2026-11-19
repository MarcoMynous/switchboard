import { createDb, createPool } from '@switchboard/db';
import { apiSchema, parseEnv } from '@switchboard/env';
import {
  createMockOpenPaymentsAdapter,
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

  const resolvedPublicAppUrl =
    process.env.VERCEL === '1' &&
    env.PUBLIC_APP_URL.startsWith('http://localhost') &&
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : env.PUBLIC_APP_URL;

  const isLiveApproved =
    (env.OPEN_PAYMENTS_ENV === 'production' || env.OPEN_PAYMENTS_MODE === 'live') &&
    env.OPEN_PAYMENTS_PRODUCTION_APPROVED;

  const walletAddressRaw =
    env.OPEN_PAYMENTS_WALLET_ADDRESS ?? env.OPEN_PAYMENTS_CLIENT_WALLET_ADDRESS ?? '';
  const normalizedWalletAddress = walletAddressRaw.trim().startsWith('$')
    ? `https://${walletAddressRaw.trim().slice(1)}`
    : walletAddressRaw.trim();

  let cachedAdapter: Promise<OpenPaymentsAdapter | null> | null = null;
  const isRealOpenPaymentsEnabled =
    env.OPEN_PAYMENTS_ENABLED || env.OPEN_PAYMENTS_MODE !== 'disabled';
  const getAdapter = () => {
    if (!isRealOpenPaymentsEnabled) {
      if (env.OPEN_PAYMENTS_ENV === 'production' || env.OPEN_PAYMENTS_MODE === 'live') {
        return Promise.resolve(null);
      }
      if (!cachedAdapter) {
        const redirectBase = `${resolvedPublicAppUrl.replace(/\/+$/, '')}/ilp-sandbox/authorize`;
        cachedAdapter = Promise.resolve(
          createMockOpenPaymentsAdapter({
            sandboxRedirectBaseUrl: redirectBase,
            allowDynamicTestnetWallets: true,
          }),
        );
      }
      return cachedAdapter;
    }
    if (!cachedAdapter) {
      cachedAdapter = createRealOpenPaymentsAdapter({
        walletAddressUrl: normalizedWalletAddress,
        ...(env.OPEN_PAYMENTS_PRIVATE_KEY_PEM
          ? { privateKeyPem: env.OPEN_PAYMENTS_PRIVATE_KEY_PEM }
          : {}),
        ...(env.OPEN_PAYMENTS_PRIVATE_KEY_PATH
          ? { privateKeyPath: env.OPEN_PAYMENTS_PRIVATE_KEY_PATH }
          : {}),
        keyId: env.OPEN_PAYMENTS_KEY_ID ?? '',
      });
    }
    return cachedAdapter;
  };

  const privateKeySource: 'pem' | 'path' | 'none' = env.OPEN_PAYMENTS_PRIVATE_KEY_PEM
    ? 'pem'
    : env.OPEN_PAYMENTS_PRIVATE_KEY_PATH
      ? 'path'
      : 'none';

  return {
    env,
    logger,
    pool,
    app: createApp({
      pool,
      db,
      bookingConfig,
      logger,
      publicAppUrl: resolvedPublicAppUrl,
      openPayments: {
        mode: isRealOpenPaymentsEnabled ? (isLiveApproved ? 'live' : 'test') : 'disabled',
        testnetOnly: !isLiveApproved,
        walletAddress: normalizedWalletAddress || null,
        keyIdConfigured: Boolean(env.OPEN_PAYMENTS_KEY_ID),
        privateKeyConfigured: privateKeySource !== 'none',
        privateKeySource,
        encryptionKeyConfigured: Boolean(env.OPEN_PAYMENTS_TOKEN_ENCRYPTION_KEY),
        ngnToUsdRate: env.OPEN_PAYMENTS_NGN_TO_USD_RATE,
        tokenEncryptionKey: env.OPEN_PAYMENTS_TOKEN_ENCRYPTION_KEY ?? env.BETTER_AUTH_SECRET,
        ...(env.OPEN_PAYMENTS_REDIRECT_URI ? { redirectUri: env.OPEN_PAYMENTS_REDIRECT_URI } : {}),
        getAdapter,
      },
    }),
  };
}
