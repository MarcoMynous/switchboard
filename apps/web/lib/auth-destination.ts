import { auth } from './auth';
import { customersPool } from './customers-server';
import { readDemoSessionFromHeaders } from './demo-session';

export interface AuthDestinationResult {
  authenticated: boolean;
  onboarded: boolean;
  isDemo?: boolean;
  destination: '/dashboard/overview' | '/onboarding' | '/auth/signin';
  slug: string | null;
}

export async function resolveAuthDestination(headers: Headers): Promise<AuthDestinationResult> {
  const demoSession = readDemoSessionFromHeaders(headers);
  if (demoSession) {
    const demoRes = await customersPool.query<{ slug: string }>(
      `SELECT slug
       FROM businesses
       WHERE is_demo = true AND demo_session_id = $1
       LIMIT 1`,
      [demoSession.demoSessionId],
    );
    if (demoRes.rows[0]) {
      return {
        authenticated: true,
        onboarded: true,
        isDemo: true,
        destination: '/dashboard/overview',
        slug: demoRes.rows[0].slug,
      };
    }
  }

  const session = await auth.api.getSession({ headers }).catch(() => null);
  if (!session?.user?.id) {
    return {
      authenticated: false,
      onboarded: false,
      destination: '/auth/signin',
      slug: null,
    };
  }

  const userId = session.user.id;

  const ownerRes = await customersPool.query<{ slug: string; onboarding_completed: boolean }>(
    `SELECT slug, onboarding_completed
     FROM businesses
     WHERE owner_user_id = $1 AND is_demo = false
     ORDER BY updated_at DESC
     LIMIT 1`,
    [userId],
  );

  const owned = ownerRes.rows[0];
  if (owned) {
    return {
      authenticated: true,
      onboarded: Boolean(owned.onboarding_completed),
      destination: owned.onboarding_completed ? '/dashboard/overview' : '/onboarding',
      slug: owned.slug,
    };
  }

  const staffRes = await customersPool.query<{ slug: string; onboarding_completed: boolean }>(
    `SELECT b.slug, b.onboarding_completed
     FROM staff s
     JOIN businesses b ON b.id = s.business_id
     WHERE s.user_id = $1 AND s.active = true AND b.is_demo = false
     ORDER BY b.updated_at DESC
     LIMIT 1`,
    [userId],
  );

  const staffBiz = staffRes.rows[0];
  if (staffBiz) {
    return {
      authenticated: true,
      onboarded: Boolean(staffBiz.onboarding_completed),
      destination: staffBiz.onboarding_completed ? '/dashboard/overview' : '/onboarding',
      slug: staffBiz.slug,
    };
  }

  return {
    authenticated: true,
    onboarded: false,
    destination: '/onboarding',
    slug: null,
  };
}
