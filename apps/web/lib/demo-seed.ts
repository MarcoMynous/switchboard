import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';

const DEFAULT_SCHEDULE = {
  Monday: { open: true, openTime: '09:00', closeTime: '19:00' },
  Tuesday: { open: true, openTime: '09:00', closeTime: '19:00' },
  Wednesday: { open: true, openTime: '09:00', closeTime: '19:00' },
  Thursday: { open: true, openTime: '09:00', closeTime: '19:00' },
  Friday: { open: true, openTime: '09:00', closeTime: '20:00' },
  Saturday: { open: true, openTime: '09:00', closeTime: '20:00' },
  Sunday: { open: false, openTime: '12:00', closeTime: '18:00' },
};

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

const DEMO_FAQS = [
  {
    id: 'faq-walk-ins',
    question: 'Do you accept walk-ins or only bookings?',
    answer:
      'We welcome walk-ins when a chair is open, but booking online or via Maya guarantees your slot and locks in your preferred barber.',
    category: 'Booking Rules',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'faq-deposit',
    question: 'Why do I need to pay a deposit?',
    answer:
      'A small Kora deposit reserves your barber chair and counts toward your final bill. Full refund if cancelled at least 4 hours before your slot.',
    category: 'Deposits & Refunds',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'faq-location',
    question: 'Where is Fade Republic located?',
    answer: 'KM 10 Idiroko Road, Ota, Ogun State — right beside the Covenant University junction.',
    category: 'Location & Hours',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'faq-late',
    question: 'What happens if I am running 10 minutes late?',
    answer:
      'Please send a message in chat so we can notify your barber. Holds stay active for 15 minutes before the slot is released.',
    category: 'Booking Rules',
    updatedAt: new Date().toISOString(),
  },
];

/** Returns YYYY-MM-DD in Africa/Lagos plus day offset. */
function lagosDateString(dayOffset: number): string {
  const now = new Date();
  const lagosNow = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const [y, m, d] = lagosNow.split('-').map(Number);
  const base = new Date(Date.UTC(y ?? 2026, (m ?? 1) - 1, (d ?? 1) + dayOffset));
  return base.toISOString().slice(0, 10);
}

/** Converts a Lagos local date + HH:MM (WAT = UTC+1, no DST) into a UTC ISO string. */
function lagosIso(dayOffset: number, timeHHMM: string): string {
  const dateStr = lagosDateString(dayOffset);
  return new Date(`${dateStr}T${timeHHMM}:00+01:00`).toISOString();
}

function addMinutesIso(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

async function clearDemoBusinessData(client: PoolClient, businessId: string): Promise<void> {
  // Delete in FK-safe order (payments.booking_id has ON DELETE RESTRICT).
  await client.query(`DELETE FROM payments WHERE business_id = $1`, [businessId]);
  await client.query(`DELETE FROM bookings WHERE business_id = $1`, [businessId]);
  await client.query(`DELETE FROM conversations WHERE business_id = $1`, [businessId]);
  await client.query(`DELETE FROM customers WHERE business_id = $1`, [businessId]);
  await client.query(
    `DELETE FROM time_off WHERE staff_id IN (SELECT id FROM staff WHERE business_id = $1)`,
    [businessId],
  );
  await client.query(
    `DELETE FROM working_hours WHERE staff_id IN (SELECT id FROM staff WHERE business_id = $1)`,
    [businessId],
  );
  await client.query(
    `DELETE FROM staff_services WHERE staff_id IN (SELECT id FROM staff WHERE business_id = $1)`,
    [businessId],
  );
  await client.query(`DELETE FROM staff WHERE business_id = $1`, [businessId]);
  await client.query(`DELETE FROM services WHERE business_id = $1`, [businessId]);
  await client.query(`DELETE FROM audit_log WHERE business_id = $1`, [businessId]);
}

async function populateDemoBusiness(
  client: PoolClient,
  businessId: string,
  demoSessionId: string,
): Promise<void> {
  const shortTag = demoSessionId.replace(/-/g, '').slice(0, 8);

  // 1. Six services with realistic Naira prices (stored as integer kobo per I6)
  const serviceDefs = [
    {
      name: 'Classic Fade & Beard Sculpt',
      description: 'Detailed skin or taper fade, hot towel prep, and precision beard sculpt.',
      durationMin: 45,
      priceKobo: 500_000,
      depositType: 'fixed',
      depositValue: 150_000,
    },
    {
      name: 'Standard Haircut',
      description: 'Clean clipper cut and sharp perimeter line-up.',
      durationMin: 30,
      priceKobo: 350_000,
      depositType: 'fixed',
      depositValue: 100_000,
    },
    {
      name: 'VIP Dreadlocks Retwist & Wash',
      description: 'Organic shampoo wash, scalp steam & deep palm-roll retwist.',
      durationMin: 90,
      priceKobo: 1_500_000,
      depositType: 'fixed',
      depositValue: 500_000,
    },
    {
      name: 'Hot Towel Shave & Facial',
      description: 'Soothing eucalyptus hot towel shave with charcoal exfoliation.',
      durationMin: 30,
      priceKobo: 400_000,
      depositType: 'fixed',
      depositValue: 100_000,
    },
    {
      name: 'Kids Neat Trim',
      description: 'Gentle, quick trim for kids under 12. Pay at the chair.',
      durationMin: 25,
      priceKobo: 250_000,
      depositType: 'none',
      depositValue: 0,
    },
    {
      name: 'Low cut',
      description: 'Quick, clean low cut. Pay at the chair: no deposit needed.',
      durationMin: 30,
      priceKobo: 300_000,
      depositType: 'none',
      depositValue: 0,
    },
  ] as const;

  const serviceIds: string[] = [];
  for (const svc of serviceDefs) {
    const res = await client.query<{ id: string }>(
      `INSERT INTO services
         (business_id, name, description, duration_min, price_kobo, deposit_type, deposit_value, free_cancel_hours, deposit_counts_toward_bill)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 4, true)
       RETURNING id`,
      [
        businessId,
        svc.name,
        svc.description,
        svc.durationMin,
        svc.priceKobo,
        svc.depositType,
        svc.depositValue,
      ],
    );
    if (res.rows[0]) serviceIds.push(res.rows[0].id);
  }

  // 2. Three bookable staff members
  const staffDefs = [
    { name: 'Tunde Adeyemi', role: 'owner', roleTitle: 'Lead Barber' },
    { name: 'Emeka Okafor', role: 'staff', roleTitle: 'Fade Specialist' },
    { name: 'Sadiq Musa', role: 'staff', roleTitle: 'Grooming & Locs Stylist' },
  ] as const;

  const staffIds: string[] = [];
  for (const member of staffDefs) {
    const res = await client.query<{ id: string }>(
      `INSERT INTO staff (business_id, name, role, role_title, active)
       VALUES ($1, $2, $3, $4, true)
       RETURNING id`,
      [businessId, member.name, member.role, member.roleTitle],
    );
    if (res.rows[0]) staffIds.push(res.rows[0].id);
  }

  // 3. Staff-service assignments & working hours (Mon-Sat) + lunch break today for Emeka
  for (const sId of staffIds) {
    for (const svcId of serviceIds) {
      await client.query(
        `INSERT INTO staff_services (staff_id, service_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [sId, svcId],
      );
    }
    for (const [weekday, startLocal, endLocal] of [
      [1, '09:00:00', '19:00:00'],
      [2, '09:00:00', '19:00:00'],
      [3, '09:00:00', '19:00:00'],
      [4, '09:00:00', '19:00:00'],
      [5, '09:00:00', '20:00:00'],
      [6, '09:00:00', '20:00:00'],
    ] as const) {
      await client.query(
        `INSERT INTO working_hours (staff_id, weekday, start_local, end_local)
         VALUES ($1, $2, $3, $4)`,
        [sId, weekday, startLocal, endLocal],
      );
    }
  }

  if (staffIds[1]) {
    const breakStart = lagosIso(0, '13:00');
    const breakEnd = lagosIso(0, '14:00');
    await client.query(
      `INSERT INTO time_off (staff_id, starts_at, ends_at, reason)
       VALUES ($1, $2, $3, 'Midday staff break')`,
      [staffIds[1], breakStart, breakEnd],
    );
  }

  // 4. Fictional customer profiles
  const customerDefs = [
    {
      name: 'Chinedu Eze',
      phone: '+2348035551101',
      notes: 'Prefers low taper with Tunde; always arrives 5 mins early.',
      tags: ['vip', 'regular'],
      visits: 6,
      noShows: 0,
    },
    {
      name: 'Adaeze Okonkwo',
      phone: '+2348035551102',
      notes: 'Books VIP Dreadlocks Retwist monthly.',
      tags: ['vip'],
      visits: 4,
      noShows: 0,
    },
    {
      name: 'Babatunde Bello',
      phone: '+2348035551103',
      notes: 'Requested receipt via email for corporate wellness.',
      tags: ['regular'],
      visits: 3,
      noShows: 0,
    },
    {
      name: 'Damilola Adebayo',
      phone: '+2348035551104',
      notes: 'First-time visitor from Covenant University.',
      tags: ['new'],
      visits: 1,
      noShows: 0,
    },
    {
      name: 'Funmilayo Ogunleye',
      phone: '+2348035551105',
      notes: 'Books Kids Neat Trim on weekends.',
      tags: ['family'],
      visits: 2,
      noShows: 0,
    },
    {
      name: 'Ifeanyi Obi',
      phone: '+2348035551106',
      notes: 'Had one expired hold last week; prefers morning slots.',
      tags: ['morning'],
      visits: 1,
      noShows: 1,
    },
  ];

  const customerIds: string[] = [];
  for (const c of customerDefs) {
    const res = await client.query<{ id: string }>(
      `INSERT INTO customers (business_id, phone_e164, name, notes, tags, visits, no_shows)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [businessId, c.phone, c.name, c.notes, c.tags, c.visits, c.noShows],
    );
    if (res.rows[0]) customerIds.push(res.rows[0].id);
  }

  // 5. Bookings & Temporary Holds relative to current business-local date (Africa/Lagos)
  // Avoid overlapping slots on the same staff member (Invariant I1).
  const [svcFade, svcStandard, svcLocs, svcShave, , svcLowCut] = serviceIds;
  const [stfTunde, stfEmeka, stfSadiq] = staffIds;
  const [custChinedu, custAdaeze, custBabatunde, custDamilola, custFunmi, custIfeanyi] =
    customerIds;

  if (
    !svcFade ||
    !svcStandard ||
    !svcLocs ||
    !svcShave ||
    !svcLowCut ||
    !stfTunde ||
    !stfEmeka ||
    !stfSadiq ||
    !custChinedu ||
    !custAdaeze ||
    !custBabatunde ||
    !custDamilola ||
    !custFunmi ||
    !custIfeanyi
  ) {
    throw new Error('Failed to insert core demo workspace fixtures.');
  }

  const now = new Date();
  const fifteenMinsFromNow = new Date(now.getTime() + 15 * 60_000).toISOString();
  const tenMinsAgo = new Date(now.getTime() - 10 * 60_000).toISOString();

  // Booking 1: Yesterday completed (Tunde, 10:00) + verified Kora deposit
  const b1Start = lagosIso(-1, '10:00');
  const b1Res = await client.query<{ id: string }>(
    `INSERT INTO bookings (business_id, staff_id, service_id, customer_id, starts_at, ends_at, status, source, idempotency_key)
     VALUES ($1, $2, $3, $4, $5, $6, 'completed', 'booking_page', $7)
     RETURNING id`,
    [
      businessId,
      stfTunde,
      svcFade,
      custChinedu,
      b1Start,
      addMinutesIso(b1Start, 45),
      `demo_${shortTag}_b1`,
    ],
  );
  const b1Id = b1Res.rows[0]?.id;
  if (b1Id) {
    await client.query(
      `INSERT INTO payments (business_id, booking_id, kind, amount_kobo, status, kora_reference, verified_at, idempotency_key)
       VALUES ($1, $2, 'deposit', 150000, 'succeeded', $3, $4, $5)`,
      [businessId, b1Id, `sb_dep_demo_${shortTag}_01`, b1Start, `demo_pay_${shortTag}_01`],
    );
  }

  // Booking 2: Today confirmed (Tunde, 10:00) + verified Kora deposit
  const b2Start = lagosIso(0, '10:00');
  const b2Res = await client.query<{ id: string }>(
    `INSERT INTO bookings (business_id, staff_id, service_id, customer_id, starts_at, ends_at, status, source, idempotency_key)
     VALUES ($1, $2, $3, $4, $5, $6, 'confirmed', 'whatsapp', $7)
     RETURNING id`,
    [
      businessId,
      stfTunde,
      svcFade,
      custBabatunde,
      b2Start,
      addMinutesIso(b2Start, 45),
      `demo_${shortTag}_b2`,
    ],
  );
  const b2Id = b2Res.rows[0]?.id;
  if (b2Id) {
    await client.query(
      `INSERT INTO payments (business_id, booking_id, kind, amount_kobo, status, kora_reference, verified_at, idempotency_key)
       VALUES ($1, $2, 'deposit', 150000, 'succeeded', $3, NOW(), $4)`,
      [businessId, b2Id, `sb_dep_demo_${shortTag}_02`, `demo_pay_${shortTag}_02`],
    );
  }

  // Booking 3: Today confirmed (Sadiq, 11:00) + pending_verification Kora deposit (triggers Needs Attention payment item)
  const b3Start = lagosIso(0, '11:00');
  const b3Res = await client.query<{ id: string }>(
    `INSERT INTO bookings (business_id, staff_id, service_id, customer_id, starts_at, ends_at, status, hold_expires_at, source, idempotency_key)
     VALUES ($1, $2, $3, $4, $5, $6, 'held', $7, 'web_chat', $8)
     RETURNING id`,
    [
      businessId,
      stfSadiq,
      svcLocs,
      custAdaeze,
      b3Start,
      addMinutesIso(b3Start, 90),
      fifteenMinsFromNow,
      `demo_${shortTag}_b3`,
    ],
  );
  const b3Id = b3Res.rows[0]?.id;
  if (b3Id) {
    await client.query(
      `INSERT INTO payments (business_id, booking_id, kind, amount_kobo, status, kora_reference, kora_account_number, expires_at, idempotency_key)
       VALUES ($1, $2, 'deposit', 500000, 'pending_verification', $3, '9012345678', $4, $5)`,
      [
        businessId,
        b3Id,
        `sb_dep_demo_${shortTag}_03`,
        fifteenMinsFromNow,
        `demo_pay_${shortTag}_03`,
      ],
    );
  }

  // Booking 4: Tomorrow active held slot (Emeka, 10:30) awaiting deposit
  const b4Start = lagosIso(1, '10:30');
  const b4Res = await client.query<{ id: string }>(
    `INSERT INTO bookings (business_id, staff_id, service_id, customer_id, starts_at, ends_at, status, hold_expires_at, source, idempotency_key)
     VALUES ($1, $2, $3, $4, $5, $6, 'held', $7, 'booking_page', $8)
     RETURNING id`,
    [
      businessId,
      stfEmeka,
      svcStandard,
      custDamilola,
      b4Start,
      addMinutesIso(b4Start, 30),
      fifteenMinsFromNow,
      `demo_${shortTag}_b4`,
    ],
  );
  const b4Id = b4Res.rows[0]?.id;
  if (b4Id) {
    await client.query(
      `INSERT INTO payments (business_id, booking_id, kind, amount_kobo, status, kora_reference, kora_account_number, expires_at, idempotency_key)
       VALUES ($1, $2, 'deposit', 100000, 'pending', $3, '9012349901', $4, $5)`,
      [
        businessId,
        b4Id,
        `sb_dep_demo_${shortTag}_04`,
        fifteenMinsFromNow,
        `demo_pay_${shortTag}_04`,
      ],
    );
  }

  // Booking 5: Expired hold from yesterday (Ifeanyi)
  const b5Start = lagosIso(-1, '15:00');
  const b5Res = await client.query<{ id: string }>(
    `INSERT INTO bookings (business_id, staff_id, service_id, customer_id, starts_at, ends_at, status, hold_expires_at, source, idempotency_key)
     VALUES ($1, $2, $3, $4, $5, $6, 'expired', $7, 'whatsapp', $8)
     RETURNING id`,
    [
      businessId,
      stfEmeka,
      svcShave,
      custIfeanyi,
      b5Start,
      addMinutesIso(b5Start, 30),
      tenMinsAgo,
      `demo_${shortTag}_b5`,
    ],
  );
  const b5Id = b5Res.rows[0]?.id;
  if (b5Id) {
    await client.query(
      `INSERT INTO payments (business_id, booking_id, kind, amount_kobo, status, kora_reference, expires_at, idempotency_key)
       VALUES ($1, $2, 'deposit', 100000, 'expired', $3, $4, $5)`,
      [businessId, b5Id, `sb_dep_demo_${shortTag}_05`, tenMinsAgo, `demo_pay_${shortTag}_05`],
    );
  }

  // Booking 6: Cancelled + Refunded (Funmilayo)
  const b6Start = lagosIso(1, '15:00');
  const b6Res = await client.query<{ id: string }>(
    `INSERT INTO bookings (business_id, staff_id, service_id, customer_id, starts_at, ends_at, status, cancel_reason, source, idempotency_key)
     VALUES ($1, $2, $3, $4, $5, $6, 'cancelled', 'Customer requested reschedule next week', 'booking_page', $7)
     RETURNING id`,
    [
      businessId,
      stfTunde,
      svcStandard,
      custFunmi,
      b6Start,
      addMinutesIso(b6Start, 30),
      `demo_${shortTag}_b6`,
    ],
  );
  const b6Id = b6Res.rows[0]?.id;
  if (b6Id) {
    await client.query(
      `INSERT INTO payments (business_id, booking_id, kind, amount_kobo, status, kora_reference, verified_at, idempotency_key)
       VALUES ($1, $2, 'deposit', 100000, 'refunded', $3, NOW(), $4)`,
      [businessId, b6Id, `sb_dep_demo_${shortTag}_06`, `demo_pay_${shortTag}_06`],
    );
  }

  // Booking 7: Tomorrow confirmed no-deposit Low cut (Sadiq, 14:00)
  const b7Start = lagosIso(1, '14:00');
  await client.query(
    `INSERT INTO bookings (business_id, staff_id, service_id, customer_id, starts_at, ends_at, status, source, idempotency_key)
     VALUES ($1, $2, $3, $4, $5, $6, 'confirmed', 'staff', $7)`,
    [
      businessId,
      stfSadiq,
      svcLowCut,
      custChinedu,
      b7Start,
      addMinutesIso(b7Start, 30),
      `demo_${shortTag}_b7`,
    ],
  );

  // 6. Web-chat and simulated WhatsApp transcripts (including needs_human handoff)
  const conv1Res = await client.query<{ id: string }>(
    `INSERT INTO conversations (business_id, customer_id, channel, status, last_message_at)
     VALUES ($1, $2, 'whatsapp', 'needs_human', NOW() - INTERVAL '8 minutes')
     RETURNING id`,
    [businessId, custAdaeze],
  );
  const conv1Id = conv1Res.rows[0]?.id;
  if (conv1Id) {
    await client.query(
      `INSERT INTO messages (conversation_id, direction, author, body, created_at)
       VALUES
         ($1, 'in', 'customer', 'Hi, I transferred the ₦5,000 deposit for my VIP Dreadlocks Retwist but my bank network delayed.', NOW() - INTERVAL '12 minutes'),
         ($1, 'out', 'agent', 'Thanks Adaeze! I see your hold is active and Kora verification is pending. I am flagging this for a barber at Fade Republic to confirm right away.', NOW() - INTERVAL '10 minutes'),
         ($1, 'in', 'customer', 'Thank you, please let Sadiq know I will be there at 11:00 AM.', NOW() - INTERVAL '8 minutes')`,
      [conv1Id],
    );
  }

  const conv2Res = await client.query<{ id: string }>(
    `INSERT INTO conversations (business_id, customer_id, channel, status, last_message_at)
     VALUES ($1, $2, 'web_chat', 'agent', NOW() - INTERVAL '25 minutes')
     RETURNING id`,
    [businessId, custDamilola],
  );
  const conv2Id = conv2Res.rows[0]?.id;
  if (conv2Id) {
    await client.query(
      `INSERT INTO messages (conversation_id, direction, author, body, created_at)
       VALUES
         ($1, 'in', 'customer', 'Hello Maya, do you have a Standard Haircut slot tomorrow morning with Emeka?', NOW() - INTERVAL '28 minutes'),
         ($1, 'out', 'agent', 'Yes! Emeka Okafor is open tomorrow at 10:30 AM WAT. I have placed a 15-minute hold and sent your ₦1,000 Kora deposit details.', NOW() - INTERVAL '25 minutes')`,
      [conv2Id],
    );
  }

  const conv3Res = await client.query<{ id: string }>(
    `INSERT INTO conversations (business_id, customer_id, channel, status, last_message_at)
     VALUES ($1, $2, 'whatsapp', 'closed', NOW() - INTERVAL '1 day')
     RETURNING id`,
    [businessId, custChinedu],
  );
  const conv3Id = conv3Res.rows[0]?.id;
  if (conv3Id) {
    await client.query(
      `INSERT INTO messages (conversation_id, direction, author, body, created_at)
       VALUES
         ($1, 'in', 'customer', 'All set for my fade with Tunde, deposit paid!', NOW() - INTERVAL '1 day'),
         ($1, 'out', 'agent', 'Confirmed! Your Classic Fade & Beard Sculpt with Tunde Adeyemi is locked in.', NOW() - INTERVAL '1 day')`,
      [conv3Id],
    );
  }

  // 7. Seed AI Receptionist config & FAQs into audit_log (matches /api/ai-receptionist)
  await client.query(
    `INSERT INTO audit_log (business_id, actor, action, entity, entity_id, after)
     VALUES ($1, 'system', 'ai_receptionist.seeded', 'ai_receptionist_config', $2, $3)`,
    [
      businessId,
      businessId,
      JSON.stringify({
        primaryLanguage: 'English',
        shortIntro:
          'AI Booking Receptionist for Fade Republic Barbershop — answers pricing questions, holds real slots, and guides Kora deposits.',
        handoffMessage:
          "I'll pass this straight to our Lead Barber on duty so they can assist you.",
        escalationContact: '+234 803 123 4567',
        faqs: DEMO_FAQS,
        capabilities: DEFAULT_CAPABILITIES,
      }),
    ],
  );
}

/**
 * Ensures an isolated demo business exists for `demoSessionId` and returns its id + slug.
 * When `forceReset` is true, deletes and re-seeds only that demo business's records.
 */
export async function ensureDemoWorkspace(
  pool: Pool,
  demoSessionId: string,
  forceReset = false,
): Promise<{ id: string; slug: string; name: string }> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existingRes = await client.query<{ id: string; slug: string; name: string }>(
      `SELECT id, slug, name
       FROM businesses
       WHERE is_demo = true AND demo_session_id = $1
       LIMIT 1`,
      [demoSessionId],
    );

    let business = existingRes.rows[0];

    if (!business) {
      const slug = `demo-fade-republic-${demoSessionId.replace(/-/g, '').slice(0, 8)}`;
      const insertRes = await client.query<{ id: string; slug: string; name: string }>(
        `INSERT INTO businesses (
           id, owner_user_id, name, slug, vertical, phone, location, country, timezone,
           website, self_provided, schedule, advance_days, allow_same_day,
           deposit_required, deposit_type, default_deposit_kobo, free_cancel_hours,
           merchant_bears_cost, cancellation_policy, kora_status, assistant_name,
           greeting, tone, capabilities, onboarding_completed,
           whatsapp_phone_number_id, plan, agent_enabled, is_demo, demo_session_id
         ) VALUES (
           $1, NULL, 'Fade Republic Barbershop', $2, 'barber',
           '+234 803 123 4567', 'KM 10 Idiroko Road, Ota, Ogun State', 'Nigeria (NG)', 'Africa/Lagos',
           'https://faderepublic.ng', false, $3, 14, true,
           true, 'fixed', 150000, 4,
           false, 'Full refund if cancelled at least 4 hours before your scheduled slot.',
           'ready', 'Maya',
           'Hi! Welcome to Fade Republic Barbershop. I''m Maya, your AI booking receptionist. Which cut or barber would you like to book today?',
           'Friendly', $4, true,
           NULL, 'pro', true, true, $5
         )
         RETURNING id, slug, name`,
        [
          randomUUID(),
          slug,
          JSON.stringify(DEFAULT_SCHEDULE),
          JSON.stringify(DEFAULT_CAPABILITIES),
          demoSessionId,
        ],
      );
      business = insertRes.rows[0];
      if (!business) {
        throw new Error('Failed to create isolated demo business.');
      }
      await populateDemoBusiness(client, business.id, demoSessionId);
    } else if (forceReset) {
      await clearDemoBusinessData(client, business.id);
      await populateDemoBusiness(client, business.id, demoSessionId);
    }

    await client.query('COMMIT');
    return business;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
