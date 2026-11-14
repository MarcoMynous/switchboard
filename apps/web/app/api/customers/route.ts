import { NextResponse } from 'next/server';
import {
  customersPool,
  fetchCustomersDirectory,
  resolveAuthorizedBusiness,
  toE164,
} from '@/lib/customers-server';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const requestedSlug = url.searchParams.get('slug');
    const authCtx = await resolveAuthorizedBusiness(request, requestedSlug);

    if (!authCtx) {
      return NextResponse.json(
        { ok: false, error: 'Authentication required to view business customers.' },
        { status: 401 },
      );
    }

    const records = await fetchCustomersDirectory(authCtx.business.id);
    const maskedRecords =
      authCtx.role === 'staff'
        ? records.map((c) => ({
            ...c,
            phoneE164: `${c.phoneE164.slice(0, 6)} ••• ${c.phoneE164.slice(-4)}`,
          }))
        : records;

    return NextResponse.json({
      ok: true,
      business: authCtx.business,
      role: authCtx.role,
      customers: maskedRecords,
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: 'We could not load your customers from the database.' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      slug?: string;
      name?: string;
      phone?: string;
      preferredChannel?: 'whatsapp' | 'web_chat' | 'phone' | null;
      notes?: string;
    } | null;

    if (!body) {
      return NextResponse.json({ ok: false, error: 'Invalid request body.' }, { status: 400 });
    }

    const authCtx = await resolveAuthorizedBusiness(request, body.slug);
    if (!authCtx) {
      return NextResponse.json(
        { ok: false, error: 'Authentication required to add customers.' },
        { status: 401 },
      );
    }

    const name = body.name?.trim() ?? '';
    if (name.length < 1 || name.length > 100) {
      return NextResponse.json(
        { ok: false, error: 'Full name is required (1–100 characters).' },
        { status: 400 },
      );
    }

    const phoneE164 = toE164(body.phone ?? '');
    if (!phoneE164) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Please enter a valid international or Nigerian phone number (e.g. +234 803 123 4567).',
        },
        { status: 400 },
      );
    }

    const existingRes = await customersPool.query<{ id: string; name: string | null }>(
      `SELECT id, name FROM customers WHERE business_id = $1 AND phone_e164 = $2 LIMIT 1`,
      [authCtx.business.id, phoneE164],
    );

    if (existingRes.rows[0]) {
      return NextResponse.json(
        {
          ok: false,
          code: 'DUPLICATE_CUSTOMER',
          error: 'A customer with this phone number already exists in your business.',
          existingCustomer: {
            id: existingRes.rows[0].id,
            name: existingRes.rows[0].name || phoneE164,
          },
        },
        { status: 409 },
      );
    }

    const tags: string[] = ['source:manual'];
    if (body.preferredChannel) {
      tags.push(`pref_channel:${body.preferredChannel}`);
    }
    const notes = body.notes?.trim() ? body.notes.trim().slice(0, 1000) : null;

    const insertedRes = await customersPool.query<{ id: string }>(
      `INSERT INTO customers (business_id, phone_e164, name, notes, tags)
       VALUES ($1, $2, $3, $4, $5::text[])
       RETURNING id`,
      [authCtx.business.id, phoneE164, name, notes, tags],
    );

    const newId = insertedRes.rows[0]?.id;
    if (!newId) {
      return NextResponse.json({ ok: false, error: 'Failed to create customer.' }, { status: 500 });
    }

    await customersPool.query(
      `INSERT INTO audit_log (business_id, actor, action, entity, entity_id, after)
       VALUES ($1, $2, 'customer.created', 'customer', $3, $4::jsonb)`,
      [
        authCtx.business.id,
        `staff:${authCtx.user.id}`,
        newId,
        JSON.stringify({ name, phoneE164, preferredChannel: body.preferredChannel ?? null }),
      ],
    );

    const [created] = await fetchCustomersDirectory(authCtx.business.id, newId);
    return NextResponse.json({ ok: true, customer: created }, { status: 201 });
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Failed to save customer profile.' },
      { status: 500 },
    );
  }
}
