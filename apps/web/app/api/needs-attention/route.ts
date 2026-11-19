import { NextResponse } from 'next/server';
import { customersPool, resolveAuthorizedBusiness } from '@/lib/customers-server';
import { fetchNeedsAttentionData, type IssueStatus } from '@/lib/needs-attention-server';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const requestedSlug = url.searchParams.get('slug');
    const ctx = await resolveAuthorizedBusiness(request, requestedSlug);

    if (!ctx) {
      return NextResponse.json({ ok: false, error: 'Authentication required' }, { status: 401 });
    }

    const data = await fetchNeedsAttentionData(ctx.business.id, ctx.business.timezone, ctx.role);

    return NextResponse.json({
      ok: true,
      ...data,
      currentUser: { id: ctx.user.id, name: ctx.user.name },
      role: ctx.role,
    });
  } catch (err) {
    console.error('[api/needs-attention GET] error:', err);
    return NextResponse.json(
      { ok: false, error: "We couldn't load your issues." },
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

    const entityId = typeof body.entityId === 'string' ? body.entityId : '';
    const entityType = typeof body.entityType === 'string' ? body.entityType : '';
    if (!UUID_RE.test(entityId)) {
      return NextResponse.json({ ok: false, error: 'Invalid issue identifier.' }, { status: 400 });
    }

    const actionType = body.action;

    if (actionType === 'assign') {
      const targetUserId =
        typeof body.assignedUserId === 'string' && body.assignedUserId.trim().length > 0
          ? body.assignedUserId.trim()
          : ctx.user.id;
      const targetUserName =
        typeof body.assignedUserName === 'string' && body.assignedUserName.trim().length > 0
          ? body.assignedUserName.trim()
          : ctx.user.name;

      // Only owners can assign to someone else
      if (targetUserId !== ctx.user.id && ctx.role !== 'owner') {
        return NextResponse.json(
          { ok: false, error: 'Only workspace owners can assign issues to other staff.' },
          { status: 403 },
        );
      }

      const nowIso = new Date().toISOString();
      await customersPool.query(
        `INSERT INTO audit_log (business_id, actor, action, entity, entity_id, after)
         VALUES ($1, $2, 'issue.assigned', 'needs_attention_issue', $3, $4::jsonb)`,
        [
          ctx.business.id,
          `staff:${ctx.user.id}`,
          entityId,
          JSON.stringify({
            assignedUserId: targetUserId,
            assignedUserName: targetUserName,
            assignedAt: nowIso,
            assignedBy: ctx.user.name,
            status: 'in_progress',
          }),
        ],
      );

      return NextResponse.json({ ok: true });
    }

    if (actionType === 'transition') {
      const nextStatus = body.status as IssueStatus | undefined;
      if (
        nextStatus !== 'open' &&
        nextStatus !== 'in_progress' &&
        nextStatus !== 'waiting' &&
        nextStatus !== 'resolved' &&
        nextStatus !== 'closed'
      ) {
        return NextResponse.json({ ok: false, error: 'Invalid issue status.' }, { status: 400 });
      }

      const resolutionNote =
        typeof body.resolutionNote === 'string' ? body.resolutionNote.trim().slice(0, 1000) : null;
      const resolutionCategory =
        typeof body.resolutionCategory === 'string'
          ? body.resolutionCategory.trim().slice(0, 100)
          : null;

      // Financial issue safeguard: cannot mark payment issue Resolved while unsettled
      if (entityType === 'payment' && nextStatus === 'resolved') {
        const payCheck = await customersPool.query<{
          payment_status: string;
          amount_kobo: string;
          deposit_kobo: string | null;
          booking_status: string | null;
        }>(
          `SELECT p.status::text AS payment_status, p.amount_kobo::text AS amount_kobo,
                  (
                    CASE
                      WHEN sv.deposit_type = 'none' THEN 0
                      WHEN sv.deposit_type = 'full' THEN COALESCE(sv.price_kobo, 0)
                      WHEN sv.deposit_type = 'percent' THEN ROUND(COALESCE(sv.price_kobo, 0) * COALESCE(sv.deposit_value, 0) / 100.0)::bigint
                      ELSE COALESCE(sv.deposit_value, p.amount_kobo, 0)
                    END
                  )::text AS deposit_kobo, b.status::text AS booking_status
           FROM payments p
           LEFT JOIN bookings b ON b.id = p.booking_id
           LEFT JOIN services sv ON sv.id = b.service_id
           WHERE p.id = $1 AND p.business_id = $2
           LIMIT 1`,
          [entityId, ctx.business.id],
        );
        const row = payCheck.rows[0];
        if (row) {
          const isSettled =
            row.payment_status === 'refunded' ||
            (row.payment_status === 'succeeded' &&
              row.booking_status === 'confirmed' &&
              Number(row.amount_kobo) >= Number(row.deposit_kobo ?? row.amount_kobo));

          if (!isSettled) {
            return NextResponse.json(
              {
                ok: false,
                code: 'FINANCIAL_NOT_SETTLED',
                error:
                  'This financial issue cannot be marked Resolved while the payment or refund remains unsettled. Complete the Kora verification/refund or use Administrative Closure.',
              },
              { status: 409 },
            );
          }
        }
      }

      // Administrative closure requires a note
      if (nextStatus === 'closed' && (!resolutionNote || resolutionNote.length < 3)) {
        return NextResponse.json(
          { ok: false, error: 'Please provide a brief reason for administrative closure.' },
          { status: 400 },
        );
      }

      const client = await customersPool.connect();
      try {
        await client.query('BEGIN');

        // Synchronize conversation status when resolving or reopening a human handoff
        if (entityType === 'conversation') {
          if (nextStatus === 'resolved' || nextStatus === 'closed') {
            await client.query(
              `UPDATE conversations SET status = 'agent', updated_at = now()
               WHERE id = $1 AND business_id = $2`,
              [entityId, ctx.business.id],
            );
          } else if (nextStatus === 'open') {
            await client.query(
              `UPDATE conversations SET status = 'needs_human', updated_at = now()
               WHERE id = $1 AND business_id = $2`,
              [entityId, ctx.business.id],
            );
          }
        }

        const nowIso = new Date().toISOString();
        const isTerminal = nextStatus === 'resolved' || nextStatus === 'closed';
        const auditAction = isTerminal
          ? 'issue.resolved'
          : nextStatus === 'open'
            ? 'issue.reopened'
            : 'issue.status_changed';

        await client.query(
          `INSERT INTO audit_log (business_id, actor, action, entity, entity_id, after)
           VALUES ($1, $2, $3, 'needs_attention_issue', $4, $5::jsonb)`,
          [
            ctx.business.id,
            `staff:${ctx.user.id}`,
            auditAction,
            entityId,
            JSON.stringify({
              status: nextStatus,
              resolvedAt: isTerminal ? nowIso : null,
              resolvedBy: isTerminal ? ctx.user.name : null,
              resolutionNote: resolutionNote || null,
              resolutionCategory:
                resolutionCategory || (nextStatus === 'closed' ? 'administrative_closure' : null),
            }),
          ],
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
    console.error('[api/needs-attention POST] error:', err);
    return NextResponse.json({ ok: false, error: 'Failed to update issue.' }, { status: 500 });
  }
}
