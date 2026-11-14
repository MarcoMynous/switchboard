import { customersPool } from './customers-server';

export type IssueCategory =
  | 'human_assistance'
  | 'booking'
  | 'payment'
  | 'notification'
  | 'integration';

export type IssueStatus = 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed';

export type IssuePriority = 'high' | 'normal' | 'low';

interface IssueHistoryEvent {
  id: string;
  timestamp: string;
  label: string;
  detail: string;
  actor: string;
}

export interface NeedsAttentionIssue {
  id: string;
  reference: string;
  entityType: 'conversation' | 'booking' | 'payment' | 'business';
  entityId: string;
  category: IssueCategory;
  title: string;
  whatHappened: string;
  recommendedAction: string;
  priority: IssuePriority;
  status: IssueStatus;
  assignedUserId: string | null;
  assignedUserName: string | null;
  assignedAt: string | null;
  assignedBy: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolutionNote: string | null;
  resolutionCategory: string | null;
  createdAt: string;
  updatedAt: string;
  customer: {
    id: string;
    name: string;
    phone: string;
  } | null;
  booking: {
    id: string;
    reference: string;
    serviceName: string;
    staffName: string;
    startsAt: string;
    status: string;
  } | null;
  conversation: {
    id: string;
    channel: 'whatsapp' | 'web_chat';
    status: string;
    lastMessagePreview: string | null;
  } | null;
  payment: {
    id: string;
    reference: string;
    expectedKobo: number;
    verifiedKobo: number | null;
    status: string;
    refundStatus: string | null;
    verifiedAt: string | null;
    isFinanciallySettled: boolean;
  } | null;
  history: IssueHistoryEvent[];
}

export interface NeedsAttentionSummary {
  openIssues: number;
  needsHumanReply: number;
  paymentIssues: number;
  resolvedToday: number;
}

interface IssueAuditOverride {
  status?: IssueStatus;
  assignedUserId?: string | null;
  assignedUserName?: string | null;
  assignedAt?: string | null;
  assignedBy?: string | null;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
  resolutionNote?: string | null;
  resolutionCategory?: string | null;
  updatedAt?: string;
}

function maskPhone(phone: string, role: 'owner' | 'staff'): string {
  if (role === 'staff') {
    return `•••• ${phone.slice(-4)}`;
  }
  return phone;
}

function getLocalDateKey(iso: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone || 'Africa/Lagos',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

export async function fetchNeedsAttentionData(
  businessId: string,
  businessTimezone: string,
  role: 'owner' | 'staff',
): Promise<{
  issues: NeedsAttentionIssue[];
  summary: NeedsAttentionSummary;
  staffMembers: Array<{ id: string; name: string; role: string }>;
}> {
  const [businessRes, staffRes, convRes, paymentRes, auditRes] = await Promise.all([
    customersPool.query<{
      id: string;
      name: string;
      whatsapp_phone_number_id: string | null;
      kora_payout_account: Record<string, unknown> | null;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT id::text AS id, name, whatsapp_phone_number_id, kora_payout_account, created_at::text AS created_at, updated_at::text AS updated_at
       FROM businesses
       WHERE id = $1
       LIMIT 1`,
      [businessId],
    ),
    customersPool.query<{ id: string; name: string; role: string; user_id: string | null }>(
      `SELECT id::text AS id, name, role::text AS role, user_id
       FROM staff
       WHERE business_id = $1 AND active = true
       ORDER BY name ASC`,
      [businessId],
    ),
    customersPool.query<{
      id: string;
      customer_id: string;
      customer_name: string | null;
      customer_phone: string;
      channel: string;
      status: string;
      last_message_at: string | null;
      created_at: string;
      updated_at: string;
      last_body: string | null;
    }>(
      `SELECT
         cv.id::text AS id,
         c.id::text AS customer_id,
         c.name AS customer_name,
         c.phone_e164 AS customer_phone,
         cv.channel::text AS channel,
         cv.status::text AS status,
         cv.last_message_at::text AS last_message_at,
         cv.created_at::text AS created_at,
         cv.updated_at::text AS updated_at,
         (
           SELECT m.body FROM messages m
           WHERE m.conversation_id = cv.id
           ORDER BY m.created_at DESC
           LIMIT 1
         ) AS last_body
       FROM conversations cv
       JOIN customers c ON c.id = cv.customer_id
       WHERE cv.business_id = $1
       ORDER BY COALESCE(cv.last_message_at, cv.updated_at) DESC
       LIMIT 150`,
      [businessId],
    ),
    customersPool.query<{
      payment_id: string;
      kora_reference: string;
      amount_kobo: string;
      payment_status: string;
      verified_at: string | null;
      payment_created_at: string;
      payment_updated_at: string;
      booking_id: string | null;
      booking_status: string | null;
      starts_at: string | null;
      deposit_kobo: string | null;
      booking_created_at: string | null;
      service_name: string | null;
      staff_name: string | null;
      customer_id: string | null;
      customer_name: string | null;
      customer_phone: string | null;
    }>(
      `SELECT
         p.id::text AS payment_id,
         p.kora_reference,
         p.amount_kobo::text AS amount_kobo,
         p.status::text AS payment_status,
         p.verified_at::text AS verified_at,
         p.created_at::text AS payment_created_at,
         p.updated_at::text AS payment_updated_at,
         b.id::text AS booking_id,
         b.status::text AS booking_status,
         b.starts_at::text AS starts_at,
         b.deposit_kobo::text AS deposit_kobo,
         b.created_at::text AS booking_created_at,
         sv.name AS service_name,
         st.name AS staff_name,
         c.id::text AS customer_id,
         c.name AS customer_name,
         c.phone_e164 AS customer_phone
       FROM payments p
       LEFT JOIN bookings b ON b.id = p.booking_id
       LEFT JOIN services sv ON sv.id = b.service_id
       LEFT JOIN staff st ON st.id = b.staff_id
       LEFT JOIN customers c ON c.id = b.customer_id
       WHERE p.business_id = $1
         AND (
           p.status IN ('pending_verification', 'refund_pending', 'refund_failed', 'refunded')
           OR (p.status = 'succeeded' AND b.id IS NOT NULL AND (p.amount_kobo < b.deposit_kobo OR b.status IN ('expired', 'cancelled')))
         )
       ORDER BY p.updated_at DESC
       LIMIT 150`,
      [businessId],
    ),
    customersPool.query<{
      id: string;
      actor: string;
      action: string;
      entity_id: string;
      after: Record<string, unknown> | null;
      created_at: string;
    }>(
      `SELECT id::text AS id, actor, action, entity_id::text AS entity_id, after, created_at::text AS created_at
       FROM audit_log
       WHERE business_id = $1 AND entity = 'needs_attention_issue'
       ORDER BY created_at ASC
       LIMIT 500`,
      [businessId],
    ),
  ]);

  const auditStateByEntityId = new Map<string, IssueAuditOverride>();
  const auditHistoryByEntityId = new Map<string, IssueHistoryEvent[]>();

  for (const row of auditRes.rows) {
    const after = row.after ?? {};
    const current = auditStateByEntityId.get(row.entity_id) ?? {};
    const next: IssueAuditOverride = {
      ...current,
      updatedAt: row.created_at,
    };

    if (typeof after.status === 'string') {
      next.status = after.status as IssueStatus;
    }
    if ('assignedUserId' in after) {
      next.assignedUserId = typeof after.assignedUserId === 'string' ? after.assignedUserId : null;
    }
    if ('assignedUserName' in after) {
      next.assignedUserName =
        typeof after.assignedUserName === 'string' ? after.assignedUserName : null;
    }
    if ('assignedAt' in after) {
      next.assignedAt = typeof after.assignedAt === 'string' ? after.assignedAt : null;
    }
    if ('assignedBy' in after) {
      next.assignedBy = typeof after.assignedBy === 'string' ? after.assignedBy : null;
    }
    if ('resolvedAt' in after) {
      next.resolvedAt = typeof after.resolvedAt === 'string' ? after.resolvedAt : null;
    }
    if ('resolvedBy' in after) {
      next.resolvedBy = typeof after.resolvedBy === 'string' ? after.resolvedBy : null;
    }
    if ('resolutionNote' in after) {
      next.resolutionNote = typeof after.resolutionNote === 'string' ? after.resolutionNote : null;
    }
    if ('resolutionCategory' in after) {
      next.resolutionCategory =
        typeof after.resolutionCategory === 'string' ? after.resolutionCategory : null;
    }
    auditStateByEntityId.set(row.entity_id, next);

    const hist = auditHistoryByEntityId.get(row.entity_id) ?? [];
    const labelMap: Record<string, string> = {
      'issue.assigned': 'Issue assigned',
      'issue.status_changed': 'Status updated',
      'issue.resolved': 'Issue resolved',
      'issue.reopened': 'Issue reopened',
    };
    hist.push({
      id: row.id,
      timestamp: row.created_at,
      label: labelMap[row.action] ?? row.action,
      detail:
        typeof after.resolutionNote === 'string' && after.resolutionNote.trim().length > 0
          ? after.resolutionNote
          : typeof after.status === 'string'
            ? `Status set to ${after.status.replace('_', ' ')}`
            : typeof after.assignedUserName === 'string'
              ? `Assigned to ${after.assignedUserName}`
              : 'Updated by team',
      actor: row.actor,
    });
    auditHistoryByEntityId.set(row.entity_id, hist);
  }

  const issues: NeedsAttentionIssue[] = [];

  // 1. Human Assistance Requests from conversations
  for (const cv of convRes.rows) {
    const override = auditStateByEntityId.get(cv.id);
    const hasAudit = Boolean(override);
    if (cv.status !== 'needs_human' && !hasAudit) {
      continue;
    }

    const derivedStatus: IssueStatus =
      override?.status ?? (cv.status === 'needs_human' ? 'open' : 'resolved');

    const history: IssueHistoryEvent[] = [
      {
        id: `conv_created_${cv.id}`,
        timestamp: cv.created_at,
        label: 'Conversation started',
        detail: `Customer contacted via ${cv.channel === 'whatsapp' ? 'WhatsApp' : 'Web Chat'}.`,
        actor: 'customer',
      },
      {
        id: `conv_handoff_${cv.id}`,
        timestamp: cv.last_message_at ?? cv.updated_at,
        label: 'Human assistance requested',
        detail: cv.last_body
          ? `Latest message: "${cv.last_body.slice(0, 140)}"`
          : 'AI receptionist paused for human review.',
        actor: 'agent',
      },
      ...(auditHistoryByEntityId.get(cv.id) ?? []),
    ];

    issues.push({
      id: `iss_conv_${cv.id}`,
      reference: `NA-CONV-${cv.id.slice(0, 6).toUpperCase()}`,
      entityType: 'conversation',
      entityId: cv.id,
      category: 'human_assistance',
      title: 'Customer requested human assistance',
      whatHappened: cv.last_body
        ? `Customer sent "${cv.last_body.slice(0, 180)}" and the AI receptionist paused for a team member to reply.`
        : 'The AI receptionist handed this conversation over for human assistance.',
      recommendedAction:
        'Open the conversation, reply to the customer, and return the thread to AI handling or mark resolved once answered.',
      priority: 'normal',
      status: derivedStatus,
      assignedUserId: override?.assignedUserId ?? null,
      assignedUserName: override?.assignedUserName ?? null,
      assignedAt: override?.assignedAt ?? null,
      assignedBy: override?.assignedBy ?? null,
      resolvedAt: override?.resolvedAt ?? null,
      resolvedBy: override?.resolvedBy ?? null,
      resolutionNote: override?.resolutionNote ?? null,
      resolutionCategory: override?.resolutionCategory ?? null,
      createdAt: cv.last_message_at ?? cv.created_at,
      updatedAt: override?.updatedAt ?? cv.updated_at,
      customer: {
        id: cv.customer_id,
        name: cv.customer_name?.trim() || 'Guest Customer',
        phone: maskPhone(cv.customer_phone, role),
      },
      booking: null,
      conversation: {
        id: cv.id,
        channel: cv.channel === 'whatsapp' ? 'whatsapp' : 'web_chat',
        status: cv.status,
        lastMessagePreview: cv.last_body,
      },
      payment: null,
      history,
    });
  }

  // 2. Payment Exceptions
  for (const p of paymentRes.rows) {
    const override = auditStateByEntityId.get(p.payment_id);
    const amountKobo = Number(p.amount_kobo) || 0;
    const expectedKobo = Number(p.deposit_kobo ?? p.amount_kobo) || 0;
    const isUnderpaid =
      p.payment_status === 'succeeded' && p.booking_id !== null && amountKobo < expectedKobo;
    const isLateAfterExpiry =
      p.payment_status === 'succeeded' &&
      (p.booking_status === 'expired' || p.booking_status === 'cancelled');
    const isRefundFailed = p.payment_status === 'refund_failed';
    const isRefundPending = p.payment_status === 'refund_pending';
    const isRefunded = p.payment_status === 'refunded';
    const isPendingVerification = p.payment_status === 'pending_verification';

    let title = 'Deposit requires review';
    let whatHappened = 'A payment record requires operational review.';
    let recommendedAction = 'Check the latest Kora verification status before taking action.';
    let priority: IssuePriority = 'normal';
    let isFinanciallySettled = false;

    if (isLateAfterExpiry) {
      title = 'Late payment after hold expiry';
      whatHappened =
        'The customer paid after their temporary 15-minute reservation expired, so the slot was not confirmed automatically.';
      recommendedAction =
        'Check slot availability to rebook safely, or initiate a refund through the approved Kora refund workflow.';
      priority = 'high';
    } else if (isUnderpaid) {
      const shortfallNaira = Math.round((expectedKobo - amountKobo) / 100);
      title = 'Underpaid deposit received';
      whatHappened = `Verified deposit is ₦${shortfallNaira.toLocaleString('en-NG')} below the required deposit amount. The booking remains unconfirmed.`;
      recommendedAction =
        'Review the shortfall with the customer or initiate a refund per your deposit policy.';
      priority = 'high';
    } else if (isRefundFailed) {
      title = 'Refund initiation failed';
      whatHappened =
        'A scheduled customer refund could not be completed by Kora and requires attention.';
      recommendedAction = 'Review the refund details and retry through the Kora refund workflow.';
      priority = 'high';
    } else if (isRefundPending) {
      title = 'Refund awaiting confirmation';
      whatHappened = 'A refund has been initiated and is awaiting final verification from Kora.';
      recommendedAction = 'Check payment status to confirm when Kora completes the refund.';
      priority = 'normal';
    } else if (isPendingVerification) {
      title = 'Payment verification delayed';
      whatHappened =
        'Payment verification is taking longer than expected. A provider timeout is not proof of payment failure.';
      recommendedAction = 'Check payment status via reconciliation before advising the customer.';
      priority = 'normal';
    } else if (isRefunded) {
      title = 'Refund completed';
      whatHappened = 'The customer refund was verified as completed by Kora.';
      recommendedAction = 'No further financial action required.';
      priority = 'low';
      isFinanciallySettled = true;
    }

    const derivedStatus: IssueStatus = override?.status ?? (isRefunded ? 'resolved' : 'open');

    const history: IssueHistoryEvent[] = [
      {
        id: `pay_created_${p.payment_id}`,
        timestamp: p.payment_created_at,
        label: 'Deposit initiated',
        detail: `Reference ${p.kora_reference} created.`,
        actor: 'system',
      },
      ...(p.verified_at
        ? [
            {
              id: `pay_verified_${p.payment_id}`,
              timestamp: p.verified_at,
              label: 'Kora verification recorded',
              detail: `₦${Math.round(amountKobo / 100).toLocaleString('en-NG')} verified.`,
              actor: 'system',
            },
          ]
        : []),
      ...(auditHistoryByEntityId.get(p.payment_id) ?? []),
    ];

    issues.push({
      id: `iss_pay_${p.payment_id}`,
      reference: `NA-PAY-${p.payment_id.slice(0, 6).toUpperCase()}`,
      entityType: 'payment',
      entityId: p.payment_id,
      category: 'payment',
      title,
      whatHappened,
      recommendedAction,
      priority,
      status: derivedStatus,
      assignedUserId: override?.assignedUserId ?? null,
      assignedUserName: override?.assignedUserName ?? null,
      assignedAt: override?.assignedAt ?? null,
      assignedBy: override?.assignedBy ?? null,
      resolvedAt: override?.resolvedAt ?? (isRefunded ? p.payment_updated_at : null),
      resolvedBy: override?.resolvedBy ?? (isRefunded ? 'system' : null),
      resolutionNote: override?.resolutionNote ?? null,
      resolutionCategory: override?.resolutionCategory ?? null,
      createdAt: p.payment_created_at,
      updatedAt: override?.updatedAt ?? p.payment_updated_at,
      customer:
        p.customer_id && p.customer_phone
          ? {
              id: p.customer_id,
              name: p.customer_name?.trim() || 'Guest Customer',
              phone: maskPhone(p.customer_phone, role),
            }
          : null,
      booking: p.booking_id
        ? {
            id: p.booking_id,
            reference: p.kora_reference,
            serviceName: p.service_name ?? 'Appointment',
            staffName: p.staff_name ?? 'Staff',
            startsAt: p.starts_at ?? p.payment_created_at,
            status: p.booking_status ?? 'held',
          }
        : null,
      conversation: null,
      payment: {
        id: p.payment_id,
        reference: p.kora_reference,
        expectedKobo,
        verifiedKobo: p.payment_status === 'succeeded' ? amountKobo : null,
        status: p.payment_status,
        refundStatus: isRefundFailed || isRefundPending || isRefunded ? p.payment_status : null,
        verifiedAt: p.verified_at,
        isFinanciallySettled,
      },
      history,
    });
  }

  // 3. Integration Setup / Outage (workspace-level, deduplicated)
  const biz = businessRes.rows[0];
  if (biz && !biz.whatsapp_phone_number_id) {
    const override = auditStateByEntityId.get(biz.id);
    const derivedStatus: IssueStatus = override?.status ?? 'open';
    issues.push({
      id: `iss_int_${biz.id}`,
      reference: `NA-INT-${biz.id.slice(0, 6).toUpperCase()}`,
      entityType: 'business',
      entityId: biz.id,
      category: 'integration',
      title: 'WhatsApp Business channel not connected',
      whatHappened:
        'Your WhatsApp Business phone number is not yet linked to Switchboard, so automated WhatsApp replies and confirmations are inactive.',
      recommendedAction: 'Open Integrations to connect your Meta WhatsApp Business number.',
      priority: 'low',
      status: derivedStatus,
      assignedUserId: override?.assignedUserId ?? null,
      assignedUserName: override?.assignedUserName ?? null,
      assignedAt: override?.assignedAt ?? null,
      assignedBy: override?.assignedBy ?? null,
      resolvedAt: override?.resolvedAt ?? null,
      resolvedBy: override?.resolvedBy ?? null,
      resolutionNote: override?.resolutionNote ?? null,
      resolutionCategory: override?.resolutionCategory ?? null,
      createdAt: biz.created_at,
      updatedAt: override?.updatedAt ?? biz.updated_at,
      customer: null,
      booking: null,
      conversation: null,
      payment: null,
      history: [
        {
          id: `biz_int_${biz.id}`,
          timestamp: biz.created_at,
          label: 'Integration check',
          detail: 'WhatsApp Business Phone Number ID is not configured.',
          actor: 'system',
        },
        ...(auditHistoryByEntityId.get(biz.id) ?? []),
      ],
    });
  }

  // Sort default: unresolved first, high -> normal -> low, oldest first for unresolved
  const priorityRank: Record<IssuePriority, number> = { high: 0, normal: 1, low: 2 };
  const isUnresolved = (s: IssueStatus) => s === 'open' || s === 'in_progress' || s === 'waiting';

  issues.sort((a, b) => {
    const ua = isUnresolved(a.status) ? 0 : 1;
    const ub = isUnresolved(b.status) ? 0 : 1;
    if (ua !== ub) return ua - ub;
    if (priorityRank[a.priority] !== priorityRank[b.priority]) {
      return priorityRank[a.priority] - priorityRank[b.priority];
    }
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  const todayKey = getLocalDateKey(new Date().toISOString(), businessTimezone);
  const summary: NeedsAttentionSummary = {
    openIssues: issues.filter((i) => isUnresolved(i.status)).length,
    needsHumanReply: issues.filter(
      (i) => isUnresolved(i.status) && i.category === 'human_assistance',
    ).length,
    paymentIssues: issues.filter((i) => isUnresolved(i.status) && i.category === 'payment').length,
    resolvedToday: issues.filter(
      (i) =>
        (i.status === 'resolved' || i.status === 'closed') &&
        i.resolvedAt &&
        getLocalDateKey(i.resolvedAt, businessTimezone) === todayKey,
    ).length,
  };

  return {
    issues,
    summary,
    staffMembers: staffRes.rows.map((s) => ({ id: s.id, name: s.name, role: s.role })),
  };
}
