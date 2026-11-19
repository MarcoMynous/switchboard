import { createMockOpenPaymentsAdapter } from '@switchboard/open-payments';
import { describe, expect, it } from 'vitest';
import { createLogger } from '../logger.ts';
import { interledgerCallbackRoutes, interledgerIntegrationRoutes } from './interledger.ts';

describe('interledgerIntegrationRoutes', () => {
  it('verifies a valid testnet wallet connection', async () => {
    const adapter = createMockOpenPaymentsAdapter();
    const app = interledgerIntegrationRoutes({ getAdapter: async () => adapter });

    const res = await app.request('/test-connection', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ walletAddress: 'https://ilp.interledger-test.dev/fade-republic' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      connected: boolean;
      status: string;
      wallet?: { assetCode: string; assetScale: number };
    };
    expect(body.connected).toBe(true);
    expect(body.status).toBe('test_mode');
    expect(body.wallet?.assetCode).toBe('USD');
  });

  it('blocks SSRF private/localhost wallet URLs in test-connection', async () => {
    const adapter = createMockOpenPaymentsAdapter();
    const app = interledgerIntegrationRoutes({ getAdapter: async () => adapter });

    const res = await app.request('/test-connection', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ walletAddress: 'http://169.254.169.254/latest/meta-data' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      connected: boolean;
      status: string;
      error?: { code: string };
    };
    expect(body.connected).toBe(false);
    expect(body.status).toBe('unavailable');
    expect(body.error?.code).toBe('SSRF_BLOCKED');
  });

  it('reports unavailable when Open Payments server credentials are not configured', async () => {
    const app = interledgerIntegrationRoutes({ getAdapter: async () => null });
    const res = await app.request('/test-connection', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ walletAddress: 'https://ilp.interledger-test.dev/fade-republic' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { connected: boolean; status: string };
    expect(body.connected).toBe(false);
    expect(body.status).toBe('unavailable');
  });
});

describe('interledgerCallbackRoutes /health', () => {
  it('reports safe readiness metadata without leaking secrets', async () => {
    const adapter = createMockOpenPaymentsAdapter();
    const app = interledgerCallbackRoutes({
      db: {} as never,
      logger: createLogger({ level: 'silent' }),
      publicAppUrl: 'https://switchboard-bm.vercel.app',
      mode: 'test',
      testnetOnly: true,
      walletAddress: 'https://ilp.interledger-test.dev/switchboard',
      keyIdConfigured: true,
      privateKeyConfigured: true,
      privateKeySource: 'pem',
      encryptionKeyConfigured: true,
      ngnToUsdRate: 0.000625,
      tokenEncryptionKey: 'super-secret-do-not-leak-in-health-response',
      getAdapter: async () => adapter,
    });

    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const raw = await res.text();
    expect(raw).not.toContain('super-secret');
    const body = JSON.parse(raw) as {
      mode: string;
      configured: boolean;
      clientInitialized: boolean;
      privateKeySource: string;
      testnetOnlyEnforced: boolean;
      liveMoneyBlocked: boolean;
      redirectUri: string;
    };
    expect(body.mode).toBe('test');
    expect(body.configured).toBe(true);
    expect(body.clientInitialized).toBe(true);
    expect(body.privateKeySource).toBe('pem');
    expect(body.testnetOnlyEnforced).toBe(true);
    expect(body.liveMoneyBlocked).toBe(true);
    expect(body.redirectUri).toBe(
      'https://switchboard-bm.vercel.app/api/payments/interledger/callback',
    );
  });
});
