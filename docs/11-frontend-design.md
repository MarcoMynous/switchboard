# SWITCHBOARD — DESIGN SYSTEM

**Version:** 1.0  
**Design direction:** Premium Hybrid  
**Platform:** Responsive Web SaaS  
**Product:** Multi-industry AI Business Operations Platform

## 1. Product Identity

Switchboard is an AI-powered business operations platform that allows businesses to deploy intelligent assistants capable of handling customer conversations and completing approved business tasks.

The user experience must communicate three qualities:

- **Intelligence:** Advanced AI technology made approachable.
- **Reliability:** Clear execution outcomes, human oversight, and trustworthy interactions.
- **Simplicity:** Complex operations presented through intuitive workflows.

Brand personality: Modern, confident, sophisticated, helpful, intelligent, and trustworthy.

Avoid generic chatbot branding, excessive gradients, neon overload, futuristic clutter, and unnecessarily complicated interfaces.

## 2. Visual Strategy

Use the **Premium Hybrid** visual approach.

### Public Website

- Dark cinematic hero and premium editorial typography.
- Deep midnight surfaces with restrained indigo lighting.
- Product-focused visuals rather than excessive illustrations.
- Sophisticated transitions and micro-interactions.
- Alternating light and dark sections where appropriate.
- Clear primary calls to action.
- Spacious layouts and strong visual hierarchy.

### Auth and Onboarding

- Clean, minimal interfaces.
- Light backgrounds with restrained brand accents.
- Clear forms and validation feedback.
- Guided progress indicators.
- Consistent step-by-step navigation.
- Strong mobile responsiveness.

### Business Dashboard

- Light-first professional SaaS interface.
- Persistent sidebar on desktop.
- Compact mobile navigation.
- Cards, tables, activity timelines, and structured forms.
- Clear statuses and action priorities.
- Accessible typography and generous spacing.

### Voice Testing Studio

- Dedicated immersive dark surface.
- Voice visualization and conversation transcript.
- Session status and execution activity.
- Clear distinction between successful, failed, pending, and uncertain actions.

## 3. Color Palette

### Brand Colors

| Token | Value | Purpose |
|---|---|---|
| Midnight | `#101827` | Dark backgrounds, hero sections, and projector Chaos Dashboard |
| Canvas | `#F7F8FB` | App and dashboard page backgrounds |
| Surface | `#FFFFFF` | Cards, dialogs, forms, slot tiles |
| Iris | `#6258E8` | Brand primary, CTA buttons, and **confirmed** slot state |
| Iris Light | `#A5B4FC` | Dark-surface accents and waveform/activity highlights |
| Success | `#10B981` | Confirmed positive states, paid toasts, money dashboard positives. **Fills, dots and tints only**: 2.5:1 on white, never text |
| Success strong | `#047857` (light) / `#34D399` (dark) | Success-coloured **text** (`text-success-strong`) |
| Warning | `#F59E0B` | **Held** slot state, countdown hold band, and non-blocking warnings |
| Warning text | `#92400E` | Held/warning **text** on amber tints (`#B45309` was 4.2:1 on `bg-[#F59E0B]/15`, failed AA) |
| Iris text on tints | `#5247D8` | Iris-coloured text on iris tints (`#6258E8` is 4.2–4.5:1 there) |
| Danger | `#EF4444` | Errors, no-shows, and destructive operations |
| Slate | `#5B6577` | Secondary information and free slot outlines (was `#64748B`: 4.1:1 on surface-container, failed AA) |
| Border | `#E5E7EB` | Light-surface borders |

### Typography Colors

- Primary on light: `#111827`
- Secondary on light: `#5B6577` (`text-text-secondary`)
- Primary on dark: `#F8FAFC`
- Secondary on dark: `#B4BCCB` (automatic, see below) or `#CBD5E1`

Every color pairing must meet accessible contrast requirements (WCAG AA, 4.5:1 for body text). The Playwright axe smoke test (`apps/web/e2e/smoke.spec.ts`) enforces this on public pages.

**Dark sections switch text tokens automatically.** `globals.css` overrides `--color-success-strong` and `--color-text-secondary` inside any element with `bg-midnight-hero` or `bg-[#181F63]`, so `text-success-strong` and `text-text-secondary` stay readable on both light and dark. Add a new dark background class to that selector. Prefer these tokens over raw Tailwind greys like `text-slate-500` (4.3:1 on surface-container, fails).

The primary indigo may need a darker hover or text variant to maintain sufficient contrast.

## 4. Typography

Primary font: **Geist Sans**

Secondary fallback: **Inter**

Technical / monospace font: **Geist Mono**

### Suggested Desktop Scale

- Display heading: 64–76px
- H1: 48–60px
- H2: 36–44px
- H3: 24–30px
- Body large: 18–20px
- Body standard: 16px
- Supporting text: 14px
- Metadata: 12–13px

### Mobile Scale

- Display heading: 38–44px
- H1: 32–38px
- H2: 26–30px
- H3: 21–24px
- Body: 15–16px

Use clear hierarchy, balanced line lengths, and natural wrapping.

Avoid excessive uppercase text and tiny interface labels.

## 5. Layout System

Use an 8px-based spacing rhythm with 4px intermediate increments.

### Desktop

- Main marketing container: maximum 1280px.
- Dashboard: responsive fluid content.
- Desktop dashboard sidebar: approximately 240–260px.
- Maximum reading width for long paragraphs: 680–760px.
- Section spacing: 88–120px.
- Grid layouts: 12-column where helpful.

### Tablet

- Breakpoints around 768–1023px.
- Reduce horizontal spacing.
- Collapse nonessential sidebar elements.
- Convert wide three-column layouts to two columns.

### Mobile

- Below 768px.
- Single-column layouts by default.
- 20–24px horizontal page padding.
- Comfortable touch targets, ideally at least 44px.
- Avoid horizontal scrolling in primary business workflows.
- Stack product illustrations beneath important copy.

## 6. Component System

Create reusable UI components for:

- Buttons: primary, secondary, outline, destructive, text.
- Inputs, selectors, textareas, checkboxes, and radio controls.
- Cards, badges, tooltips, dialogs, drawers, and dropdowns.
- Tabs, breadcrumbs, steppers, and navigation.
- Tables, lists, filters, and pagination.
- Status indicators and activity timelines.
- Empty states, errors, loading skeletons, and confirmations.
- Assistant cards and capability cards.
- Conversation messages, voice controls, and execution traces.
- Usage meters and billing summaries.

All interactive components must include hover, focus, active, disabled, loading, and error states as applicable.

## 7. Motion and Interactions

Use subtle animations to communicate state and quality.

- Standard UI transition: 150–250ms.
- Section reveal: 350–550ms.
- Buttons: subtle color or elevation transitions.
- Cards: restrained hover responses.
- Voice waveform: animate only when actual activity exists.
- Page transitions: minimal and non-disruptive.
- Honor `prefers-reduced-motion`.

Avoid unnecessary parallax, animation-heavy dashboards, and distracting effects.

## 8. Landing Page Design

The landing page should feel like a premium, modern technology company.

Required sections:

1. Navigation bar.
2. Hero with headline, subheading, CTA, and product preview.
3. Trust and product-value introduction.
4. Interactive product demonstration.
5. Core capabilities.
6. How Switchboard works.
7. Industry use cases.
8. AI-to-action workflow with Kora payments.
9. Reliability, security, and human oversight.
10. Pricing preview.
11. FAQ.
12. Final CTA and footer.

### Hero

Headline concept:

**Your business never stops. Neither should your front desk.**

Supporting text:

Switchboard gives your business AI assistants that answer customers, manage bookings, capture leads, and complete approved tasks—without losing the human touch.

Primary CTA: **Get started**

Secondary CTA: **See how it works**

The product preview should demonstrate a conversation progressing into a verified business action.

## 9. Authentication and Onboarding

Authentication screens should be minimal and distraction-free.

Provide:

- Signup and signin.
- Email verification.
- Password recovery or suitable passwordless authentication.
- Error and loading states.

Onboarding follows a guided sequence:

1. Business details.
2. Business knowledge.
3. Assistant identity.
4. Capabilities and permissions.
5. Test and activation.

Advanced settings remain optional during initial onboarding.

## 10. Dashboard Information Architecture

Primary navigation:

- Overview
- AI Assistants
- Conversations
- Customers
- Needs Attention
- Business Modules
- Analytics
- Integrations
- Team & Permissions
- Usage & Billing
- Settings

Desktop uses grouped sidebar navigation.

Mobile prioritizes Home, Conversations, Assistants, Attention, and More.

## 11. Assistant Builder

Use a guided assistant creation process with advanced configuration available separately.

Assistant configuration includes:

- Identity and role.
- Knowledge sources.
- Voice and personality.
- Capabilities.
- Execution permissions.
- Escalation rules.
- Testing.
- Publishing and versions.

Each assistant belongs to a workspace.

Draft and published versions must remain distinct.

## 12. Testing and Publishing

Provide a dedicated Test & Publish studio.

Include:

- Text and voice testing.
- Simulated business actions.
- Execution traces.
- Readiness checks.
- Blocking and non-blocking warnings.
- Version comparison.
- Publish confirmation.
- Deployment history.
- Rollback controls.

Never visually represent an unverified action as successfully completed.

## 13. Status and Feedback

Use explicit outcome categories:

- Completed
- In progress
- Pending confirmation
- Needs attention
- Failed
- Unknown / Requires reconciliation

Critical financial and booking states must never be inferred from the visual interface alone.

## 14. Accessibility

- WCAG 2.2 AA design target.
- Keyboard-accessible controls.
- Visible focus states.
- Accessible contrast.
- Form labels and error descriptions.
- Screen-reader-compatible navigation.
- Respect reduced-motion preferences.
- Avoid color-only status communication.

## 15. Design Principles

1. Product clarity over decoration.
2. Business outcomes over AI novelty.
3. Reliable execution over unrealistic promises.
4. Progressive disclosure over crowded screens.
5. Consistency across multiple industries.
6. Mobile usability from the beginning.
7. Premium experience without sacrificing accessibility.

## 16. Booking, Hold Band, and Chaos Layouts

### The Hold Band
A held slot carries a **Warning (`#F59E0B`) band that drains** left-to-right over its 15-minute hold window. When payment verifies, the band floods **Iris (`#6258E8`)** (with **Success (`#10B981`)** status badge) and the slot locks as confirmed (300ms transition). The same element appears on:
- The customer's deposit card in chat and on `/b/[slug]`
- The owner's day calendar tiles
- Every slot tile on the `/chaos` projector dashboard (on **Midnight `#101827`** surface)

### Key Layouts
- **Public booking page (`/b/[slug]`):** Mobile-first on **Canvas (`#F7F8FB`)** with **Surface (`#FFFFFF`)** cards and **Border (`#E5E7EB`)** — business header → service rows → day strip & time chips → hold band + Kora bank-transfer deposit card.
- **Owner dashboard day view:** Staff as columns, time down the left, bookings as tiles with hold bands; right-side inbox with `needs_human` conversations pinned on top.
- **Chaos dashboard (`/chaos`):** **Midnight (`#101827`)** dark mode for projector contrast — 10 large slot tiles in a row, live bot activity log underneath, and 5 invariant counters with pass (`#10B981`) / fail (`#EF4444`).

### Copy & Performance Rules (Lighthouse ≥ 95)
- **Copy:** Sentence case everywhere, active verbs ("Hold this time", "Copy account number", "Reply as staff", "Refund deposit" — never "Submit").
- **Performance:** Public booking page is a Server Component (only the time-chip picker and deposit card are client components); self-hosted fonts via `next/font`; `prefers-reduced-motion` disables continuous animations; visible 2px **Iris (`#6258E8`)** focus ring on all interactive elements.

## 17. Design Implementation Rules

Use this document as the primary design reference for all pages.

Do not introduce arbitrary colors, fonts, shadows, spacing systems, or navigation patterns.

Maintain a single reusable component system.

Every page must include desktop and mobile designs.

Design all relevant empty, loading, error, and success states.

Marketing demonstrations must be clearly identified when they use simulated data.

Future pages should follow the same design tokens and visual hierarchy.
