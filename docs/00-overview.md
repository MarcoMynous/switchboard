# 00 — Overview

## The problem

Nigerian salons and barbers lose money in two ways every week:

1. **Missed inquiries.** Customers DM on WhatsApp at 10pm or while the owner has clippers in hand. No reply → they go elsewhere.
2. **No-shows.** A customer "books" Saturday 2pm by chat, the barber turns away a walk-in, and the customer never arrives. There's no deposit because collecting one manually (send account number, wait, check bank app, reply) is too much friction.

## The product

Switchboard is a booking agent that sits on the business's WhatsApp and website:

1. Customer: "Can I get a low cut Saturday afternoon?"
2. Agent checks **real** availability for that service/staff and offers times.
3. Customer picks one → slot is **held for 15 minutes**.
4. Agent sends a **one-time Kora bank-transfer account** for the deposit.
5. Kora webhook arrives → we **re-verify with Kora** → slot is **confirmed** → customer gets confirmation + reminders.
6. No payment in time → hold expires → slot is free again.
7. Business cancels → deposit **refunded via Kora**. Anything unclear → handed to a human in the **staff inbox**.

The promise is not "a chatbot". It's **a verified business outcome**: a confirmed, paid-for appointment — or an honest "not yet".

## Who it's for

- **Wedge:** salons and barbers (Ota / Lagos first). Worst no-show pain, deposits already culturally normal.
- **Templates (shown in demo, same engine):** auto service, property viewings, clinics (non-clinical scheduling).

## Locked decisions (Nov 3, 2026)

| Area | Decision |
|------|----------|
| Name | Switchboard (working title; domain/trademark check later) |
| Channels | WhatsApp (Meta Cloud API test number) + web chat |
| Vertical | Engine works for any vertical; demo + pitch on salons/barbers |
| Kora usage | Booking deposits · refunds · payouts to business · Switchboard subscription billing (Checkout) |
| Deposit policy | Configurable per service: fixed ₦ or %, free-cancel window, deposit counts toward bill |
| Backend | TypeScript only. Hono API + Next.js web in a Turborepo monorepo |
| LLM | Provider-agnostic via Vercel AI SDK |
| Hosting | Both apps on Vercel (one project, `services` for web + api). Neon Postgres. Inngest Cloud |
| Deploy control | GitHub Actions gates everything: CI → migrate → deploy → Lighthouse |
| Preview DB | Neon branch per PR, deleted on close |
| Local | Docker for everything, including a mock Kora server |
| Pilot | Simulated business ("Fade Republic, Ota") with seeded data |
| Business model | Free tier → monthly per-location subscription + small fee per processed deposit |
| Showcase | Chaos dashboard (100 bots vs 10 slots + hostile webhooks) + live WhatsApp booking on stage |
| Scope | Full feature set, no cuts. Build order in `docs/phases/` |

## Business model (pitch numbers — hypotheses)

| Tier | Price | Includes |
|------|-------|----------|
| Starter | Free | Web booking page, 30 agent conversations/month, deposits |
| Pro | ₦15,000 / location / month | WhatsApp agent, unlimited staff, reminders, CRM |
| Fee on deposits | ~1.5% or ₦50 cap (TBD) | On every deposit processed through Switchboard |

**Unit economics to show:** one prevented no-show on a ₦8,000 service pays for half a month of Pro.

## Judging criteria → how we score

| Criterion | Our answer |
|-----------|-----------|
| Posting consistency | 2+ posts/week each, plan in `13-pitch-and-build-in-public.md` |
| Visible progress | Phase demos posted as short clips |
| Working demo | Live WhatsApp booking on stage + chaos dashboard |
| Real-problem clarity | No-show cost story + 3 owner quotes (collect even without a pilot) |
| Kora integration (bonus) | Four Kora products used, webhook-verified, chaos-tested |

## Out of scope

Real phone/voice calls · native mobile apps · multi-location chains · POS · clinical/medical data · production payouts licensing (pitch-only answer: partner with a licensed collection/settlement model).
