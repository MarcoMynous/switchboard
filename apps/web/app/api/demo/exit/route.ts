import { NextResponse } from 'next/server';
import { clearDemoCookie, readDemoSessionFromRequest } from '@/lib/demo-session';

export async function POST(request: Request) {
  const demoSession = readDemoSessionFromRequest(request);
  const redirectTo = demoSession?.entryOrigin === 'dashboard' ? '/dashboard/overview' : '/';

  const response = NextResponse.json({
    ok: true,
    redirectTo,
  });

  clearDemoCookie(response);
  return response;
}
