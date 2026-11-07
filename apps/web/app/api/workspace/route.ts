import { parseEnv, webSchema } from '@switchboard/env';
import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import { auth } from '../../../lib/auth';

const env = parseEnv(webSchema);

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 3,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 15_000,
});

export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: request.headers }).catch(() => null);

    const result = await pool.query<{
      id: string;
      name: string;
      slug: string;
      vertical: string;
      timezone: string;
      whatsapp_phone_number_id: string | null;
      plan: string;
      kora_payout_account: Record<string, unknown> | null;
      agent_enabled: boolean;
      created_at: string;
    }>(
      `SELECT id, name, slug, vertical, timezone, whatsapp_phone_number_id, plan, kora_payout_account, agent_enabled, created_at
       FROM businesses
       ORDER BY created_at DESC
       LIMIT 1`,
    );

    const business = result.rows[0] ?? null;

    return NextResponse.json({
      ok: true,
      user: session?.user
        ? {
            id: session.user.id,
            name: session.user.name || session.user.email.split('@')[0] || 'Owner',
            email: session.user.email,
            role: 'owner' as const,
          }
        : null,
      business: business
        ? {
            id: business.id,
            name: business.name,
            slug: business.slug,
            vertical: business.vertical,
            timezone: business.timezone,
            whatsappPhoneNumberId: business.whatsapp_phone_number_id,
            plan: business.plan,
            koraConfigured: Boolean(business.kora_payout_account),
            agentEnabled: business.agent_enabled,
            createdAt: business.created_at,
          }
        : null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Database or workspace service temporarily unavailable.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string;
      slug?: string;
      vertical?: string;
      timezone?: string;
      agentEnabled?: boolean;
    };

    const name = (body.name || 'Fade Republic').trim();
    const rawSlug =
      (body.slug || name)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || 'fade-republic';

    const validVerticals = new Set(['salon', 'barber', 'auto', 'property', 'clinic']);
    const vertical = validVerticals.has(body.vertical || '') ? body.vertical : 'barber';
    const timezone = body.timezone?.includes('Accra')
      ? 'Africa/Accra'
      : body.timezone?.includes('Nairobi')
        ? 'Africa/Nairobi'
        : 'Africa/Lagos';
    const agentEnabled = body.agentEnabled ?? true;

    const result = await pool.query<{
      id: string;
      name: string;
      slug: string;
      vertical: string;
      timezone: string;
      agent_enabled: boolean;
    }>(
      `INSERT INTO businesses (name, slug, vertical, timezone, plan, agent_enabled)
       VALUES ($1, $2, $3::business_vertical, $4, 'pro', $5)
       ON CONFLICT (slug) DO UPDATE
       SET name = EXCLUDED.name,
           vertical = EXCLUDED.vertical,
           timezone = EXCLUDED.timezone,
           agent_enabled = EXCLUDED.agent_enabled,
           updated_at = NOW()
       RETURNING id, name, slug, vertical, timezone, agent_enabled`,
      [name, rawSlug, vertical, timezone, agentEnabled],
    );

    return NextResponse.json({
      ok: true,
      business: result.rows[0],
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Could not save business workspace to database.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
