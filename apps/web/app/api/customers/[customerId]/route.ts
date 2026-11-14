import { NextResponse } from 'next/server';
import {
  customersPool,
  fetchCustomersDirectory,
  resolveAuthorizedBusiness,
  toE164,
} from '@/lib/customers-server';

export async function GET(request: Request, context: { params: Promise<{ customerId: string }> }) {
  try {
    const { customerId } = await context.params;
    const url = new URL(request.url);
    const authCtx = await resolveAuthorizedBusiness(request, url.searchParams.get('slug'));

    if (!authCtx) {
      return NextResponse.json(
        { ok: false, error: 'Authentication required to view customer details.' },
        { status: 401 },
      );
    }

    const [customer] = await fetchCustomersDirectory(authCtx.business.id, customerId);
    if (!customer) {
      return NextResponse.json({ ok: false, error: 'Customer not found.' }, { status: 404 });
    }

    const maskedCustomer =
      authCtx.role === 'staff'
        ? {
            ...customer,
            phoneE164: `${customer.phoneE164.slice(0, 6)} ••• ${customer.phoneE164.slice(-4)}`,
          }
        : customer;

    return NextResponse.json({
      ok: true,
      business: authCtx.business,
      role: authCtx.role,
      customer: maskedCustomer,
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Failed to load customer profile.' },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ customerId: string }> },
) {
  try {
    const { customerId } = await context.params;
    const body = (await request.json().catch(() => null)) as {
      slug?: string;
      name?: string;
      phone?: string;
      notes?: string | null;
      preferredChannel?: 'whatsapp' | 'web_chat' | 'phone' | null;
      preferredLanguage?: string | null;
    } | null;

    if (!body) {
      return NextResponse.json({ ok: false, error: 'Invalid request body.' }, { status: 400 });
    }

    const authCtx = await resolveAuthorizedBusiness(request, body.slug);
    if (!authCtx) {
      return NextResponse.json(
        { ok: false, error: 'Authentication required to update customer details.' },
        { status: 401 },
      );
    }

    const currentRes = await customersPool.query<{
      id: string;
      name: string | null;
      phone_e164: string;
      notes: string | null;
      tags: string[];
    }>(
      `SELECT id, name, phone_e164, notes, tags
       FROM customers
       WHERE business_id = $1 AND id = $2
       LIMIT 1`,
      [authCtx.business.id, customerId],
    );

    const existing = currentRes.rows[0];
    if (!existing) {
      return NextResponse.json({ ok: false, error: 'Customer not found.' }, { status: 404 });
    }

    const nextName =
      typeof body.name === 'string'
        ? body.name.trim().slice(0, 100) || existing.name
        : existing.name;

    let nextPhone = existing.phone_e164;
    if (typeof body.phone === 'string' && body.phone.trim().length > 0) {
      const normalized = toE164(body.phone);
      if (!normalized) {
        return NextResponse.json(
          { ok: false, error: 'Please provide a valid phone number in E.164 or Nigerian format.' },
          { status: 400 },
        );
      }

      if (normalized !== existing.phone_e164) {
        // Only owner can change primary phone identity, and never auto-merge with another customer
        if (authCtx.role !== 'owner') {
          return NextResponse.json(
            { ok: false, error: 'Only workspace owners can update a customer phone identity.' },
            { status: 403 },
          );
        }

        const conflictRes = await customersPool.query<{ id: string; name: string | null }>(
          `SELECT id, name FROM customers
           WHERE business_id = $1 AND phone_e164 = $2 AND id <> $3
           LIMIT 1`,
          [authCtx.business.id, normalized, customerId],
        );

        if (conflictRes.rows[0]) {
          return NextResponse.json(
            {
              ok: false,
              code: 'PHONE_CONFLICT',
              error:
                'Another customer profile already uses this phone number. Profiles are not merged automatically.',
              existingCustomer: {
                id: conflictRes.rows[0].id,
                name: conflictRes.rows[0].name || normalized,
              },
            },
            { status: 409 },
          );
        }
        nextPhone = normalized;
      }
    }

    const nextNotes =
      body.notes === undefined
        ? existing.notes
        : body.notes === null || body.notes.trim() === ''
          ? null
          : body.notes.trim().slice(0, 1000);

    let nextTags = existing.tags.filter(
      (t) =>
        (body.preferredChannel === undefined || !t.startsWith('pref_channel:')) &&
        (body.preferredLanguage === undefined || !t.startsWith('lang:')),
    );
    if (body.preferredChannel) {
      nextTags = [...nextTags, `pref_channel:${body.preferredChannel}`];
    }
    if (body.preferredLanguage?.trim()) {
      nextTags = [...nextTags, `lang:${body.preferredLanguage.trim().slice(0, 30)}`];
    }

    await customersPool.query(
      `UPDATE customers
       SET name = $1, phone_e164 = $2, notes = $3, tags = $4::text[], updated_at = now()
       WHERE id = $5 AND business_id = $6`,
      [nextName, nextPhone, nextNotes, nextTags, customerId, authCtx.business.id],
    );

    await customersPool.query(
      `INSERT INTO audit_log (business_id, actor, action, entity, entity_id, before, after)
       VALUES ($1, $2, 'customer.updated', 'customer', $3, $4::jsonb, $5::jsonb)`,
      [
        authCtx.business.id,
        `staff:${authCtx.user.id}`,
        customerId,
        JSON.stringify({
          name: existing.name,
          phoneE164: existing.phone_e164,
          notes: existing.notes,
        }),
        JSON.stringify({ name: nextName, phoneE164: nextPhone, notes: nextNotes }),
      ],
    );

    const [updated] = await fetchCustomersDirectory(authCtx.business.id, customerId);
    return NextResponse.json({ ok: true, customer: updated });
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Failed to update customer profile.' },
      { status: 500 },
    );
  }
}
