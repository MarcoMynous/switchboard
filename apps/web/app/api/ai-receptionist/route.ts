import { NextResponse } from 'next/server';
import { customersPool, resolveAuthorizedBusiness } from '@/lib/customers-server';
import type { BusinessDaySchedule } from '@/lib/db-schema';

export interface ReceptionistFaqItem {
  id: string;
  question: string;
  answer: string;
  category: string;
  updatedAt: string;
}

export interface ReceptionistServiceSummary {
  id: string;
  name: string;
  description: string;
  durationMin: number;
  priceKobo: number;
  depositType: string;
  depositKobo: number;
}

export interface ReceptionistStaffSummary {
  id: string;
  name: string;
  roleTitle: string;
  active: boolean;
}

export interface ReceptionistDaySchedule {
  day: string;
  open: boolean;
  openTime: string;
  closeTime: string;
}

interface ReceptionistConfigPayload {
  assistantName: string;
  primaryLanguage: 'English' | 'Nigerian Pidgin';
  tone: 'Friendly' | 'Professional' | 'Casual';
  greeting: string;
  shortIntro: string;
  handoffMessage: string;
  escalationContact: string;
  faqs: ReceptionistFaqItem[];
  capabilities: Array<{
    id: string;
    title: string;
    description: string;
    icon: string;
    badge?: string;
    enabled: boolean;
  }>;
}

const ORDERED_DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

const INDEX_TO_WEEKDAY: Record<number, (typeof ORDERED_DAYS)[number]> = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
};

const DEFAULT_SCHEDULE: Record<(typeof ORDERED_DAYS)[number], BusinessDaySchedule> = {
  Monday: { open: true, openTime: '09:00', closeTime: '19:00' },
  Tuesday: { open: true, openTime: '09:00', closeTime: '19:00' },
  Wednesday: { open: true, openTime: '09:00', closeTime: '19:00' },
  Thursday: { open: true, openTime: '09:00', closeTime: '19:00' },
  Friday: { open: true, openTime: '09:00', closeTime: '20:00' },
  Saturday: { open: true, openTime: '09:00', closeTime: '20:00' },
  Sunday: { open: false, openTime: '12:00', closeTime: '18:00' },
};

const DEFAULT_CAPABILITIES: ReceptionistConfigPayload['capabilities'] = [
  {
    id: 'questions',
    title: 'Answer Business Questions',
    description: 'Uses approved services, working hours, policies, and FAQs.',
    icon: 'forum',
    enabled: true,
  },
  {
    id: 'appointments',
    title: 'Find & Hold Appointment Slots',
    description: 'Checks live staff availability and places 15-minute conflict-free holds.',
    icon: 'calendar_month',
    enabled: true,
  },
  {
    id: 'payments',
    title: 'Request Deposit Checkout',
    description:
      'Shares secure Kora bank-transfer or Interledger Wallet checkout links for bookings requiring payment.',
    icon: 'payments',
    badge: 'KORA + ILP',
    enabled: true,
  },
];

interface DraftConfigInput {
  assistantName?: string;
  primaryLanguage?: 'English' | 'Nigerian Pidgin';
  tone?: 'Friendly' | 'Professional' | 'Casual';
  greeting?: string;
  handoffMessage?: string;
  escalationContact?: string;
  faqs?: ReceptionistFaqItem[];
}

function parseFaqArray(raw: unknown): ReceptionistFaqItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (f): f is Record<string, unknown> =>
        Boolean(f) &&
        typeof f === 'object' &&
        typeof (f as Record<string, unknown>).question === 'string' &&
        typeof (f as Record<string, unknown>).answer === 'string',
    )
    .slice(0, 50)
    .map((f, index) => ({
      id:
        typeof f.id === 'string' && f.id.trim().length > 0
          ? f.id.trim()
          : `faq_${Date.now()}_${index}`,
      question: String(f.question).trim().slice(0, 240),
      answer: String(f.answer).trim().slice(0, 1000),
      category:
        typeof f.category === 'string' && f.category.trim()
          ? f.category.trim().slice(0, 80)
          : 'General Business Information',
      updatedAt: typeof f.updatedAt === 'string' ? f.updatedAt : new Date().toISOString(),
    }))
    .filter((f) => f.question.length >= 3 && f.answer.length >= 3);
}

function parseDraftConfig(raw: unknown): DraftConfigInput | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as Record<string, unknown>;
  const primaryLanguage =
    obj.primaryLanguage === 'Nigerian Pidgin'
      ? 'Nigerian Pidgin'
      : obj.primaryLanguage === 'English'
        ? 'English'
        : undefined;
  const tone =
    obj.tone === 'Friendly' || obj.tone === 'Professional' || obj.tone === 'Casual'
      ? obj.tone
      : undefined;

  return {
    assistantName: typeof obj.assistantName === 'string' ? obj.assistantName.trim() : undefined,
    primaryLanguage,
    tone,
    greeting: typeof obj.greeting === 'string' ? obj.greeting.trim() : undefined,
    handoffMessage: typeof obj.handoffMessage === 'string' ? obj.handoffMessage.trim() : undefined,
    escalationContact:
      typeof obj.escalationContact === 'string' ? obj.escalationContact.trim() : undefined,
    faqs: Array.isArray(obj.faqs) ? parseFaqArray(obj.faqs) : undefined,
  };
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

function buildScheduleList(
  rawSchedule: Record<string, BusinessDaySchedule> | null,
  hoursRows: Array<{ weekday: number; start_local: string; end_local: string }>,
): ReceptionistDaySchedule[] {
  let scheduleMap: Record<string, BusinessDaySchedule> | null = rawSchedule;

  if (!scheduleMap && hoursRows.length > 0) {
    const reconstructed: Record<string, BusinessDaySchedule> = {
      Monday: { open: false, openTime: '09:00', closeTime: '19:00' },
      Tuesday: { open: false, openTime: '09:00', closeTime: '19:00' },
      Wednesday: { open: false, openTime: '09:00', closeTime: '19:00' },
      Thursday: { open: false, openTime: '09:00', closeTime: '19:00' },
      Friday: { open: false, openTime: '09:00', closeTime: '20:00' },
      Saturday: { open: false, openTime: '09:00', closeTime: '20:00' },
      Sunday: { open: false, openTime: '12:00', closeTime: '18:00' },
    };
    for (const h of hoursRows) {
      const dayName = INDEX_TO_WEEKDAY[h.weekday];
      if (dayName) {
        reconstructed[dayName] = {
          open: true,
          openTime: h.start_local.slice(0, 5),
          closeTime: h.end_local.slice(0, 5),
        };
      }
    }
    scheduleMap = reconstructed;
  }

  const effective = scheduleMap ?? DEFAULT_SCHEDULE;
  return ORDERED_DAYS.map((day) => {
    const entry = effective[day] ?? DEFAULT_SCHEDULE[day];
    return {
      day,
      open: Boolean(entry.open),
      openTime: (entry.openTime || '09:00').slice(0, 5),
      closeTime: (entry.closeTime || '19:00').slice(0, 5),
    };
  });
}

function computeServiceDepositKobo(
  depositRequired: boolean,
  defaultDepositKobo: number,
  priceKobo: number,
  depositType: string,
  depositValue: number,
): number {
  if (!depositRequired || depositType === 'none') return 0;
  if (depositType === 'full') return priceKobo;
  if (depositType === 'percent') return Math.round((priceKobo * depositValue) / 100);
  return depositValue > 0 ? depositValue : defaultDepositKobo;
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

    const [bizRes, svcRes, stfRes, hoursRes, convRes, bkRes, pendingPayRes, auditRes] =
      await Promise.all([
        customersPool.query<{
          id: string;
          name: string;
          slug: string;
          phone: string | null;
          location: string | null;
          timezone: string;
          self_provided: boolean;
          schedule: Record<string, BusinessDaySchedule> | null;
          advance_days: number;
          allow_same_day: boolean;
          deposit_required: boolean;
          deposit_type: string;
          default_deposit_kobo: string;
          free_cancel_hours: number;
          merchant_bears_cost: boolean;
          cancellation_policy: string | null;
          kora_status: string;
          kora_payout_account: Record<string, unknown> | null;
          whatsapp_phone_number_id: string | null;
          assistant_name: string;
          greeting: string | null;
          tone: string;
          capabilities: ReceptionistConfigPayload['capabilities'] | null;
          agent_enabled: boolean;
          updated_at: string;
        }>(
          `SELECT id::text AS id, name, slug, phone, location, timezone, self_provided,
                  schedule, advance_days, allow_same_day,
                  deposit_required, deposit_type, default_deposit_kobo::text AS default_deposit_kobo,
                  free_cancel_hours, merchant_bears_cost, cancellation_policy, kora_status, kora_payout_account,
                  whatsapp_phone_number_id, assistant_name, greeting, tone, capabilities,
                  agent_enabled, updated_at::text AS updated_at
           FROM businesses
           WHERE id = $1
           LIMIT 1`,
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
        }>(
          `SELECT id::text AS id, name, description, duration_min, price_kobo::text AS price_kobo,
                  deposit_type::text AS deposit_type, deposit_value::text AS deposit_value
           FROM services WHERE business_id = $1 ORDER BY name ASC`,
          [business.id],
        ),
        customersPool.query<{
          id: string;
          name: string;
          role_title: string;
          active: boolean;
        }>(
          `SELECT id::text AS id, name, role_title, active
           FROM staff WHERE business_id = $1 ORDER BY active DESC, name ASC`,
          [business.id],
        ),
        customersPool.query<{
          weekday: number;
          start_local: string;
          end_local: string;
        }>(
          `SELECT wh.weekday, wh.start_local::text AS start_local, wh.end_local::text AS end_local
           FROM working_hours wh
           JOIN staff st ON st.id = wh.staff_id
           WHERE st.business_id = $1 AND st.active = true
           ORDER BY wh.weekday ASC`,
          [business.id],
        ),
        customersPool.query<{
          id: string;
          status: string;
          created_at: string;
          last_message_at: string | null;
        }>(
          `SELECT id::text AS id, status::text AS status, created_at::text AS created_at, last_message_at::text AS last_message_at
           FROM conversations WHERE business_id = $1`,
          [business.id],
        ),
        customersPool.query<{
          id: string;
          status: string;
          source: string;
          created_at: string;
        }>(
          `SELECT id::text AS id, status::text AS status, source::text AS source, created_at::text AS created_at
           FROM bookings WHERE business_id = $1`,
          [business.id],
        ),
        customersPool.query<{ cnt: string }>(
          `SELECT COUNT(*)::text AS cnt
           FROM payments p
           JOIN bookings b ON b.id = p.booking_id
           WHERE b.business_id = $1 AND p.status = 'pending_verification'`,
          [business.id],
        ),
        customersPool.query<{
          after: Record<string, unknown> | null;
          created_at: string;
        }>(
          `SELECT after, created_at::text AS created_at
           FROM audit_log
           WHERE business_id = $1 AND entity = 'ai_receptionist_config'
           ORDER BY created_at DESC
           LIMIT 1`,
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

    const latestExtra = auditRes.rows[0]?.after ?? {};
    const primaryLanguage =
      latestExtra.primaryLanguage === 'Nigerian Pidgin' ? 'Nigerian Pidgin' : 'English';
    const shortIntro =
      typeof latestExtra.shortIntro === 'string'
        ? latestExtra.shortIntro
        : 'AI Booking Receptionist for appointments, pricing, and deposit guidance.';
    const handoffMessage =
      typeof latestExtra.handoffMessage === 'string' && latestExtra.handoffMessage.trim()
        ? latestExtra.handoffMessage
        : "I'll ask someone from the team to help with this. Your request has been passed along.";
    const escalationContact =
      typeof latestExtra.escalationContact === 'string' && latestExtra.escalationContact.trim()
        ? latestExtra.escalationContact
        : biz.phone || '';
    const faqs: ReceptionistFaqItem[] = Array.isArray(latestExtra.faqs)
      ? (latestExtra.faqs as ReceptionistFaqItem[])
      : [];

    const defaultDepositKobo = Number(biz.default_deposit_kobo) || 0;
    const servicesSummary: ReceptionistServiceSummary[] = svcRes.rows.map((s) => {
      const priceKobo = Number(s.price_kobo) || 0;
      const depositValue = Number(s.deposit_value) || 0;
      return {
        id: s.id,
        name: s.name,
        description: s.description || '',
        durationMin: s.duration_min,
        priceKobo,
        depositType: s.deposit_type,
        depositKobo: computeServiceDepositKobo(
          biz.deposit_required,
          defaultDepositKobo,
          priceKobo,
          s.deposit_type,
          depositValue,
        ),
      };
    });

    const staffSummary: ReceptionistStaffSummary[] = stfRes.rows.map((st) => ({
      id: st.id,
      name: st.name,
      roleTitle: st.role_title || 'Staff Provider',
      active: st.active,
    }));

    const activeStaffCount = staffSummary.filter((st) => st.active).length;
    const scheduleList = buildScheduleList(biz.schedule, hoursRes.rows);
    const openDaysCount = scheduleList.filter((d) => d.open).length;

    const hasBusinessProfile = Boolean(biz.name?.trim() && biz.slug?.trim());
    const hasServices = servicesSummary.length > 0;
    const hasStaffOrSolo = activeStaffCount > 0 || biz.self_provided;
    const hasWorkingHours = openDaysCount > 0 || hoursRes.rows.length > 0;
    const koraReady = Boolean(biz.kora_payout_account) || biz.kora_status === 'ready';
    const webChatReady =
      hasBusinessProfile &&
      hasServices &&
      hasStaffOrSolo &&
      hasWorkingHours &&
      (!biz.deposit_required || koraReady);
    const whatsappConnected = Boolean(biz.whatsapp_phone_number_id);

    const todayKey = getLocalDateKey(new Date().toISOString(), biz.timezone);
    const aiSources = new Set(['whatsapp', 'web_chat']);
    const aiBookings = bkRes.rows.filter((b) => aiSources.has(b.source));

    const activity = {
      conversationsToday: convRes.rows.filter(
        (c) => getLocalDateKey(c.last_message_at ?? c.created_at, biz.timezone) === todayKey,
      ).length,
      bookingRequestsInitiated: aiBookings.length,
      confirmedFromAi: aiBookings.filter(
        (b) => b.status === 'confirmed' || b.status === 'completed',
      ).length,
      humanHandoffsRaised: convRes.rows.filter((c) => c.status === 'needs_human').length,
      pendingPaymentVerifications: Number(pendingPayRes.rows[0]?.cnt ?? '0'),
    };

    const tone =
      biz.tone === 'Professional' || biz.tone === 'Casual' ? biz.tone : ('Friendly' as const);

    return NextResponse.json({
      ok: true,
      role,
      business: {
        id: biz.id,
        name: biz.name,
        slug: biz.slug,
        timezone: biz.timezone,
        location: biz.location || '',
        phone: biz.phone || '',
        advanceDays: biz.advance_days,
        allowSameDay: biz.allow_same_day,
        depositRequired: biz.deposit_required,
        depositType: biz.deposit_type,
        defaultDepositKobo,
        freeCancelHours: biz.free_cancel_hours,
        merchantBearsCost: biz.merchant_bears_cost,
        cancellationPolicy:
          biz.cancellation_policy ||
          `Full refund if cancelled at least ${biz.free_cancel_hours} hours before your scheduled slot.`,
        servicesCount: servicesSummary.length,
        staffCount: activeStaffCount,
        selfProvided: biz.self_provided,
        services: servicesSummary,
        staff: staffSummary,
        schedule: scheduleList,
      },
      receptionist: {
        agentEnabled: biz.agent_enabled,
        assistantName: biz.assistant_name || 'Maya',
        primaryLanguage,
        tone,
        greeting:
          biz.greeting ||
          `Hi! Welcome to ${biz.name}. I'm ${biz.assistant_name || 'Maya'}, your booking assistant. Would you like to book an appointment or ask a question?`,
        shortIntro,
        handoffMessage,
        escalationContact,
        faqs,
        capabilities:
          Array.isArray(biz.capabilities) && biz.capabilities.length > 0
            ? biz.capabilities
            : DEFAULT_CAPABILITIES,
        updatedAt: biz.updated_at,
      },
      readiness: {
        hasBusinessProfile,
        hasServices,
        hasStaffOrSolo,
        hasWorkingHours,
        koraReady,
        webChatReady,
        whatsappConnected,
        whatsappPhoneNumberId: biz.whatsapp_phone_number_id || null,
        whatsappNumberLabel: whatsappConnected
          ? `Connected (${biz.whatsapp_phone_number_id})`
          : null,
      },
      activity,
    });
  } catch (err) {
    console.error('[api/ai-receptionist GET] error:', err);
    return NextResponse.json(
      { ok: false, error: "We couldn't load your receptionist settings." },
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

    const action = body.action;

    if (action === 'test_chat') {
      const message = typeof body.message === 'string' ? body.message.trim() : '';
      if (!message) {
        return NextResponse.json(
          { ok: false, error: 'Enter a message to test your receptionist.' },
          { status: 400 },
        );
      }
      if (message.length > 500) {
        return NextResponse.json(
          { ok: false, error: 'Test message must be 500 characters or fewer.' },
          { status: 400 },
        );
      }

      const draft = parseDraftConfig(body.draft);

      // Read authoritative Postgres data without creating any customer/booking/conversation/payment rows
      const [bizRes, svcRes, stfRes, hoursRes, auditRes] = await Promise.all([
        customersPool.query<{
          name: string;
          slug: string;
          location: string | null;
          phone: string | null;
          timezone: string;
          self_provided: boolean;
          schedule: Record<string, BusinessDaySchedule> | null;
          advance_days: number;
          allow_same_day: boolean;
          deposit_required: boolean;
          default_deposit_kobo: string;
          free_cancel_hours: number;
          cancellation_policy: string | null;
          assistant_name: string;
          greeting: string | null;
          tone: string;
          interledger_enabled: boolean;
          interledger_wallet_address: string | null;
        }>(
          `SELECT name, slug, location, phone, timezone, self_provided, schedule, advance_days, allow_same_day,
                  deposit_required, default_deposit_kobo::text AS default_deposit_kobo,
                  free_cancel_hours, cancellation_policy, assistant_name, greeting, tone,
                  interledger_enabled, interledger_wallet_address
           FROM businesses WHERE id = $1 LIMIT 1`,
          [ctx.business.id],
        ),
        customersPool.query<{
          name: string;
          duration_min: number;
          price_kobo: string;
          deposit_type: string;
          deposit_value: string;
        }>(
          `SELECT name, duration_min, price_kobo::text AS price_kobo,
                  deposit_type::text AS deposit_type, deposit_value::text AS deposit_value
           FROM services WHERE business_id = $1 ORDER BY name ASC LIMIT 8`,
          [ctx.business.id],
        ),
        customersPool.query<{ name: string; role_title: string }>(
          `SELECT name, role_title FROM staff WHERE business_id = $1 AND active = true ORDER BY name ASC LIMIT 6`,
          [ctx.business.id],
        ),
        customersPool.query<{ weekday: number; start_local: string; end_local: string }>(
          `SELECT wh.weekday, wh.start_local::text AS start_local, wh.end_local::text AS end_local
           FROM working_hours wh
           JOIN staff st ON st.id = wh.staff_id
           WHERE st.business_id = $1 AND st.active = true
           ORDER BY wh.weekday ASC`,
          [ctx.business.id],
        ),
        customersPool.query<{ after: Record<string, unknown> | null }>(
          `SELECT after FROM audit_log
           WHERE business_id = $1 AND entity = 'ai_receptionist_config'
           ORDER BY created_at DESC LIMIT 1`,
          [ctx.business.id],
        ),
      ]);

      const biz = bizRes.rows[0];
      if (!biz) {
        return NextResponse.json(
          { ok: false, error: 'Business workspace not found.' },
          { status: 404 },
        );
      }

      const savedExtra = auditRes.rows[0]?.after ?? {};
      const effectiveAssistantName = draft?.assistantName?.trim() || biz.assistant_name || 'Maya';
      const effectiveLanguage =
        draft?.primaryLanguage ??
        (savedExtra.primaryLanguage === 'Nigerian Pidgin' ? 'Nigerian Pidgin' : 'English');
      const effectiveHandoffMessage =
        draft?.handoffMessage?.trim() ||
        (typeof savedExtra.handoffMessage === 'string' && savedExtra.handoffMessage.trim()
          ? savedExtra.handoffMessage.trim()
          : "I'll ask someone from the team to help with this. Your request has been passed along.");
      const effectiveEscalationContact =
        draft?.escalationContact?.trim() ??
        (typeof savedExtra.escalationContact === 'string'
          ? savedExtra.escalationContact.trim()
          : biz.phone || '');
      const effectiveFaqs: ReceptionistFaqItem[] = Array.isArray(draft?.faqs)
        ? draft.faqs
        : Array.isArray(savedExtra.faqs)
          ? (savedExtra.faqs as ReceptionistFaqItem[])
          : [];

      const lower = message.toLowerCase();
      const defaultDepositKobo = Number(biz.default_deposit_kobo) || 0;
      const defaultDepositNaira = Math.round(defaultDepositKobo / 100);
      const scheduleList = buildScheduleList(biz.schedule, hoursRes.rows);
      const openDays = scheduleList.filter((d) => d.open);

      const matchedFaq = effectiveFaqs.find((f) => {
        const qLower = f.question.toLowerCase();
        if (lower.includes(qLower) || qLower.includes(lower)) return true;
        const words = qLower.split(/[^a-z0-9]+/).filter((w) => w.length > 3);
        return words.length > 0 && words.some((w) => lower.includes(w));
      });

      const matchedService =
        svcRes.rows.find((s) => lower.includes(s.name.toLowerCase())) ?? svcRes.rows[0];
      const firstStaff = stfRes.rows[0];

      let reply = '';
      let outcome = 'Response received';
      let matchedSource = 'Identity & Greeting';

      if (
        lower.includes('human') ||
        lower.includes('person') ||
        lower.includes('customer care') ||
        lower.includes('manager') ||
        lower.includes('refund') ||
        lower.includes('dispute') ||
        lower.includes('complain')
      ) {
        const contactSuffix = effectiveEscalationContact
          ? ` Escalation contact: ${effectiveEscalationContact}.`
          : '';
        reply = `${effectiveHandoffMessage}${contactSuffix} [Test Mode: Conversation would transition to needs_human in Conversations & Needs Attention.]`;
        outcome = 'Human escalation triggered (Test Mode)';
        matchedSource = 'Human Handoff Rules';
      } else if (matchedFaq) {
        reply = matchedFaq.answer;
        outcome = 'FAQ knowledge matched';
        matchedSource = `FAQ (${matchedFaq.category})`;
      } else if (
        lower.includes('book') ||
        lower.includes('appointment') ||
        lower.includes('slot') ||
        lower.includes('tomorrow') ||
        lower.includes('today') ||
        lower.includes('hold') ||
        lower.includes('wan do') ||
        lower.includes('abeg') ||
        svcRes.rows.some((s) => lower.includes(s.name.toLowerCase()))
      ) {
        if (!matchedService) {
          reply = `I don't see any services configured yet for ${biz.name}. Please add a service in Services & Staff first so I can check live availability.`;
          outcome = 'Configuration issue detected';
          matchedSource = 'Services & Staff Catalog';
        } else if (stfRes.rows.length === 0 && !biz.self_provided) {
          reply = `No active staff providers are configured for ${biz.name} yet. Add a staff member or enable solo provider mode to check slots.`;
          outcome = 'Configuration issue detected';
          matchedSource = 'Services & Staff Catalog';
        } else {
          const priceKobo = Number(matchedService.price_kobo) || 0;
          const priceNaira = Math.round(priceKobo / 100);
          const depKobo = computeServiceDepositKobo(
            biz.deposit_required,
            defaultDepositKobo,
            priceKobo,
            matchedService.deposit_type,
            Number(matchedService.deposit_value) || 0,
          );
          const depNaira = Math.round(depKobo / 100);
          const staffLabel = firstStaff ? ` with ${firstStaff.name}` : '';
          const pidginPrefix =
            effectiveLanguage === 'Nigerian Pidgin'
              ? `No wahala! I don check our live schedule for ${matchedService.name}`
              : `I checked our live schedule for ${matchedService.name}`;

          reply = `${pidginPrefix} (${matchedService.duration_min} mins, ₦${priceNaira.toLocaleString('en-NG')})${staffLabel}. Available times: 10:00 AM, 2:00 PM, or 4:30 PM (${biz.timezone}). ${
            depKobo > 0
              ? `Selecting a time places a 15-minute temporary hold and requires a verified ₦${depNaira.toLocaleString('en-NG')} Kora deposit before the booking is confirmed.`
              : 'Selecting a time places a 15-minute temporary hold before confirmation.'
          } [Test Mode: No live hold or Kora charge created.]`;
          outcome = 'Availability & 15m hold simulated (Test Mode)';
          matchedSource = 'Booking Engine & Services Catalog';
        }
      } else if (
        lower.includes('price') ||
        lower.includes('cost') ||
        lower.includes('how much') ||
        lower.includes('service') ||
        lower.includes('menu')
      ) {
        if (svcRes.rows.length === 0) {
          reply = `Services haven't been added for ${biz.name} yet. Add services in Services & Staff so I can quote accurate prices.`;
          outcome = 'Configuration issue detected';
          matchedSource = 'Services & Staff Catalog';
        } else {
          const summary = svcRes.rows
            .map(
              (s) =>
                `${s.name} (${s.duration_min}m — ₦${Math.round(Number(s.price_kobo) / 100).toLocaleString('en-NG')})`,
            )
            .join(', ');
          reply = `Here are our authoritative services at ${biz.name}: ${summary}.${
            biz.deposit_required
              ? ` Bookings require a ₦${defaultDepositNaira.toLocaleString('en-NG')} Kora deposit within a 15-minute hold to confirm.`
              : ' No deposit is required to book.'
          }`;
          outcome = 'Authoritative catalog used';
          matchedSource = 'Services & Staff Catalog';
        }
      } else if (
        lower.includes('interledger') ||
        lower.includes('open payments') ||
        lower.includes('wallet') ||
        lower.includes('payment method') ||
        lower.includes('how can i pay') ||
        lower.includes('how do i pay')
      ) {
        const checkoutUrl = `${process.env.PUBLIC_APP_URL ?? 'http://localhost:3000'}/b/${biz.slug}`;
        const ilpEnabled = Boolean(biz.interledger_enabled && biz.interledger_wallet_address);
        if (ilpEnabled) {
          reply = `Yes, ${biz.name} accepts both Bank Transfer (via Kora) and Interledger Wallet for booking deposits. You can complete your deposit securely on our checkout page: ${checkoutUrl}. Never share private wallet keys here—you will authorize the payment directly with your wallet provider, and Switchboard will confirm your appointment once receipt is verified.`;
        } else {
          reply = `${biz.name} currently accepts Bank Transfer (via Kora) for booking deposits. Interledger Wallet is not enabled for this business yet. You can complete your booking and deposit securely at ${checkoutUrl}.`;
        }
        outcome = 'Payment methods explained (no secrets collected)';
        matchedSource = 'Business Payment Settings';
      } else if (
        lower.includes('hour') ||
        lower.includes('open') ||
        lower.includes('close') ||
        lower.includes('schedule') ||
        lower.includes('where') ||
        lower.includes('location') ||
        lower.includes('address')
      ) {
        const hoursText =
          openDays.length > 0
            ? openDays.map((d) => `${d.day.slice(0, 3)} ${d.openTime}–${d.closeTime}`).join(', ')
            : 'No open days configured yet';
        const locText = biz.location ? ` We are located at ${biz.location}.` : '';
        reply = `${biz.name} opening hours (${biz.timezone}): ${hoursText}.${locText} Bookings can be made up to ${biz.advance_days} days in advance.`;
        outcome = 'Authoritative schedule & location used';
        matchedSource = 'Working Hours & Business Profile';
      } else if (
        lower.includes('cancel') ||
        lower.includes('policy') ||
        lower.includes('deposit') ||
        lower.includes('kora')
      ) {
        const policyText =
          biz.cancellation_policy ||
          `Full refund if cancelled at least ${biz.free_cancel_hours} hours before your scheduled slot.`;
        reply = `${
          biz.deposit_required
            ? `A ₦${defaultDepositNaira.toLocaleString('en-NG')} deposit via Kora is required within the 15-minute hold window before a booking is confirmed.`
            : 'Deposits are not currently required.'
        } Cancellation policy: ${policyText}`;
        outcome = 'Authoritative policy used';
        matchedSource = 'Payment & Cancellation Policy';
      } else {
        const baseGreeting =
          draft?.greeting?.trim() ||
          biz.greeting ||
          (effectiveLanguage === 'Nigerian Pidgin'
            ? `How far! Welcome to ${biz.name}. Na ${effectiveAssistantName} I be, your booking assistant. You wan book appointment or ask question?`
            : `Hi! Welcome to ${biz.name}. I'm ${effectiveAssistantName}, your booking assistant. Would you like to book an appointment or ask a question?`);
        reply = baseGreeting;
        outcome = 'Greeting & identity verified';
        matchedSource = 'Identity & Greeting';
      }

      return NextResponse.json({
        ok: true,
        reply,
        outcome,
        matchedSource,
        isTestSession: true,
      });
    }

    // Mutations require owner role
    if (ctx.role !== 'owner') {
      return NextResponse.json(
        { ok: false, error: 'Only workspace owners can modify AI Receptionist settings.' },
        { status: 403 },
      );
    }

    if (action === 'toggle_agent') {
      if (typeof body.agentEnabled !== 'boolean') {
        return NextResponse.json(
          { ok: false, error: 'Invalid toggle request payload.' },
          { status: 400 },
        );
      }

      const nextEnabled = body.agentEnabled;

      if (nextEnabled) {
        const [bizRes, svcCountRes, stfCountRes] = await Promise.all([
          customersPool.query<{
            name: string;
            slug: string;
            self_provided: boolean;
            deposit_required: boolean;
            kora_status: string;
            kora_payout_account: Record<string, unknown> | null;
          }>(
            `SELECT name, slug, self_provided, deposit_required, kora_status, kora_payout_account
             FROM businesses WHERE id = $1 LIMIT 1`,
            [ctx.business.id],
          ),
          customersPool.query<{ cnt: string }>(
            `SELECT COUNT(*)::text AS cnt FROM services WHERE business_id = $1`,
            [ctx.business.id],
          ),
          customersPool.query<{ cnt: string }>(
            `SELECT COUNT(*)::text AS cnt FROM staff WHERE business_id = $1 AND active = true`,
            [ctx.business.id],
          ),
        ]);

        const biz = bizRes.rows[0];
        const svcCount = Number(svcCountRes.rows[0]?.cnt ?? '0');
        const stfCount = Number(stfCountRes.rows[0]?.cnt ?? '0');
        const koraReady = Boolean(biz?.kora_payout_account) || biz?.kora_status === 'ready';

        if (!biz?.name || !biz.slug) {
          return NextResponse.json(
            {
              ok: false,
              error: 'Complete your business profile before enabling the receptionist.',
            },
            { status: 409 },
          );
        }
        if (svcCount === 0) {
          return NextResponse.json(
            { ok: false, error: 'Add at least one service before enabling the receptionist.' },
            { status: 409 },
          );
        }
        if (stfCount === 0 && !biz.self_provided) {
          return NextResponse.json(
            { ok: false, error: 'Add at least one staff member before enabling the receptionist.' },
            { status: 409 },
          );
        }
        if (biz.deposit_required && !koraReady) {
          return NextResponse.json(
            {
              ok: false,
              error: 'Deposit-required bookings cannot be enabled until Kora is configured.',
            },
            { status: 409 },
          );
        }
      }

      const client = await customersPool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `UPDATE businesses SET agent_enabled = $1, updated_at = now() WHERE id = $2`,
          [nextEnabled, ctx.business.id],
        );
        await client.query(
          `INSERT INTO audit_log (business_id, actor, action, entity, entity_id, after)
           VALUES ($1, $2, 'ai_receptionist.toggled', 'business', $3, $4::jsonb)`,
          [
            ctx.business.id,
            `staff:${ctx.user.id}`,
            ctx.business.id,
            JSON.stringify({ agentEnabled: nextEnabled }),
          ],
        );
        await client.query('COMMIT');
        return NextResponse.json({ ok: true, agentEnabled: nextEnabled });
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    }

    if (action === 'save_config') {
      const assistantName = typeof body.assistantName === 'string' ? body.assistantName.trim() : '';
      const greeting = typeof body.greeting === 'string' ? body.greeting.trim() : '';
      const tone = typeof body.tone === 'string' ? body.tone : 'Friendly';
      const primaryLanguage =
        body.primaryLanguage === 'Nigerian Pidgin'
          ? 'Nigerian Pidgin'
          : body.primaryLanguage === 'English'
            ? 'English'
            : null;
      const shortIntro =
        typeof body.shortIntro === 'string' ? body.shortIntro.trim().slice(0, 200) : '';
      const handoffMessage =
        typeof body.handoffMessage === 'string' ? body.handoffMessage.trim() : '';
      const escalationContact =
        typeof body.escalationContact === 'string'
          ? body.escalationContact.trim().slice(0, 80)
          : '';

      if (assistantName.length < 2 || assistantName.length > 40) {
        return NextResponse.json(
          { ok: false, error: 'Assistant name must be between 2 and 40 characters.' },
          { status: 400 },
        );
      }
      if (greeting.length < 10 || greeting.length > 600) {
        return NextResponse.json(
          { ok: false, error: 'Welcome message must be between 10 and 600 characters.' },
          { status: 400 },
        );
      }

      const lowerGreeting = greeting.toLowerCase();
      if (
        lowerGreeting.includes('confirmed without payment') ||
        lowerGreeting.includes('no deposit needed even if required') ||
        lowerGreeting.includes('guaranteed without deposit')
      ) {
        return NextResponse.json(
          { ok: false, error: 'Welcome message cannot override deposit or confirmation rules.' },
          { status: 400 },
        );
      }
      if (!primaryLanguage) {
        return NextResponse.json(
          { ok: false, error: 'Selected language is not supported yet.' },
          { status: 400 },
        );
      }
      if (!['Friendly', 'Professional', 'Casual'].includes(tone)) {
        return NextResponse.json(
          { ok: false, error: 'Invalid communication tone selected.' },
          { status: 400 },
        );
      }
      if (handoffMessage.length < 10 || handoffMessage.length > 400) {
        return NextResponse.json(
          { ok: false, error: 'Handoff message must be between 10 and 400 characters.' },
          { status: 400 },
        );
      }

      const sanitizedFaqs = parseFaqArray(body.faqs);
      const capabilities =
        Array.isArray(body.capabilities) && body.capabilities.length > 0
          ? body.capabilities
          : DEFAULT_CAPABILITIES;

      const client = await customersPool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `UPDATE businesses
           SET assistant_name = $1, greeting = $2, tone = $3, capabilities = $4::jsonb, updated_at = now()
           WHERE id = $5`,
          [assistantName, greeting, tone, JSON.stringify(capabilities), ctx.business.id],
        );
        await client.query(
          `INSERT INTO audit_log (business_id, actor, action, entity, entity_id, after)
           VALUES ($1, $2, 'ai_receptionist.updated', 'ai_receptionist_config', $3, $4::jsonb)`,
          [
            ctx.business.id,
            `staff:${ctx.user.id}`,
            ctx.business.id,
            JSON.stringify({
              assistantName,
              primaryLanguage,
              tone,
              shortIntro,
              handoffMessage,
              escalationContact,
              faqs: sanitizedFaqs,
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
    console.error('[api/ai-receptionist POST] error:', err);
    return NextResponse.json(
      { ok: false, error: 'Failed to save AI receptionist configuration.' },
      { status: 500 },
    );
  }
}
