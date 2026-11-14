import { NextResponse } from 'next/server';
import { resolveAuthDestination } from '@/lib/auth-destination';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const result = await resolveAuthDestination(request.headers);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        authenticated: false,
        onboarded: false,
        destination: '/auth/signin',
        slug: null,
        error: error instanceof Error ? error.message : 'Could not resolve auth destination.',
      },
      { status: 500 },
    );
  }
}
