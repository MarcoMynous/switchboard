import { NextResponse } from 'next/server';
import { customersPool } from '@/lib/customers-server';
import { ensureDemoWorkspace } from '@/lib/demo-seed';
import { readDemoSessionFromRequest } from '@/lib/demo-session';

export async function POST(request: Request) {
  try {
    const demoSession = readDemoSessionFromRequest(request);
    if (!demoSession) {
      return NextResponse.json(
        { ok: false, error: 'Demo Mode session is not active.' },
        { status: 401 },
      );
    }

    const business = await ensureDemoWorkspace(customersPool, demoSession.demoSessionId, true);

    return NextResponse.json({
      ok: true,
      reset: true,
      businessSlug: business.slug,
      businessName: business.name,
    });
  } catch (err) {
    console.error('[api/demo/reset POST] error:', err);
    return NextResponse.json(
      { ok: false, error: 'Failed to reset demo workspace.' },
      { status: 500 },
    );
  }
}
