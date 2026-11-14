import { describe, expect, it, vi } from 'vitest';
import { createApp } from './app.ts';
import { createLogger, maskPhone } from './logger.ts';

const silent = createLogger({ level: 'silent' });

describe('GET /', () => {
  it('says hello without touching the DB', async () => {
    const pool = { query: vi.fn() };
    const app = createApp({ pool, logger: silent });
    const res = await app.request('/');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ service: 'switchboard-api', status: 'ok' });
    expect(pool.query).not.toHaveBeenCalled();
  });
});

describe('GET /health and /api/health', () => {
  it('is ok when the DB answers', async () => {
    const pool = { query: vi.fn().mockResolvedValue({ rows: [] }) };
    const app = createApp({ pool, logger: silent });
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok', db: 'ok' });
    expect(res.headers.get('x-request-id')).toBeTruthy();

    const resApi = await app.request('/api/health');
    expect(resApi.status).toBe(200);
    expect(await resApi.json()).toEqual({ status: 'ok', db: 'ok' });
  });

  it('is 503 when the DB is down', async () => {
    const pool = { query: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')) };
    const app = createApp({ pool, logger: silent });
    const res = await app.request('/health');
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: 'error', db: 'down' });

    const resApi = await app.request('/api/health');
    expect(resApi.status).toBe(503);
    expect(await resApi.json()).toEqual({ status: 'error', db: 'down' });
  });
});

describe('logger redaction (I8)', () => {
  it('masks phones to the last 4 digits', () => {
    expect(maskPhone('+2348031234567')).toBe('***4567');
    expect(maskPhone('12')).toBe('****');
  });

  it('never writes signatures, auth headers or full phone numbers', () => {
    const lines: string[] = [];
    const logger = createLogger({ level: 'info' }, { write: (line: string) => lines.push(line) });
    logger.info({
      req: { headers: { authorization: 'Bearer sk_test_x', 'x-korapay-signature': 'abc123' } },
      customer: { phone_e164: '+2348031234567' },
    });
    const out = lines.join('');
    expect(out).not.toContain('sk_test_x');
    expect(out).not.toContain('abc123');
    expect(out).not.toContain('8031234567');
    expect(out).toContain('***4567');
  });
});
