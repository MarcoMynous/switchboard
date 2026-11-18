import { createMockOpenPaymentsAdapter } from '@switchboard/open-payments';
import { describe, expect, it } from 'vitest';
import { interledgerIntegrationRoutes } from './interledger.ts';

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
