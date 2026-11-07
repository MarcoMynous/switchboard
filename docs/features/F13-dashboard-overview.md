# F13 — Dashboard Overview Redesign Specification

**Phase:** P4 · **Owner:** B (UI), A (API)

**Story:** As a business owner who just completed onboarding (or is running daily operations), I land on a truthful, booking-first Switchboard dashboard that reflects my real persisted setup, channel readiness, bookings, Kora deposits, and conversations needing human attention.

---

## 1. Scope & Product Alignment

Switchboard supports:
- **WhatsApp** via Meta Cloud API.
- **Web text chat** widget.
- **Public booking pages** at `/b/[slug]`.
- **Phone-first customer identity** (`E.164`).
- **Staff and service availability** with Postgres `EXCLUDE USING gist` overlap prevention (Invariant I1).
- **15-minute temporary booking holds** with Kora bank-transfer/card deposits.
- **Backend-verified booking confirmations** via Kora webhook + transaction query re-verification (Invariant I2).
- **Inngest background workflows** (hold expiry, reminders, reconciliation).
- **Human escalation** (`needs_human` inbox takeover and hand-back).

**Out of scope (must never appear in UI copy):** Browser voice calling, Vonage/RingCentral/Twilio telephony forwarding, HIPAA/clinical workflows, or generic LLM model selection.

---

## 2. Persistent Dashboard Shell

- **Fixed Left Sidebar (`248px` on desktop, slide-over drawer on mobile)**:
  - Stays mounted across all dashboard views.
  - Displays the active business workspace selector (`Fade Republic`), grouped navigation, system health pill, and authenticated owner profile.
- **Primary Navigation Destinations**:
  - **Workspace**: `Overview`, `Bookings`, `Conversations`, `Customers`, `Needs Attention`
  - **Operations**: `AI Receptionist`, `Services & Staff`, `Working Hours`, `Payments`, `Integrations`, `Analytics`
  - **Administration**: `Team & Permissions`, `Usage & Billing`, `Settings`
- **Fixed Top Header (`h-16`)**:
  - Breadcrumb (`Switchboard` › current section), operational status pill, public booking link quick-copy chip (`/b/[slug]`), Docs link, Notifications, and Owner avatar.

---

## 3. New Workspace Overview (Post-Onboarding)

1. **Personalized Welcome Header**:
   - Displays business name, `Africa/Lagos (WAT)` timezone, vertical badge, and booking-first subtitle.
2. **Dynamic Setup Completion Checklist**:
   - Completion count and percentage are **computed dynamically** from persisted business data (never hardcoded):
     1. *Business Workspace Created* (name, slug, category, timezone persisted)
     2. *Services & Staff Configured* (at least 1 bookable service in ₦ and assigned staff/solo provider)
     3. *Working Hours & Deposit Rules Set* (weekly open hours and 15-minute Kora deposit policy configured)
     4. *AI Receptionist Configured* (assistant name, greeting, and capabilities enabled)
     5. *First Booking or Channel Connected* (test/walk-in booking created or WhatsApp paired)
3. **Workspace Identity & Correctness Card**:
   - Midnight visual card displaying business name, category, `Africa/Lagos` timezone, `15m Hold • Kora` protocol, and assistant status (`Maya`).
   - Correctness Guarantee card explaining Invariants I1–I5 (verified Kora confirmation before slot lock).
4. **Honest Zero-State Cards (3-Column Grid)**:
   - **Conversations Empty State**: `0 Active Threads` with action to test web chat.
   - **Bookings Empty State**: `0 Confirmed Today` with public booking link `/b/[slug]` and copy action.
   - **Payments Empty State**: `₦0 Verified` showing configured deposit amount and Kora verification readiness.
5. **Booking-First Launch Resources**:
   - Guides for connecting Meta WhatsApp Cloud API, understanding 15-minute Kora deposit holds/refunds, and sharing `/b/[slug]` on Instagram & WhatsApp.

---

## 4. Active Business Overview

When bookings, conversations, or payment events exist:
1. **Scoped KPI Strip (with explicit date range, e.g. Today / Last 30 Days)**:
   - **Confirmed Bookings** (strictly `status === 'confirmed'`; `held` bookings are shown separately and never counted as confirmed per Invariant I5).
   - **Verified Deposit Totals** (strictly verified Kora charges in integer kobo formatted to `₦`; `pending_verification` shown separately per Invariant I7).
   - **Customer Conversations** (active WhatsApp & web chat threads).
   - **Needs Attention Count** (`needs_human` escalations & payment exceptions).
2. **Upcoming Bookings & Hold Band**:
   - Displays confirmed slots and any active 15-minute held slots with the amber draining Hold Band.
3. **Recent Booking & Payment Activity + Exceptions**:
   - Shows verified deposits, expired holds, or `pending_verification` items requiring reconciliation.
