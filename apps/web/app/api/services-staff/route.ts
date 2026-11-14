import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { customersPool, resolveAuthorizedBusiness, toE164 } from '@/lib/customers-server';

export type ServiceDisplayStatus = 'active' | 'needs_setup' | 'inactive' | 'archived';

export interface ServiceCatalogItem {
  id: string;
  name: string;
  description: string;
  category: string;
  durationMin: number;
  priceKobo: number;
  depositType: string;
  depositKobo: number;
  status: ServiceDisplayStatus;
  missingReasons: string[];
  assignedStaffIds: string[];
  assignedStaffNames: string[];
  upcomingBookingsCount: number;
  updatedAt: string;
}

export interface StaffDirectoryItem {
  id: string;
  name: string;
  role: 'owner' | 'staff';
  roleTitle: string;
  phoneE164: string | null;
  bio: string;
  active: boolean;
  assignedServiceIds: string[];
  assignedServiceNames: string[];
  scheduleConfigured: boolean;
  scheduleSummary: string;
  upcomingBookingsCount: number;
  upcomingBookings: Array<{
    id: string;
    customerName: string;
    serviceName: string;
    startsAt: string;
    status: string;
  }>;
  updatedAt: string;
}

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getTodayWeekdayInTimezone(timezone: string): number {
  try {
    const label = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone || 'Africa/Lagos',
      weekday: 'short',
    }).format(new Date());
    const idx = WEEKDAY_SHORT.indexOf(label);
    return idx >= 0 ? idx : new Date().getDay();
  } catch {
    return new Date().getDay();
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const requestedSlug = url.searchParams.get('slug');
    const ctx = await resolveAuthorizedBusiness(request, requestedSlug);
    if (!ctx) {
      return NextResponse.json({ ok: false, error: 'Authentication required' }, { status: 401 });
    }

    const { business, role } = ctx;

    const [bizRes, svcRes, stfRes, assignRes, hoursRes, bookingsRes, metaRes] = await Promise.all([
      customersPool.query<{
        id: string;
        name: string;
        slug: string;
        timezone: string;
        self_provided: boolean;
        deposit_required: boolean;
        default_deposit_kobo: string;
      }>(
        `SELECT id::text AS id, name, slug, timezone, self_provided, deposit_required, default_deposit_kobo::text AS default_deposit_kobo
         FROM businesses WHERE id = $1 LIMIT 1`,
        [business.id],
      ),
      customersPool.query<{
        id: string;
        name: string;
        description: string | null;
        duration_min: number;
        price_kobo: string;
        deposit_type: string;
        deposit_value: string;
        updated_at: string;
      }>(
        `SELECT id::text AS id, name, description, duration_min, price_kobo::text AS price_kobo,
                deposit_type::text AS deposit_type, deposit_value::text AS deposit_value,
                updated_at::text AS updated_at
         FROM services WHERE business_id = $1 ORDER BY name ASC`,
        [business.id],
      ),
      customersPool.query<{
        id: string;
        name: string;
        role: string;
        role_title: string;
        active: boolean;
        updated_at: string;
      }>(
        `SELECT id::text AS id, name, role::text AS role, role_title, active, updated_at::text AS updated_at
         FROM staff WHERE business_id = $1 ORDER BY name ASC`,
        [business.id],
      ),
      customersPool.query<{ staff_id: string; service_id: string }>(
        `SELECT ss.staff_id::text AS staff_id, ss.service_id::text AS service_id
         FROM staff_services ss
         JOIN services sv ON sv.id = ss.service_id
         WHERE sv.business_id = $1`,
        [business.id],
      ),
      customersPool.query<{
        staff_id: string;
        weekday: number;
        start_local: string;
        end_local: string;
      }>(
        `SELECT wh.staff_id::text AS staff_id, wh.weekday, wh.start_local::text AS start_local, wh.end_local::text AS end_local
         FROM working_hours wh
         JOIN staff st ON st.id = wh.staff_id
         WHERE st.business_id = $1
         ORDER BY wh.weekday ASC`,
        [business.id],
      ),
      customersPool.query<{
        id: string;
        service_id: string;
        staff_id: string | null;
        starts_at: string;
        status: string;
        customer_name: string | null;
        service_name: string;
      }>(
        `SELECT b.id::text AS id, b.service_id::text AS service_id, b.staff_id::text AS staff_id,
                b.starts_at::text AS starts_at, b.status::text AS status,
                c.name AS customer_name, sv.name AS service_name
         FROM bookings b
         JOIN customers c ON c.id = b.customer_id
         JOIN services sv ON sv.id = b.service_id
         WHERE b.business_id = $1
           AND b.status IN ('held', 'confirmed')
           AND b.starts_at >= now() - interval '1 hour'
         ORDER BY b.starts_at ASC`,
        [business.id],
      ),
      customersPool.query<{
        entity: string;
        entity_id: string;
        after: Record<string, unknown> | null;
      }>(
        `SELECT entity, entity_id::text AS entity_id, after
         FROM audit_log
         WHERE business_id = $1 AND entity IN ('service_meta', 'staff_meta')
         ORDER BY created_at ASC`,
        [business.id],
      ),
    ]);

    const biz = bizRes.rows[0];
    if (!biz) {
      return NextResponse.json(
        { ok: false, error: 'Business workspace not found.' },
        { status: 404 },
      );
    }

    const serviceMeta = new Map<string, { status?: string; category?: string }>();
    const staffMeta = new Map<string, { phoneE164?: string | null; bio?: string }>();

    for (const row of metaRes.rows) {
      const after = row.after ?? {};
      if (row.entity === 'service_meta') {
        const prev = serviceMeta.get(row.entity_id) ?? {};
        serviceMeta.set(row.entity_id, {
          status: typeof after.status === 'string' ? after.status : prev.status,
          category: typeof after.category === 'string' ? after.category : prev.category,
        });
      } else if (row.entity === 'staff_meta') {
        const prev = staffMeta.get(row.entity_id) ?? {};
        staffMeta.set(row.entity_id, {
          phoneE164:
            'phoneE164' in after
              ? typeof after.phoneE164 === 'string'
                ? after.phoneE164
                : null
              : prev.phoneE164,
          bio: typeof after.bio === 'string' ? after.bio : prev.bio,
        });
      }
    }

    const staffById = new Map(stfRes.rows.map((s) => [s.id, s]));
    const serviceById = new Map(svcRes.rows.map((s) => [s.id, s]));

    const staffIdsByService = new Map<string, string[]>();
    const serviceIdsByStaff = new Map<string, string[]>();

    for (const a of assignRes.rows) {
      const sList = staffIdsByService.get(a.service_id) ?? [];
      if (!sList.includes(a.staff_id)) sList.push(a.staff_id);
      staffIdsByService.set(a.service_id, sList);

      const svList = serviceIdsByStaff.get(a.staff_id) ?? [];
      if (!svList.includes(a.service_id)) svList.push(a.service_id);
      serviceIdsByStaff.set(a.staff_id, svList);
    }

    const hoursByStaff = new Map<string, Array<{ weekday: number; start: string; end: string }>>();
    for (const h of hoursRes.rows) {
      const list = hoursByStaff.get(h.staff_id) ?? [];
      list.push({
        weekday: h.weekday,
        start: h.start_local.slice(0, 5),
        end: h.end_local.slice(0, 5),
      });
      hoursByStaff.set(h.staff_id, list);
    }

    const defaultDepKobo = Number(biz.default_deposit_kobo) || 0;
    const servicesList: ServiceCatalogItem[] = svcRes.rows.map((s) => {
      const meta = serviceMeta.get(s.id);
      const assignedIds = staffIdsByService.get(s.id) ?? [];
      const activeAssignedStaff = assignedIds.filter((id) => staffById.get(id)?.active);
      const priceKobo = Number(s.price_kobo) || 0;
      const missingReasons: string[] = [];

      if (s.duration_min <= 0) missingReasons.push('Invalid duration');
      if (activeAssignedStaff.length === 0) missingReasons.push('No active staff assigned');

      let status: ServiceDisplayStatus = 'active';
      if (meta?.status === 'archived') {
        status = 'archived';
      } else if (meta?.status === 'inactive') {
        status = 'inactive';
      } else if (missingReasons.length > 0) {
        status = 'needs_setup';
      }

      const depKobo = !biz.deposit_required
        ? 0
        : s.deposit_type === 'none'
          ? 0
          : s.deposit_type === 'full'
            ? priceKobo
            : s.deposit_type === 'percent'
              ? Math.round((priceKobo * Number(s.deposit_value)) / 100)
              : Number(s.deposit_value) > 0
                ? Number(s.deposit_value)
                : defaultDepKobo;

      const upcomingCount = bookingsRes.rows.filter((b) => b.service_id === s.id).length;

      return {
        id: s.id,
        name: s.name,
        description: s.description ?? '',
        category: meta?.category ?? 'General',
        durationMin: s.duration_min,
        priceKobo,
        depositType: s.deposit_type,
        depositKobo: depKobo,
        status,
        missingReasons,
        assignedStaffIds: assignedIds,
        assignedStaffNames: assignedIds
          .map((id) => staffById.get(id)?.name)
          .filter((n): n is string => Boolean(n)),
        upcomingBookingsCount: upcomingCount,
        updatedAt: s.updated_at,
      };
    });

    const todayWeekday = getTodayWeekdayInTimezone(biz.timezone);
    const staffList: StaffDirectoryItem[] = stfRes.rows.map((st) => {
      const meta = staffMeta.get(st.id);
      const svcIds = serviceIdsByStaff.get(st.id) ?? [];
      const hours = hoursByStaff.get(st.id) ?? [];
      const scheduleConfigured = hours.length > 0;
      const scheduleSummary = scheduleConfigured
        ? `${hours.map((h) => WEEKDAY_SHORT[h.weekday]).join(', ')} (${hours[0]?.start} – ${hours[0]?.end})`
        : 'Schedule not configured';

      const staffBookings = bookingsRes.rows.filter((b) => b.staff_id === st.id);
      const rawPhone = meta?.phoneE164 ?? null;

      return {
        id: st.id,
        name: st.name,
        role: st.role === 'owner' ? 'owner' : 'staff',
        roleTitle: st.role_title,
        phoneE164: rawPhone ? (role === 'staff' ? `•••• ${rawPhone.slice(-4)}` : rawPhone) : null,
        bio: meta?.bio ?? '',
        active: st.active,
        assignedServiceIds: svcIds,
        assignedServiceNames: svcIds
          .map((id) => serviceById.get(id)?.name)
          .filter((n): n is string => Boolean(n)),
        scheduleConfigured,
        scheduleSummary,
        upcomingBookingsCount: staffBookings.length,
        upcomingBookings: staffBookings.slice(0, 6).map((b) => ({
          id: b.id,
          customerName: b.customer_name?.trim() || 'Guest Customer',
          serviceName: b.service_name,
          startsAt: b.starts_at,
          status: b.status,
        })),
        updatedAt: st.updated_at,
      };
    });

    const activeStaff = staffList.filter((s) => s.active);
    const unavailableStaffToday = activeStaff.filter((s) => {
      const hours = hoursByStaff.get(s.id) ?? [];
      return hours.length > 0 && !hours.some((h) => h.weekday === todayWeekday);
    }).length;

    return NextResponse.json({
      ok: true,
      role,
      business: {
        id: biz.id,
        name: biz.name,
        slug: biz.slug,
        timezone: biz.timezone,
        selfProvided: biz.self_provided,
        depositRequired: biz.deposit_required,
        defaultDepositKobo: defaultDepKobo,
      },
      services: servicesList,
      staff: staffList,
      summary: {
        activeServices: servicesList.filter((s) => s.status === 'active').length,
        staffMembers: activeStaff.length,
        servicesNeedingSetup: servicesList.filter((s) => s.status === 'needs_setup').length,
        unavailableStaffToday,
      },
    });
  } catch (err) {
    console.error('[api/services-staff GET] error:', err);
    return NextResponse.json(
      { ok: false, error: 'Failed to load services and staff.' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ ok: false, error: 'Invalid request payload.' }, { status: 400 });
    }

    const slug = typeof body.slug === 'string' ? body.slug : undefined;
    const ctx = await resolveAuthorizedBusiness(request, slug);
    if (!ctx) {
      return NextResponse.json({ ok: false, error: 'Authentication required' }, { status: 401 });
    }

    if (ctx.role !== 'owner') {
      return NextResponse.json(
        { ok: false, error: 'Only workspace owners can modify services and staff.' },
        { status: 403 },
      );
    }

    const action = body.action;

    if (action === 'save_service') {
      const serviceId = typeof body.id === 'string' && UUID_RE.test(body.id) ? body.id : null;
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const description = typeof body.description === 'string' ? body.description.trim() : '';
      const category =
        typeof body.category === 'string' && body.category.trim()
          ? body.category.trim().slice(0, 60)
          : 'General';
      const durationMin = typeof body.durationMin === 'number' ? Math.round(body.durationMin) : 0;
      const priceKobo = typeof body.priceKobo === 'number' ? Math.round(body.priceKobo) : -1;
      const requestedStatus =
        body.status === 'inactive' || body.status === 'archived' ? body.status : 'active';
      const assignedStaffIds = Array.isArray(body.assignedStaffIds)
        ? Array.from(
            new Set(
              body.assignedStaffIds.filter(
                (id): id is string => typeof id === 'string' && UUID_RE.test(id),
              ),
            ),
          )
        : [];

      if (!name || name.length > 100) {
        return NextResponse.json(
          { ok: false, error: 'Enter a valid service name (1–100 characters).' },
          { status: 400 },
        );
      }
      if (durationMin <= 0 || durationMin > 480) {
        return NextResponse.json(
          { ok: false, error: 'Service duration must be between 1 and 480 minutes.' },
          { status: 400 },
        );
      }
      if (priceKobo < 0) {
        return NextResponse.json(
          { ok: false, error: 'Service price cannot be negative.' },
          { status: 400 },
        );
      }

      const client = await customersPool.connect();
      try {
        await client.query('BEGIN');

        // Verify assigned staff belong to this business
        let validStaffIds: string[] = [];
        if (assignedStaffIds.length > 0) {
          const validRes = await client.query<{ id: string }>(
            `SELECT id::text AS id FROM staff WHERE business_id = $1 AND id = ANY($2::uuid[])`,
            [ctx.business.id, assignedStaffIds],
          );
          validStaffIds = validRes.rows.map((r) => r.id);
        }

        const bizRes = await client.query<{
          deposit_required: boolean;
          default_deposit_kobo: string;
        }>(
          `SELECT deposit_required, default_deposit_kobo::text AS default_deposit_kobo
           FROM businesses WHERE id = $1 LIMIT 1`,
          [ctx.business.id],
        );
        const biz = bizRes.rows[0];
        const depositType = biz?.deposit_required ? 'fixed' : 'none';
        const depositValue = biz?.deposit_required
          ? Number(biz.default_deposit_kobo ?? 150_000)
          : 0;

        let targetId = serviceId;
        let previousSnapshot: Record<string, unknown> | null = null;

        if (targetId) {
          const existing = await client.query<{
            name: string;
            duration_min: number;
            price_kobo: string;
          }>(
            `SELECT name, duration_min, price_kobo::text AS price_kobo
             FROM services WHERE id = $1 AND business_id = $2 LIMIT 1`,
            [targetId, ctx.business.id],
          );
          if (!existing.rows[0]) {
            await client.query('ROLLBACK');
            return NextResponse.json(
              { ok: false, error: 'Service not found for this business.' },
              { status: 404 },
            );
          }
          previousSnapshot = existing.rows[0];

          await client.query(
            `UPDATE services
             SET name = $1, description = $2, duration_min = $3, price_kobo = $4, updated_at = now()
             WHERE id = $5 AND business_id = $6`,
            [name, description || null, durationMin, priceKobo, targetId, ctx.business.id],
          );
        } else {
          const newId = randomUUID();
          await client.query(
            `INSERT INTO services (
               id, business_id, name, description, duration_min, price_kobo,
               deposit_type, deposit_value
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              newId,
              ctx.business.id,
              name,
              description || null,
              durationMin,
              priceKobo,
              depositType,
              depositValue,
            ],
          );
          targetId = newId;
        }

        // Sync staff_services assignments
        await client.query(`DELETE FROM staff_services WHERE service_id = $1`, [targetId]);
        for (const staffId of validStaffIds) {
          await client.query(
            `INSERT INTO staff_services (staff_id, service_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [staffId, targetId],
          );
        }

        await client.query(
          `INSERT INTO audit_log (business_id, actor, action, entity, entity_id, before, after)
           VALUES ($1, $2, $3, 'service_meta', $4, $5::jsonb, $6::jsonb)`,
          [
            ctx.business.id,
            `staff:${ctx.user.id}`,
            serviceId ? 'service.updated' : 'service.created',
            targetId,
            previousSnapshot ? JSON.stringify(previousSnapshot) : null,
            JSON.stringify({
              name,
              durationMin,
              priceKobo,
              category,
              status: requestedStatus,
              assignedStaffCount: validStaffIds.length,
            }),
          ],
        );

        await client.query('COMMIT');
        return NextResponse.json({ ok: true, id: targetId });
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    }

    if (action === 'set_service_status') {
      const serviceId = typeof body.id === 'string' && UUID_RE.test(body.id) ? body.id : null;
      const status =
        body.status === 'active' || body.status === 'inactive' || body.status === 'archived'
          ? body.status
          : null;
      if (!serviceId || !status) {
        return NextResponse.json(
          { ok: false, error: 'Invalid service status update.' },
          { status: 400 },
        );
      }

      if (status === 'active') {
        const check = await customersPool.query<{
          duration_min: number;
          active_staff_count: string;
        }>(
          `SELECT sv.duration_min,
                  COUNT(st.id) FILTER (WHERE st.active = true)::text AS active_staff_count
           FROM services sv
           LEFT JOIN staff_services ss ON ss.service_id = sv.id
           LEFT JOIN staff st ON st.id = ss.staff_id
           WHERE sv.id = $1 AND sv.business_id = $2
           GROUP BY sv.id`,
          [serviceId, ctx.business.id],
        );
        const row = check.rows[0];
        if (!row) {
          return NextResponse.json({ ok: false, error: 'Service not found.' }, { status: 404 });
        }
        if (row.duration_min <= 0 || Number(row.active_staff_count) === 0) {
          return NextResponse.json(
            {
              ok: false,
              error: 'Assign at least one active staff member before enabling this service.',
            },
            { status: 409 },
          );
        }
      }

      await customersPool.query(
        `INSERT INTO audit_log (business_id, actor, action, entity, entity_id, after)
         VALUES ($1, $2, 'service.status_changed', 'service_meta', $3, $4::jsonb)`,
        [ctx.business.id, `staff:${ctx.user.id}`, serviceId, JSON.stringify({ status })],
      );
      return NextResponse.json({ ok: true });
    }

    if (action === 'save_staff') {
      const staffId = typeof body.id === 'string' && UUID_RE.test(body.id) ? body.id : null;
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const roleTitle =
        typeof body.roleTitle === 'string' && body.roleTitle.trim()
          ? body.roleTitle.trim().slice(0, 80)
          : 'Staff Provider';
      const bio = typeof body.bio === 'string' ? body.bio.trim().slice(0, 400) : '';
      const rawPhone = typeof body.phone === 'string' ? body.phone.trim() : '';
      const phoneE164 = rawPhone ? toE164(rawPhone) : null;
      const active = typeof body.active === 'boolean' ? body.active : true;
      const assignedServiceIds = Array.isArray(body.assignedServiceIds)
        ? Array.from(
            new Set(
              body.assignedServiceIds.filter(
                (id): id is string => typeof id === 'string' && UUID_RE.test(id),
              ),
            ),
          )
        : [];

      if (!name || name.length > 100) {
        return NextResponse.json(
          { ok: false, error: 'Enter a valid staff name.' },
          { status: 400 },
        );
      }
      if (rawPhone && !phoneE164) {
        return NextResponse.json(
          { ok: false, error: 'Enter a valid phone number (e.g. +234 803 123 4567).' },
          { status: 400 },
        );
      }

      const client = await customersPool.connect();
      try {
        await client.query('BEGIN');

        let validServiceIds: string[] = [];
        if (assignedServiceIds.length > 0) {
          const validRes = await client.query<{ id: string }>(
            `SELECT id::text AS id FROM services WHERE business_id = $1 AND id = ANY($2::uuid[])`,
            [ctx.business.id, assignedServiceIds],
          );
          validServiceIds = validRes.rows.map((r) => r.id);
        }

        let targetId = staffId;
        if (targetId) {
          const updated = await client.query(
            `UPDATE staff
             SET name = $1, role_title = $2, active = $3, updated_at = now()
             WHERE id = $4 AND business_id = $5`,
            [name, roleTitle, active, targetId, ctx.business.id],
          );
          if ((updated.rowCount ?? 0) === 0) {
            await client.query('ROLLBACK');
            return NextResponse.json(
              { ok: false, error: 'Staff member not found for this business.' },
              { status: 404 },
            );
          }
        } else {
          const newId = randomUUID();
          await client.query(
            `INSERT INTO staff (id, business_id, name, role, role_title, active)
             VALUES ($1, $2, $3, 'staff', $4, $5)`,
            [newId, ctx.business.id, name, roleTitle, active],
          );
          targetId = newId;
        }

        await client.query(`DELETE FROM staff_services WHERE staff_id = $1`, [targetId]);
        for (const svcId of validServiceIds) {
          await client.query(
            `INSERT INTO staff_services (staff_id, service_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [targetId, svcId],
          );
        }

        await client.query(
          `INSERT INTO audit_log (business_id, actor, action, entity, entity_id, after)
           VALUES ($1, $2, $3, 'staff_meta', $4, $5::jsonb)`,
          [
            ctx.business.id,
            `staff:${ctx.user.id}`,
            staffId ? 'staff.updated' : 'staff.created',
            targetId,
            JSON.stringify({ name, roleTitle, active, phoneE164, bio }),
          ],
        );

        await client.query('COMMIT');
        return NextResponse.json({ ok: true, id: targetId });
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    }

    if (action === 'set_staff_active') {
      const staffId = typeof body.id === 'string' && UUID_RE.test(body.id) ? body.id : null;
      const active = typeof body.active === 'boolean' ? body.active : null;
      if (!staffId || active === null) {
        return NextResponse.json(
          { ok: false, error: 'Invalid staff status update.' },
          { status: 400 },
        );
      }

      const client = await customersPool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `UPDATE staff SET active = $1, updated_at = now() WHERE id = $2 AND business_id = $3`,
          [active, staffId, ctx.business.id],
        );
        await client.query(
          `INSERT INTO audit_log (business_id, actor, action, entity, entity_id, after)
           VALUES ($1, $2, 'staff.status_changed', 'staff', $3, $4::jsonb)`,
          [ctx.business.id, `staff:${ctx.user.id}`, staffId, JSON.stringify({ active })],
        );
        await client.query('COMMIT');
        return NextResponse.json({ ok: true });
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    }

    return NextResponse.json({ ok: false, error: 'Unsupported action.' }, { status: 400 });
  } catch (err) {
    console.error('[api/services-staff POST] error:', err);
    return NextResponse.json(
      { ok: false, error: 'Failed to update services and staff.' },
      { status: 500 },
    );
  }
}
