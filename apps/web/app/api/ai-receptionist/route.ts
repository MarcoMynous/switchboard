import { NextResponse } from 'next/server';
import { customersPool, resolveAuthorizedBusiness } from '@/lib/customers-server';

export interface ReceptionistFaqItem {
  id: string;
  question: string;
  answer: string;
  category: string;
  updatedAt: string;
}

export interface ReceptionistConfigPayload {
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

const DEFAULT_CAPABILITIES = [
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
    title: 'Request Kora Deposits',
    description: 'Shares Kora deposit checkout details for bookings requiring payment.',
    icon: 'payments',
    badge: 'VIA KORA',
    enabled: true,
  },
];

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

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const requestedSlug = url.searchParams.get('slug');
    const ctx = await resolveAuthorizedBusiness(request, requestedSlug);
    if (!ctx) {
      return NextResponse.json({ ok: false, error: 'Authentication required' }, { status: 401 });
    }

    const { business, role } = ctx;

    const [bizRes, svcRes, stfRes, convRes, bkRes, auditRes] = await Promise.all([
      customersPool.query<{
        id: string;
        name: string;
        slug: string;
        phone: string | null;
        location: string | null;
        timezone: string;
        self_provided: boolean;
        deposit_required: boolean;
        default_deposit_kobo: string;
        free_cancel_hours: number;
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
                deposit_required, default_deposit_kobo::text AS default_deposit_kobo,
                free_cancel_hours, cancellation_policy, kora_status, kora_payout_account,
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
        duration_min: number;
        price_kobo: string;
      }>(
        `SELECT id::text AS id, name, duration_min, price_kobo::text AS price_kobo
         FROM services WHERE business_id = $1 ORDER BY name ASC`,
        [business.id],
      ),
      customersPool.query<{ id: string; name: string }>(
        `SELECT id::text AS id, name FROM staff WHERE business_id = $1 AND active = true`,
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

    const hasBusinessProfile = Boolean(biz.name?.trim() && biz.slug?.trim());
    const hasServices = svcRes.rows.length > 0;
    const hasStaffOrSolo = stfRes.rows.length > 0 || biz.self_provided;
    const koraReady = Boolean(biz.kora_payout_account) || biz.kora_status === 'ready';
    const webChatReady =
      hasBusinessProfile && hasServices && hasStaffOrSolo && (!biz.deposit_required || koraReady);
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
        depositRequired: biz.deposit_required,
        defaultDepositKobo: Number(biz.default_deposit_kobo) || 0,
        freeCancelHours: biz.free_cancel_hours,
        cancellationPolicy:
          biz.cancellation_policy ||
          `Full refund if cancelled at least ${biz.free_cancel_hours} hours before your scheduled slot.`,
        servicesCount: svcRes.rows.length,
        staffCount: stfRes.rows.length,
        selfProvided: biz.self_provided,
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
        koraReady,
        webChatReady,
        whatsappConnected,
        whatsappNumberLabel: whatsappConnected ? 'Verified Meta WhatsApp Number' : null,
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

      // Read authoritative Postgres data without creating any customer/booking/conversation rows
      const [bizRes, svcRes, stfRes, auditRes] = await Promise.all([
        customersPool.query<{
          name: string;
          location: string | null;
          deposit_required: boolean;
          default_deposit_kobo: string;
          assistant_name: string;
          tone: string;
        }>(
          `SELECT name, location, deposit_required, default_deposit_kobo::text AS default_deposit_kobo,
                  assistant_name, tone
           FROM businesses WHERE id = $1 LIMIT 1`,
          [ctx.business.id],
        ),
        customersPool.query<{ name: string; duration_min: number; price_kobo: string }>(
          `SELECT name, duration_min, price_kobo::text AS price_kobo
           FROM services WHERE business_id = $1 ORDER BY name ASC LIMIT 5`,
          [ctx.business.id],
        ),
        customersPool.query<{ name: string }>(
          `SELECT name FROM staff WHERE business_id = $1 AND active = true LIMIT 5`,
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

      const lower = message.toLowerCase();
      const firstSvc = svcRes.rows[0];
      const firstStaff = stfRes.rows[0];
      const depositNaira = Math.round((Number(biz.default_deposit_kobo) || 0) / 100);
      const faqs = Array.isArray(auditRes.rows[0]?.after?.faqs)
        ? (auditRes.rows[0]?.after?.faqs as ReceptionistFaqItem[])
        : [];
      const matchedFaq = faqs.find((f) => {
        const words = f.question
          .toLowerCase()
          .split(/\s+/)
          .filter((w) => w.length > 3);
        return words.some((w) => lower.includes(w));
      });

      let reply = '';
      let outcome = 'Response received';

      if (
        lower.includes('human') ||
        lower.includes('person') ||
        lower.includes('refund') ||
        lower.includes('dispute')
      ) {
        reply =
          "I'll ask someone from the team to help with this. Your request has been passed along to our staff inbox.";
        outcome = 'Human escalation test completed';
      } else if (matchedFaq) {
        reply = matchedFaq.answer;
        outcome = 'FAQ knowledge matched';
      } else if (
        lower.includes('book') ||
        lower.includes('appointment') ||
        lower.includes('slot') ||
        lower.includes('tomorrow') ||
        lower.includes('today')
      ) {
        if (!firstSvc) {
          reply = `I don't see any services configured yet for ${biz.name}. Please add a service first so I can check availability.`;
          outcome = 'Configuration issue detected';
        } else {
          const priceNaira = Math.round(Number(firstSvc.price_kobo) / 100);
          const staffLabel = firstStaff ? ` with ${firstStaff.name}` : '';
          reply = `I checked our live schedule for ${firstSvc.name} (${firstSvc.duration_min} mins, ₦${priceNaira.toLocaleString('en-NG')})${staffLabel}. ${
            biz.deposit_required
              ? `A 15-minute hold can be placed, and a verified ₦${depositNaira.toLocaleString('en-NG')} Kora deposit is required to confirm.`
              : 'Would you like me to hold a slot for you?'
          }`;
          outcome = 'Availability verified (Test Mode)';
        }
      } else if (lower.includes('price') || lower.includes('cost') || lower.includes('service')) {
        if (svcRes.rows.length === 0) {
          reply = `Services haven't been added for ${biz.name} yet. I can connect you with a team member to help.`;
          outcome = 'Configuration issue detected';
        } else {
          const summary = svcRes.rows
            .map(
              (s) =>
                `${s.name} (₦${Math.round(Number(s.price_kobo) / 100).toLocaleString('en-NG')})`,
            )
            .join(', ');
          reply = `Here are our current services at ${biz.name}: ${summary}.${
            biz.deposit_required
              ? ` Bookings require a ₦${depositNaira.toLocaleString('en-NG')} Kora deposit to confirm.`
              : ''
          }`;
          outcome = 'Response received';
        }
      } else {
        reply = `Welcome to ${biz.name}! I'm ${biz.assistant_name || 'Maya'}. ${
          biz.location ? `We're located at ${biz.location}. ` : ''
        }Ask me about our services, pricing, opening hours, or booking an appointment.`;
        outcome = 'Response received';
      }

      return NextResponse.json({
        ok: true,
        reply,
        outcome,
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
      const nextEnabled = Boolean(body.agentEnabled);

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

        if (!biz || !biz.name || !biz.slug) {
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
      if (
        greeting.toLowerCase().includes('confirmed without payment') ||
        greeting.toLowerCase().includes('no deposit needed even if required')
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

      const rawFaqs = Array.isArray(body.faqs) ? body.faqs : [];
      const sanitizedFaqs: ReceptionistFaqItem[] = rawFaqs
        .filter(
          (f): f is Record<string, unknown> =>
            Boolean(f) &&
            typeof f === 'object' &&
            typeof (f as Record<string, unknown>).question === 'string' &&
            typeof (f as Record<string, unknown>).answer === 'string',
        )
        .map((f) => ({
          id: typeof f.id === 'string' && f.id ? f.id : `faq_${Date.now()}`,
          question: String(f.question).trim().slice(0, 240),
          answer: String(f.answer).trim().slice(0, 1000),
          category:
            typeof f.category === 'string' && f.category.trim()
              ? f.category.trim().slice(0, 80)
              : 'General Business Information',
          updatedAt: typeof f.updatedAt === 'string' ? f.updatedAt : new Date().toISOString(),
        }))
        .filter((f) => f.question.length >= 3 && f.answer.length >= 3);

      const capabilities = Array.isArray(body.capabilities)
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
