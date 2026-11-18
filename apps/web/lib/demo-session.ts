import { createHmac, timingSafeEqual } from 'node:crypto';
import { parseEnv, webSchema } from '@switchboard/env';
import type { NextResponse } from 'next/server';

const env = parseEnv(webSchema);

const DEMO_SESSION_COOKIE = 'sb_demo_session';
const DEMO_COOKIE_TTL_SECONDS = 60 * 60 * 24;

export interface DemoSessionPayload {
  demoSessionId: string;
  entryOrigin: 'landing' | 'dashboard';
  previousSlug?: string | null;
  iat: number;
}

function getSigningSecret(): string {
  return env.BETTER_AUTH_SECRET || 'dev-only-unvalidated-secret-for-build-phase';
}

function signDigest(encodedPayload: string): string {
  return createHmac('sha256', getSigningSecret()).update(encodedPayload).digest('base64url');
}

function signDemoToken(payload: DemoSessionPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = signDigest(encoded);
  return `${encoded}.${sig}`;
}

function verifyDemoToken(token: string | undefined | null): DemoSessionPayload | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return null;

  const expectedSig = signDigest(encoded);
  const sigBuf = Buffer.from(sig, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8'),
    ) as Partial<DemoSessionPayload>;
    if (
      typeof parsed.demoSessionId !== 'string' ||
      !/^[a-f0-9-]{16,64}$/i.test(parsed.demoSessionId) ||
      (parsed.entryOrigin !== 'landing' && parsed.entryOrigin !== 'dashboard') ||
      typeof parsed.iat !== 'number'
    ) {
      return null;
    }
    if (Date.now() - parsed.iat > DEMO_COOKIE_TTL_SECONDS * 1000) {
      return null;
    }
    return {
      demoSessionId: parsed.demoSessionId,
      entryOrigin: parsed.entryOrigin,
      previousSlug: typeof parsed.previousSlug === 'string' ? parsed.previousSlug : null,
      iat: parsed.iat,
    };
  } catch {
    return null;
  }
}

function parseCookieValue(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx <= 0) continue;
    const key = pair.slice(0, idx).trim();
    if (key === name) {
      return decodeURIComponent(pair.slice(idx + 1).trim());
    }
  }
  return null;
}

export function readDemoSessionFromHeaders(headers: Headers): DemoSessionPayload | null {
  const raw = parseCookieValue(headers.get('cookie'), DEMO_SESSION_COOKIE);
  return verifyDemoToken(raw);
}

export function readDemoSessionFromRequest(request: Request): DemoSessionPayload | null {
  return readDemoSessionFromHeaders(request.headers);
}

export function attachDemoCookie(response: NextResponse, payload: DemoSessionPayload): void {
  response.cookies.set(DEMO_SESSION_COOKIE, signDemoToken(payload), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: DEMO_COOKIE_TTL_SECONDS,
  });
}

export function clearDemoCookie(response: NextResponse): void {
  response.cookies.set(DEMO_SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
  });
}
