# F01 — Business onboarding

**Phase:** P1 · **Owner:** B (UI), A (API)

**Story:** As a salon or appointment business owner in Nigeria, I set up my business in under 5 minutes so customers can book via web or WhatsApp today with Kora deposits.

---

## 1. Overall layout and architecture

The onboarding is built as a **single persistent shell** (`<OnboardingLayout>`) centered on screen (max width ~1120px) with responsive elevation and borders matching the Switchboard design tokens:

- **Left Sidebar (35% on desktop)**:
  - Header: Switchboard logo + "Workspace Setup".
  - Section title: "ONBOARDING WIZARD" / "Get Started" ("Configure your appointment engine in 6 quick stages.").
  - Vertical connected timeline steps 01 through 06 with progress markers (completed checkmarks, active indicator, upcoming numbers).
  - Footer: "Switchboard Engine • Live".
  - On mobile screens (<1024px), collapses gracefully into a compact horizontal progress tracker.
- **Right Panel (65% on desktop)**:
  - Header: Step counter (`Step 0X of 06`), live sync status (`Draft Saved` / `Saving...`), title, and supporting subtitle.
  - Form Content: Dynamically renders the active step while retaining all answers in a persistent shared form draft state (`localStorage` + API auto-save). Unmounting fields or navigating back/forward never loses user inputs.
  - Persistent Bottom Navigation: Fixed footer containing `Back`, auto-save indicator (`All changes saved`), optional `Skip`, and `Continue ->` buttons.
- **Strict Invariant**: No mock state switcher bars or simulation toolbars in production code. All states reflect genuine user inputs and backend verification.

---

## 2. Six-Step Flow Specification

### Step 1: Your Business
- **Sidebar Label:** `01 Your Business` (Business identity and contact details)
- **Heading:** "Tell us about your business"
- **Supporting text:** "Provide foundational information so your AI assistant knows who it represents and how to handle customer inquiries accurately."
- **Fields:**
  - **Official Business Name** (text, required)
  - **Business Category** (interactive selection cards, required):
    - *Salon & Barbershop* (default MVP target)
    - *Beauty & Wellness*
    - *Auto Services*
    - *Property Viewings*
    - *Other Appointment Services*
    *(Note: Medical/clinical workflows are intentionally excluded from MVP scope).*
  - **Business Phone Number** (phone input, default `+234`, required)
  - **Physical Address & State** (text, e.g., "Fade Republic, Ota, Ogun State", optional)
  - **Country of Registry** (dropdown, default `Nigeria (NG)`, required)
  - **Operating Timezone** (dropdown, default `Africa/Lagos (GMT+1)`, required per system time conventions)
  - **Primary Web Domain / Social URL** (URL text, optional)
  - **Brief Description** (textarea, optional)

### Step 2: Services & Staff
- **Sidebar Label:** `02 Services & Staff` (What customers can book)
- **Heading:** "What services do you offer?"
- **Supporting text:** "Add the services customers can book and the team members who provide them."
- **Services Section:**
  - Dynamic service cards pre-seeded according to the industry chosen in Step 1.
  - Per service: Service name (required), duration dropdown (15, 30, 45, 60, 90, 120 mins), price in Naira (`₦`, stored as integer kobo per Invariant I6), brief description, and assigned staff member(s).
  - "Add another service" action.
- **Staff Section:**
  - Bookable resource roster (staff members are appointment resources, not necessarily dashboard accounts).
  - "I provide services myself" one-click toggle or individual staff entries with name and handled services.
  - "Add staff member" action.

### Step 3: Working Hours
- **Sidebar Label:** `03 Working Hours` (Your appointment availability)
- **Heading:** "When are you available?"
- **Supporting text:** "Set the weekly schedule and booking rules for your business."
- **Fields:**
  - Monday through Sunday day rows with active toggle, opening time, and closing time.
  - Quick action shortcuts: "Apply to all weekdays" and "Copy hours to Saturday".
  - Advance booking window (e.g., "Up to 14 days in advance", "Up to 30 days").
  - Same-day booking allowance toggle.

### Step 4: Booking & Deposits
- **Sidebar Label:** `04 Booking & Deposits` (Booking rules & Kora deposits)
- **Heading:** "How should appointments be confirmed?"
- **Supporting text:** "Choose how customers reserve appointments and configure deposit collection to prevent no-shows."
- **Deposit Policy:**
  - "Require customer deposit?" toggle (Yes / No, defaults to Yes).
  - Deposit type (Fixed amount in ₦ / Percentage).
  - Deposit amount (e.g. ₦1,500).
- **Core Correctness Callout (Invariants I1, I2, I7):**
  > "Customers get a temporary 15-minute slot hold. A deposit-required booking is confirmed only after Kora independently verifies the payment via webhook and transaction query."
- **Integration Status:**
  - Kora checkout readiness badge (Connected in test/production mode).
- **Cancellation Policy & Escalation Contact:**
  - Brief customer cancellation terms and staff contact for payment disputes.

### Step 5: AI Receptionist
- **Sidebar Label:** `05 AI Receptionist` (Customer messages & AI behavior)
- **Heading:** "Meet your AI receptionist"
- **Supporting text:** "Customize how Switchboard greets your customers and handles common inquiries on WhatsApp and web chat."
- **Fields:**
  - **Assistant Name** (text, default "Maya")
  - **Welcome Greeting** (textarea, personalized to business name and category)
  - **Operating Language** (dropdown, English [default], Nigerian Pidgin)
  - **Conversation Tone** (Friendly [default] / Professional / Casual)
  - **Common FAQs** (dynamic Q&A items, e.g. "Do you take walk-ins?", "Where can I park?")
  - **Escalation Staff Member** (select staff to notify when AI encounters an unhandled request)
  - **Channel Status**: Web Chat (Enabled by default), WhatsApp (Dashboard connection ready).

### Step 6: Review & Activate
- **Sidebar Label:** `06 Review & Activate` (Verify setup and launch)
- **Heading:** "Your business is almost ready"
- **Supporting text:** "Review your workspace configuration, verify readiness, and launch your booking engine."
- **Summary Cards (with direct "Edit" navigation):**
  1. *Business Profile* (Name, category, address, phone, timezone)
  2. *Services & Staff* (Total services, staff members)
  3. *Working Hours* (Active days and booking window)
  4. *Booking & Deposits* (Deposit policy, 15m hold rule, Kora status)
  5. *AI Receptionist* (Assistant name, tone, escalation contact)
  6. *Channel Readiness* (Web chat widget active, WhatsApp ready to pair)
- **System Readiness Checklist:**
  - [x] Business profile complete
  - [x] At least 1 active bookable service
  - [x] Staff member assigned to service
  - [x] Weekly working hours configured
  - [x] Invariant I1/I2 slot hold & deposit policy active
  - [x] AI receptionist personality configured
- **Actions:**
  - **Test Booking**: Launches a non-destructive modal simulating customer booking with 15-minute hold timer.
  - **Finish & Go to Dashboard**: Saves all settings and navigates to `/dashboard`.
  - **Activate Workspace**: Primary launch CTA that completes onboarding and opens the live booking link.

---

## 3. Acceptance Criteria

- [ ] Persistent layout: Sidebar and content container stay mounted; transitioning steps does not reload the page or flash layout jumps.
- [ ] Preserves all draft data when switching back and forth between steps or refreshing the browser.
- [ ] Changing Business Category in Step 1 updates recommended service presets for Step 2.
- [ ] All monetary values formatted in Naira (`₦`) and converted to kobo for backend persistence (Invariant I6).
- [ ] Explains the 15-minute slot hold and Kora verification flow (Invariants I1, I2).
- [ ] No mock preview switcher toolbars or artificial state buttons rendered.
- [ ] Playwright e2e test covers wizard navigation through step 6.
