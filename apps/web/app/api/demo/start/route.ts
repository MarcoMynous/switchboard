import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { customersPool } from '@/lib/customers-server';
import { ensureDemoWorkspace } from '@/lib/demo-seed';
import { attachDemoCookie, readDemoSessionFromRequest } from '@/lib/demo-session';

export async function POST(request: Request) {
  try {
    const raw = (await request.json().catch(() => ({}))) as Record<string, unknown> | null;
    if (!raw || typeof raw !== 'object') {
      return NextResponse.json(
        { ok: false, error: 'Invalid demo start payload.' },
        { status: 400 },
      );
    }

    const entryOrigin =
      raw.entryOrigin === 'dashboard' || raw.entryOrigin === 'landing'
        ? raw.entryOrigin
        : 'landing';
    const previousSlug =
      typeof raw.previousSlug === 'string' && raw.previousSlug.length <= 120
        ? raw.previousSlug
        : null;

    const existing = readDemoSessionFromRequest(request);
    const demoSessionId = existing?.demoSessionId ?? randomUUID();

    const business = await ensureDemoWorkspace(customersPool, demoSessionId, false);

    const response = NextResponse.json({
      ok: true,
      isDemo: true,
      entryOrigin,
      businessSlug: business.slug,
      businessName: business.name,
    });

    attachDemoCookie(response, {
      demoSessionId,
      entryOrigin,
      previousSlug: previousSlug ?? existing?.previousSlug ?? null,
      iat: Date.now(),
    });

    return response;
  } catch (err) {
    console.error('[api/demo/start POST] error:', err);
    return NextResponse.json(
      { ok: false, error: 'Failed to start interactive demo workspace.' },
      { status: 500 },
    );
  }
}
