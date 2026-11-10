import Image from 'next/image';
import Link from 'next/link';
import { AppIcon } from '@/components/AppIcon';
import { ScrollFloat } from '@/components/ScrollFloat';
import { ScrollReveal } from '@/components/ScrollReveal';
import { SwitchboardLogo } from '@/components/SwitchboardLogo';

export default function Home() {
  return (
    <div className="min-h-screen bg-background font-body-md text-body-md text-on-surface antialiased">
      {/* HEADER */}
      <header className="fixed top-0 z-50 w-full bg-midnight-hero/90 shadow-[0_1px_12px_rgba(0,0,0,0.28)] backdrop-blur-xl border-b border-white/10">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-6 lg:px-12">
          <SwitchboardLogo href="/" size="md" theme="dark" />

          <nav aria-label="Main Navigation" className="hidden items-center gap-2 md:flex">
            <a
              href="#product"
              className="rounded-xl bg-primary-container/90 px-3.5 py-1.5 font-label-md text-label-md text-on-primary-container transition-all duration-150 active:scale-95"
            >
              Product
            </a>
            <a
              href="#solutions"
              className="rounded-xl px-3.5 py-1.5 font-label-md text-label-md text-secondary-fixed-dim transition-all duration-150 hover:bg-white/5 hover:text-on-primary active:scale-95"
            >
              Solutions
            </a>
            <a
              href="#how-it-works"
              className="rounded-xl px-3.5 py-1.5 font-label-md text-label-md text-secondary-fixed-dim transition-all duration-150 hover:bg-white/5 hover:text-on-primary active:scale-95"
            >
              How It Works
            </a>
            <a
              href="#pricing"
              className="rounded-xl px-3.5 py-1.5 font-label-md text-label-md text-secondary-fixed-dim transition-all duration-150 hover:bg-white/5 hover:text-on-primary active:scale-95"
            >
              Pricing
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/auth/signin"
              className="hidden rounded-xl px-3.5 py-2 font-label-md text-label-md text-secondary-fixed-dim transition-all duration-150 hover:bg-white/5 hover:text-on-primary active:scale-95 sm:inline-flex"
            >
              Sign In
            </Link>
            <Link
              href="/auth/signup"
              className="inline-flex items-center justify-center rounded-xl bg-linear-to-r from-[#564CE6] to-[#6258E8] px-4 py-2 font-label-md text-label-md text-on-primary shadow-md transition-all duration-200 hover:brightness-110 active:scale-95"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      <main className="min-h-screen w-full bg-background pt-16 overflow-x-hidden">
        <div className="flex w-full flex-col">
          {/* HERO SECTION (Midnight #101827 surface) */}
          <section
            id="product"
            className="scroll-mt-16 relative w-full overflow-hidden bg-midnight-hero px-5 sm:px-8 pb-20 pt-14 sm:pt-18 lg:px-12 lg:pb-24 lg:pt-20 text-on-primary"
          >
            {/* Restrained Iris Ambient Radiance */}
            <div className="pointer-events-none absolute -top-40 left-1/2 h-[500px] w-[850px] -translate-x-1/2 rounded-full bg-primary-container/15 blur-[140px]" />
            <div className="pointer-events-none absolute -right-40 top-1/2 h-[450px] w-[550px] rounded-full bg-primary/10 blur-[160px]" />

            <div className="relative mx-auto flex max-w-7xl flex-col items-center text-center">
              {/* Eyebrow Badge */}
              <ScrollReveal yOffset={16} duration={0.7} delay={0.1}>
                <div className="mb-6 sm:mb-8 inline-flex items-center gap-2.5 rounded-full border border-surface/10 bg-surface/5 px-3.5 py-1.5 backdrop-blur-md">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-iris-light opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-primary-container" />
                  </span>
                  <span className="font-label-md text-label-md uppercase tracking-wider text-iris-light">
                    Meet Your New AI Front Desk
                  </span>
                </div>
              </ScrollReveal>

              {/* Hero Headline with ScrollFloat */}
              <div className="mb-6 max-w-4xl xl:max-w-5xl px-2">
                <ScrollFloat
                  as="h1"
                  effect="float"
                  splitBy="words"
                  distance={28}
                  stretch={1.06}
                  animationDuration={0.75}
                  ease="power2.out"
                  scrollStart="top 95%"
                  scrollEnd="center 50%"
                  smoothing={0}
                  containerClassName="my-0"
                  textClassName="font-display-hero text-display-hero-mobile tracking-tight text-on-primary lg:text-display-hero inline-block leading-[1.14] pb-1"
                >
                  Your business never stops. Neither should your front desk.
                </ScrollFloat>
              </div>

              {/* Subcopy */}
              <ScrollReveal delay={0.35} duration={1.0} yOffset={24}>
                <p className="mb-10 max-w-2xl text-balance font-body-lg text-body-lg text-secondary-fixed-dim">
                  Switchboard gives your business AI assistants that answer customers, manage
                  bookings, capture leads, and complete approved tasks—without losing the human
                  touch.
                </p>
              </ScrollReveal>

              {/* CTAs */}
              <ScrollReveal delay={0.5} duration={1.0} yOffset={20}>
                <div className="z-10 mb-16 flex flex-col items-center gap-4 sm:flex-row">
                  <Link
                    href="/auth/signup"
                    className="inline-flex w-full items-center justify-center gap-2 rounded bg-primary-container px-6 py-3.5 font-label-md text-label-md text-on-primary shadow-lg shadow-primary-container/20 transition-all hover:bg-primary sm:w-auto"
                  >
                    <span>Get started</span>
                    <AppIcon name="arrow_forward" className="text-[18px]" />
                  </Link>
                  <a
                    href="#how-it-works"
                    className="inline-flex w-full items-center justify-center gap-2 rounded border border-surface/10 bg-surface/5 px-6 py-3.5 font-label-md text-label-md text-on-primary backdrop-blur-sm transition-all hover:bg-surface/10 sm:w-auto"
                  >
                    <AppIcon name="play_circle" className="text-[18px]" />
                    <span>See how it works</span>
                  </a>
                </div>
              </ScrollReveal>

              {/* HERO PRODUCT VISUAL: High-Fidelity Console Artifact */}
              <ScrollReveal delay={0.65} duration={1.1} yOffset={36} scale={0.98}>
                <div className="relative w-full max-w-5xl rounded-xl border border-surface/10 bg-surface/5 p-2 text-left shadow-2xl backdrop-blur-2xl sm:p-4">
                  {/* Console Window Header */}
                  <div className="flex items-center justify-between rounded-t-lg border-b border-surface/10 bg-midnight-hero/80 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1.5" aria-hidden="true">
                        <div className="h-2.5 w-2.5 rounded-full bg-error/60" />
                        <div className="h-2.5 w-2.5 rounded-full bg-tertiary-fixed-dim/60" />
                        <div className="h-2.5 w-2.5 rounded-full bg-success/60" />
                      </div>
                      <div className="mx-1 h-4 w-[1px] bg-surface/10" />
                      <span className="flex items-center gap-1.5 font-label-sm text-label-sm text-secondary-fixed-dim">
                        <AppIcon name="graphic_eq" className="text-[14px] text-iris-light" />
                        Voice Line #4 — Incoming Dispatch Node (SIP TLS Secured)
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2.5 py-0.5 font-metric-sm text-metric-sm text-success">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" /> LIVE
                        SESSION
                      </span>
                      <span className="font-metric-sm text-metric-sm text-secondary-fixed-dim">
                        01:42
                      </span>
                    </div>
                  </div>

                  {/* Inner Grid */}
                  <div className="grid grid-cols-1 gap-4 rounded-b-lg bg-midnight-hero/40 p-4 lg:grid-cols-12">
                    {/* Left 7 cols: Audio State & Live Conversation */}
                    <div className="flex flex-col gap-4 lg:col-span-7">
                      {/* Voice State Card */}
                      <div className="rounded-lg border border-surface/10 bg-surface/5 p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="relative h-10 w-10 rounded-full bg-gradient-to-tr from-primary to-iris-light p-0.5">
                              <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-midnight-hero">
                                <Image
                                  className="h-full w-full object-cover"
                                  alt="Maya, AI avatar receptionist with intelligent expression"
                                  width={40}
                                  height={40}
                                  unoptimized
                                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuCU2ehdytgnfkUjvi71-i0T2ob2G-OKJms8DSfhnOzIYtgidirrarKwcZHuEGASIhC2QTsVIvMk6gazAZc3uk3sLl6YWz1QhGo7jUD74cCsu9faU3nUiGUNk3NeqZMwX-mkJnJ5Z_06K7vrSCiGm_c9gPVW2uAQr0jJRxO9LdBgO_ycOdaXKecv9Vk-C62XBfb-E06qYxwRI9QM-n966uPd7XDuG6yCTMbDCa2pYhU"
                                />
                              </div>
                              <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-midnight-hero bg-success" />
                            </div>
                            <div>
                              <h2 className="font-headline-sm text-headline-sm leading-none text-on-primary">
                                Maya
                              </h2>
                              <p className="mt-0.5 font-label-sm text-label-sm text-iris-light">
                                Front Desk Lead • Autonomous Agent
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 rounded border border-surface/10 bg-surface/5 px-2.5 py-1">
                            <AppIcon name="volume_up" className="text-[16px] text-iris-light" />
                            <span className="font-metric-sm text-metric-sm text-secondary-fixed-dim">
                              Neural Voice (ElevenLabs Ultra)
                            </span>
                          </div>
                        </div>

                        {/* Animated Audio Waveform */}
                        <div className="flex items-center justify-between gap-1 rounded border border-surface/5 bg-midnight-hero/90 p-3">
                          <span className="shrink-0 font-metric-sm text-metric-sm text-iris-light">
                            AI SPEECH
                          </span>
                          <div className="flex h-6 flex-1 items-end justify-center gap-1 px-4">
                            <span className="h-3 w-1 animate-pulse rounded-full bg-iris-light/60" />
                            <span className="h-5 w-1 rounded-full bg-iris-light" />
                            <span className="h-6 w-1 animate-pulse rounded-full bg-primary-container" />
                            <span className="h-4 w-1 rounded-full bg-primary-fixed" />
                            <span className="h-6 w-1 rounded-full bg-iris-light" />
                            <span className="h-3 w-1 rounded-full bg-primary-container" />
                            <span className="h-5 w-1 animate-pulse rounded-full bg-iris-light/70" />
                            <span className="h-2 w-1 rounded-full bg-primary-fixed" />
                            <span className="h-5 w-1 rounded-full bg-primary-container" />
                            <span className="h-4 w-1 animate-pulse rounded-full bg-iris-light" />
                            <span className="h-2 w-1 rounded-full bg-iris-light/40" />
                          </div>
                          <span className="font-metric-sm text-metric-sm text-success">
                            STREAMING 24kHz
                          </span>
                        </div>
                      </div>

                      {/* Dialogue Stream */}
                      <div className="space-y-3 font-body-sm text-body-sm">
                        <div className="flex items-start gap-3">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface/10 text-secondary-fixed-dim">
                            <AppIcon name="person" className="text-[16px]" />
                          </div>
                          <div className="max-w-[85%] rounded-lg border border-surface/10 bg-surface/10 p-3 text-on-primary">
                            <p className="mb-1 font-label-sm text-label-sm text-secondary-fixed-dim">
                              Customer (Caller +1 415-829-0112)
                            </p>
                            &ldquo;Can I book a facial treatment for tomorrow afternoon around 3:00
                            PM?&rdquo;
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary">
                            <AppIcon name="smart_toy" className="text-[16px]" />
                          </div>
                          <div className="max-w-[85%] rounded-lg border border-primary-container/30 bg-primary-container/15 p-3 text-on-primary">
                            <p className="mb-1 font-label-sm text-label-sm text-iris-light">
                              Maya • Realtime Response
                            </p>
                            &ldquo;I&apos;d love to help with that. Looking at our Sanctuary Room
                            schedule, 3:00 PM tomorrow is open for our 60-minute Deep Cleansing
                            Facial with Elena. I&apos;ve reserved this slot and pushed your checkout
                            invoice now.&rdquo;
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right 5 cols: Deterministic Action Pipeline Card */}
                    <div className="flex flex-col gap-3 lg:col-span-5">
                      <div className="flex h-full flex-col justify-between rounded-lg border border-surface/10 bg-surface/5 p-4">
                        <div>
                          <div className="mb-3 flex items-center justify-between border-b border-surface/10 pb-2">
                            <span className="font-label-md text-label-md uppercase tracking-wider text-iris-light">
                              Deterministic Action Chain
                            </span>
                            <AppIcon name="verified_user" className="text-[16px] text-success" />
                          </div>

                          {/* Verified Step Logs */}
                          <div className="space-y-2.5">
                            <div className="flex items-start gap-2.5 rounded border border-surface/5 bg-surface/5 p-2">
                              <AppIcon
                                name="check_circle"
                                className="mt-0.5 text-[18px] text-success"
                              />
                              <div>
                                <div className="font-label-sm text-label-sm text-on-primary">
                                  Calendar Availability Verified
                                </div>
                                <div className="font-metric-sm text-metric-sm text-secondary-fixed-dim">
                                  Google Cal API • Thu 15:00-16:00 EDT [Room 02]
                                </div>
                              </div>
                            </div>
                            <div className="flex items-start gap-2.5 rounded border border-surface/5 bg-surface/5 p-2">
                              <AppIcon
                                name="credit_card"
                                className="mt-0.5 text-[18px] text-success"
                              />
                              <div>
                                <div className="font-label-sm text-label-sm text-on-primary">
                                  Kora Checkout Generated
                                </div>
                                <div className="font-metric-sm text-metric-sm text-iris-light">
                                  Token: #INV-9942 • Amount: ₦15,000 deposit
                                </div>
                              </div>
                            </div>
                            <div className="flex items-start gap-2.5 rounded border border-primary-container/40 bg-primary-container/10 p-2">
                              <AppIcon name="sms" className="mt-0.5 text-[18px] text-iris-light" />
                              <div>
                                <div className="font-label-sm text-label-sm text-on-primary">
                                  Instant WhatsApp & SMS Push Dispatch
                                </div>
                                <div className="font-metric-sm text-metric-sm text-secondary-fixed-dim">
                                  Dispatched payload via Meta Cloud API
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Outcome Snapshot */}
                          <div className="mt-4 rounded-md border border-success/20 bg-success/10 p-3">
                            <div className="flex items-center justify-between">
                              <span className="flex items-center gap-1.5 font-label-sm text-label-sm font-semibold text-success">
                                <AppIcon name="task_alt" className="text-[16px]" />
                                Booking Confirmed via Kora (#BK-8821)
                              </span>
                              <span className="font-metric-sm text-metric-sm text-success">
                                200 OK
                              </span>
                            </div>
                            <p className="mt-1 font-metric-sm text-metric-sm text-secondary-fixed-dim">
                              Audit Trace: 0x9f1a...c82b • Zero Hallucination Guardrail PASS
                            </p>
                          </div>
                        </div>

                        {/* Side Mini-Metrics */}
                        <div className="grid grid-cols-3 gap-2 border-t border-surface/10 pt-3 text-center">
                          <div>
                            <div className="font-metric-lg text-metric-lg text-on-primary">
                              99.4%
                            </div>
                            <div className="font-label-sm text-label-sm text-secondary-fixed-dim">
                              Task Success
                            </div>
                          </div>
                          <div>
                            <div className="font-metric-lg text-metric-lg text-on-primary">42s</div>
                            <div className="font-label-sm text-label-sm text-secondary-fixed-dim">
                              Avg Handle
                            </div>
                          </div>
                          <div>
                            <div className="font-metric-lg text-metric-lg text-iris-light">
                              3.2%
                            </div>
                            <div className="font-label-sm text-label-sm text-secondary-fixed-dim">
                              Escalation
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            </div>
          </section>

          {/* SECTION 2: VALUE PROPOSITION (Canvas #f8f9fc surface) */}
          <section className="w-full bg-background px-6 py-24 text-on-surface lg:px-12">
            <div className="mx-auto max-w-7xl">
              <ScrollReveal yOffset={30}>
                <div className="mb-16 flex flex-col justify-between gap-6 md:flex-row md:items-end">
                  <div>
                    <span className="font-label-md text-label-md font-semibold uppercase tracking-wider text-primary">
                      Beyond Chatbots
                    </span>
                    <ScrollFloat
                      as="h2"
                      effect="float"
                      splitBy="words"
                      distance={30}
                      stretch={1.1}
                      scrollStart="top 90%"
                      scrollEnd="bottom 70%"
                      containerClassName="my-0"
                      textClassName="mt-2 font-headline-lg text-headline-lg tracking-tight text-text-primary"
                    >
                      More than conversations. Real work gets done.
                    </ScrollFloat>
                  </div>
                  <p className="max-w-md font-body-md text-body-md text-text-secondary">
                    Chatting is trivial. Executing business commitments within existing software
                    stacks without breaking workflows is what makes Switchboard essential.
                  </p>
                </div>
              </ScrollReveal>

              {/* 3 Sleek Cards with Staggered Entrance */}
              <ScrollReveal staggerChildren staggerDelay={0.15} yOffset={36}>
                <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
                  <div className="flex flex-col justify-between rounded-lg border border-border bg-surface p-8 transition-all hover:-translate-y-1 hover:shadow-xl">
                    <div>
                      <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-lg bg-surface-container-low text-primary">
                        <AppIcon name="record_voice_over" className="text-[28px]" />
                      </div>
                      <h3 className="mb-3 font-headline-sm text-headline-sm text-text-primary">
                        Understand customer requests
                      </h3>
                      <p className="mb-6 font-body-md text-body-md text-text-secondary">
                        Full semantic intent recognition tuned for Nigerian and global accents.
                        Understands slang, multi-part requests, background noise, and contextual
                        interruptions with sub-second response times.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 border-t border-border pt-4 font-label-sm text-label-sm font-medium text-primary">
                      <AppIcon name="translate" className="text-[16px]" />
                      <span>English, Pidgin & Native Cadence Supported</span>
                    </div>
                  </div>

                  <div className="flex flex-col justify-between rounded-lg border border-border bg-surface p-8 transition-all hover:-translate-y-1 hover:shadow-xl">
                    <div>
                      <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-lg bg-surface-container-low text-primary">
                        <AppIcon name="sync_saved_locally" className="text-[28px]" />
                      </div>
                      <h3 className="mb-3 font-headline-sm text-headline-sm text-text-primary">
                        Execute approved business actions
                      </h3>
                      <p className="mb-6 font-body-md text-body-md text-text-secondary">
                        Autonomous agents carry explicit programmatic rights. Hold slots atomically
                        in Postgres, generate verified Kora payment transfers, and confirm
                        reservations immediately without human delay.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 border-t border-border pt-4 font-label-sm text-label-sm font-medium text-success">
                      <AppIcon name="lock_clock" className="text-[16px]" />
                      <span>Deterministic Guardrails & Payment Locks</span>
                    </div>
                  </div>

                  <div className="flex flex-col justify-between rounded-lg border border-border bg-surface p-8 transition-all hover:-translate-y-1 hover:shadow-xl">
                    <div>
                      <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-lg bg-surface-container-low text-primary">
                        <AppIcon name="notifications_active" className="text-[28px]" />
                      </div>
                      <h3 className="mb-3 font-headline-sm text-headline-sm text-text-primary">
                        Keep your team informed
                      </h3>
                      <p className="mb-6 font-body-md text-body-md text-text-secondary">
                        Instant alerts over WhatsApp, Slack, and SMS. Whenever high-touch
                        intervention is preferred or an escalation threshold is reached, staff take
                        over with zero context loss.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 border-t border-border pt-4 font-label-sm text-label-sm font-medium text-text-secondary">
                      <AppIcon name="alt_route" className="text-[16px]" />
                      <span>Live WhatsApp Handoff & Customer Briefings</span>
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            </div>
          </section>

          {/* SECTION 3: PRODUCT SHOWCASE (SaaS Dashboard Preview) */}
          <section className="w-full border-y border-border bg-surface-container-low px-6 py-20 lg:px-12">
            <div className="mx-auto max-w-7xl">
              <ScrollReveal yOffset={30}>
                <div className="mx-auto mb-14 max-w-3xl text-center">
                  <span className="font-label-md text-label-md font-semibold uppercase tracking-wider text-primary">
                    Command Console
                  </span>
                  <ScrollFloat
                    as="h2"
                    effect="float"
                    splitBy="words"
                    distance={30}
                    stretch={1.1}
                    scrollStart="top 90%"
                    scrollEnd="bottom 70%"
                    containerClassName="my-0"
                    textClassName="mt-2 font-headline-lg text-headline-lg tracking-tight text-text-primary"
                  >
                    One workspace. An entire AI-powered front desk.
                  </ScrollFloat>
                  <p className="mt-3 font-body-md text-body-md text-text-secondary">
                    Orchestrate multi-agent operations, audit live customer dialogues, and configure
                    business authority rules from a single pane of glass.
                  </p>
                </div>
              </ScrollReveal>

              {/* SaaS Console Card Shell */}
              <ScrollReveal duration={0.9} yOffset={40} scale={0.97}>
                <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-2xl">
                  {/* App Top Header Inside Card */}
                  <div className="flex h-14 items-center justify-between border-b border-border bg-surface px-6">
                    <div className="flex items-center gap-4">
                      <span className="font-headline-sm text-[16px] font-semibold text-text-primary">
                        Fade Republic — Ota HQ
                      </span>
                      <span className="rounded bg-surface-container px-2 py-0.5 font-label-sm text-label-sm text-text-secondary">
                        Org ID: sb-fade-ota
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center gap-1.5 rounded bg-success/10 px-2.5 py-1 font-metric-sm text-metric-sm text-success">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-success" /> 3 Agents
                        Active
                      </span>
                      <button
                        type="button"
                        className="flex items-center gap-1 rounded bg-surface-container px-3 py-1.5 font-label-sm text-label-sm text-text-primary transition-colors hover:bg-surface-container-high"
                      >
                        <AppIcon name="tune" className="text-[16px]" /> Configure Fleet
                      </button>
                    </div>
                  </div>

                  {/* Dashboard Layout: Left Nav + Main Body */}
                  <div className="grid min-h-[520px] grid-cols-1 lg:grid-cols-12">
                    {/* Sub Navigation */}
                    <div className="flex flex-col justify-between border-r border-border bg-background p-4 lg:col-span-3">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between rounded bg-primary-fixed/30 px-3 py-2 font-label-md text-label-md text-primary">
                          <span className="flex items-center gap-2.5">
                            <AppIcon name="smart_toy" className="text-[18px]" /> AI Assistants
                          </span>
                          <span className="rounded bg-primary px-1.5 py-0.2 font-metric-sm text-metric-sm text-on-primary">
                            3
                          </span>
                        </div>
                        <div className="flex cursor-pointer items-center justify-between rounded px-3 py-2 font-label-md text-label-md text-text-secondary transition-colors hover:bg-surface hover:text-text-primary">
                          <span className="flex items-center gap-2.5">
                            <AppIcon name="forum" className="text-[18px]" /> Conversations
                          </span>
                          <span className="font-metric-sm text-metric-sm text-text-secondary">
                            142
                          </span>
                        </div>
                        <div className="flex cursor-pointer items-center justify-between rounded px-3 py-2 font-label-md text-label-md text-text-secondary transition-colors hover:bg-surface hover:text-text-primary">
                          <span className="flex items-center gap-2.5">
                            <AppIcon name="groups" className="text-[18px]" /> Customers
                          </span>
                        </div>
                        <div className="flex cursor-pointer items-center justify-between rounded px-3 py-2 font-label-md text-label-md text-text-secondary transition-colors hover:bg-surface hover:text-text-primary">
                          <span className="flex items-center gap-2.5">
                            <AppIcon name="calendar_month" className="text-[18px]" /> Bookings
                          </span>
                          <span className="font-metric-sm text-metric-sm text-success">
                            28 Today
                          </span>
                        </div>
                        <div className="flex cursor-pointer items-center justify-between rounded px-3 py-2 font-label-md text-label-md text-tertiary-container transition-colors hover:bg-tertiary-fixed/20">
                          <span className="flex items-center gap-2.5">
                            <AppIcon name="error" className="text-[18px]" /> Needs Attention
                          </span>
                          <span className="rounded-full bg-tertiary-container px-1.5 font-metric-sm text-metric-sm text-on-tertiary">
                            2
                          </span>
                        </div>
                        <div className="flex cursor-pointer items-center justify-between rounded px-3 py-2 font-label-md text-label-md text-text-secondary transition-colors hover:bg-surface hover:text-text-primary">
                          <span className="flex items-center gap-2.5">
                            <AppIcon name="query_stats" className="text-[18px]" /> Activity Overview
                          </span>
                        </div>
                      </div>

                      {/* Fleet Health Pill */}
                      <div className="rounded border border-border bg-surface p-3">
                        <div className="mb-1 font-label-sm text-label-sm text-text-secondary">
                          Weekly Appointment Volume
                        </div>
                        <div className="font-metric-lg text-metric-lg text-text-primary">
                          1,894{' '}
                          <span className="font-metric-sm text-metric-sm text-success">+14%</span>
                        </div>
                        <div className="mt-2 h-1.5 w-full rounded-full bg-surface-container">
                          <div className="h-1.5 w-[91%] rounded-full bg-primary-container" />
                        </div>
                      </div>
                    </div>

                    {/* Main Console Body */}
                    <div className="flex flex-col gap-6 bg-surface p-6 lg:col-span-9">
                      {/* Fleet Status Row */}
                      <div>
                        <div className="mb-4 flex items-center justify-between">
                          <h3 className="font-headline-sm text-headline-sm text-text-primary">
                            Operational Fleet
                          </h3>
                          <span className="font-label-sm text-label-sm text-text-secondary">
                            Dispatched on WhatsApp Cloud & Web Chat
                          </span>
                        </div>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                          {/* Assistant 1 */}
                          <div className="rounded-lg border border-border bg-surface-container-lowest p-4 transition-all hover:border-primary-container">
                            <div className="mb-2 flex items-start justify-between">
                              <div className="flex items-center gap-2">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-container text-xs font-semibold text-on-primary">
                                  M
                                </div>
                                <div>
                                  <div className="font-label-md text-label-md font-semibold text-text-primary">
                                    Maya
                                  </div>
                                  <div className="font-label-sm text-label-sm text-text-secondary">
                                    Front Desk Lead
                                  </div>
                                </div>
                              </div>
                              <span className="rounded-full bg-success/15 px-2 py-0.5 font-metric-sm text-metric-sm text-success">
                                Active
                              </span>
                            </div>
                            <div className="mt-2 font-body-sm text-body-sm text-text-secondary">
                              Handling inbound bookings & WhatsApp inquiries
                            </div>
                            <div className="mt-3 flex justify-between border-t border-border pt-3 font-metric-sm text-metric-sm text-text-secondary">
                              <span>94 chats today</span>
                              <span className="font-medium text-text-primary">99.8% CSAT</span>
                            </div>
                          </div>

                          {/* Assistant 2 */}
                          <div className="rounded-lg border border-border bg-surface-container-lowest p-4 transition-all hover:border-primary-container">
                            <div className="mb-2 flex items-start justify-between">
                              <div className="flex items-center gap-2">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-tint text-xs font-semibold text-on-primary">
                                  D
                                </div>
                                <div>
                                  <div className="font-label-md text-label-md font-semibold text-text-primary">
                                    Devon
                                  </div>
                                  <div className="font-label-sm text-label-sm text-text-secondary">
                                    VIP Barber Intake
                                  </div>
                                </div>
                              </div>
                              <span className="rounded-full bg-success/15 px-2 py-0.5 font-metric-sm text-metric-sm text-success">
                                Active
                              </span>
                            </div>
                            <div className="mt-2 font-body-sm text-body-sm text-text-secondary">
                              Barber matching, grooming packages & repeats
                            </div>
                            <div className="mt-3 flex justify-between border-t border-border pt-3 font-metric-sm text-metric-sm text-text-secondary">
                              <span>41 chats today</span>
                              <span className="font-medium text-text-primary">84% hold rate</span>
                            </div>
                          </div>

                          {/* Assistant 3 */}
                          <div className="rounded-lg border border-border bg-surface-container-lowest p-4 transition-all hover:border-primary-container">
                            <div className="mb-2 flex items-start justify-between">
                              <div className="flex items-center gap-2">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-on-secondary">
                                  A
                                </div>
                                <div>
                                  <div className="font-label-md text-label-md font-semibold text-text-primary">
                                    Aria
                                  </div>
                                  <div className="font-label-sm text-label-sm text-text-secondary">
                                    Deposits & Kora Pay
                                  </div>
                                </div>
                              </div>
                              <span className="rounded-full bg-success/15 px-2 py-0.5 font-metric-sm text-metric-sm text-success">
                                Active
                              </span>
                            </div>
                            <div className="mt-2 font-body-sm text-body-sm text-text-secondary">
                              Bank transfer deposit generation & webhook validation
                            </div>
                            <div className="mt-3 flex justify-between border-t border-border pt-3 font-metric-sm text-metric-sm text-text-secondary">
                              <span>18 deposits today</span>
                              <span className="font-medium text-text-primary">₦145k secured</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Live Activity Stream Table */}
                      <div>
                        <div className="mb-3 flex items-center justify-between">
                          <h4 className="font-label-md text-label-md font-semibold uppercase tracking-wider text-text-primary">
                            Live Activity Feed
                          </h4>
                          <span className="font-metric-sm text-metric-sm text-text-secondary">
                            Auto-refresh: 1s interval
                          </span>
                        </div>
                        <div className="overflow-x-auto rounded-lg border border-border">
                          <table className="w-full text-left font-body-sm text-body-sm">
                            <thead className="border-b border-border bg-surface-container-low font-label-sm text-label-sm text-text-secondary">
                              <tr>
                                <th className="px-4 py-2.5 font-medium">CUSTOMER / PHONE</th>
                                <th className="px-4 py-2.5 font-medium">ASSISTANT</th>
                                <th className="px-4 py-2.5 font-medium">INTENT & ACTION</th>
                                <th className="px-4 py-2.5 text-center font-medium">STATUS</th>
                                <th className="px-4 py-2.5 text-right font-medium">TIMESTAMP</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              <tr className="hover:bg-surface-container-lowest">
                                <td className="px-4 py-3 font-medium text-text-primary">
                                  S. Vance • +234 803 *** 0112
                                </td>
                                <td className="px-4 py-3">Maya</td>
                                <td className="px-4 py-3 text-text-secondary">
                                  Fade & Beard Sculpt • Confirmed Slot 3:00 PM
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-metric-sm text-metric-sm text-emerald-700">
                                    Confirmed
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right font-metric-sm text-metric-sm text-text-secondary">
                                  Just now
                                </td>
                              </tr>
                              <tr className="hover:bg-surface-container-lowest">
                                <td className="px-4 py-3 font-medium text-text-primary">
                                  T. Albright • +234 812 *** 9918
                                </td>
                                <td className="px-4 py-3">Devon</td>
                                <td className="px-4 py-3 text-text-secondary">
                                  VIP Dreadlocks Retwist • Slot Held (15m window)
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 font-metric-sm text-metric-sm text-indigo-700">
                                    In Progress
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right font-metric-sm text-metric-sm text-text-secondary">
                                  2m ago
                                </td>
                              </tr>
                              <tr className="hover:bg-surface-container-lowest">
                                <td className="px-4 py-3 font-medium text-text-primary">
                                  K. Adeleke • +234 901 *** 4820
                                </td>
                                <td className="px-4 py-3">Aria</td>
                                <td className="px-4 py-3 text-text-secondary">
                                  Deposit Refund Request • Dispatched to Owner Desk
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 font-metric-sm text-metric-sm text-amber-800">
                                    Needs Attention
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right font-metric-sm text-metric-sm text-text-secondary">
                                  5m ago
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            </div>
          </section>

          {/* SECTION 4: CORE FEATURES (Asymmetric Feature Grid) */}
          <section
            id="solutions"
            className="scroll-mt-16 w-full bg-background px-5 sm:px-8 py-16 sm:py-20 lg:py-24 text-on-surface lg:px-12"
          >
            <div className="mx-auto max-w-7xl">
              <ScrollReveal yOffset={30}>
                <div className="mb-16 max-w-3xl">
                  <span className="font-label-md text-label-md font-semibold uppercase tracking-wider text-primary">
                    Engine Capabilities
                  </span>
                  <ScrollFloat
                    as="h2"
                    effect="float"
                    splitBy="words"
                    distance={30}
                    stretch={1.1}
                    scrollStart="top 90%"
                    scrollEnd="bottom 70%"
                    containerClassName="my-0"
                    textClassName="mt-2 font-headline-lg text-headline-lg tracking-tight text-text-primary"
                  >
                    Engineered for strict fidelity and sub-second execution.
                  </ScrollFloat>
                  <p className="mt-3 font-body-md text-body-md text-text-secondary">
                    Every layer of Switchboard is designed to eliminate telephone and chat friction,
                    prevent double-bookings with PostgreSQL constraints, and preserve complete audit
                    trails.
                  </p>
                </div>
              </ScrollReveal>

              {/* Asymmetric Grid with Staggered Entrance */}
              <ScrollReveal staggerChildren staggerDelay={0.12} yOffset={36}>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
                  <div className="flex flex-col justify-between rounded-xl border border-border bg-surface p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl md:col-span-7">
                    <div>
                      <div className="mb-6 flex h-10 w-10 items-center justify-center rounded bg-primary-fixed text-primary">
                        <AppIcon name="speed" className="text-[24px]" />
                      </div>
                      <h3 className="mb-3 font-headline-md text-headline-md text-text-primary">
                        Sub-Second Autonomous Reception
                      </h3>
                      <p className="mb-6 font-body-md text-body-md text-text-secondary">
                        Natural conversational turn-taking with ultra-low latency response pipelines
                        on WhatsApp and web chat. Customers can interrupt, ask side questions, and
                        clarify pricing without awkward AI lag.
                      </p>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-border bg-surface-container-low p-4">
                      <span className="font-metric-sm text-metric-sm text-text-secondary">
                        Roundtrip Time (WhatsApp Webhook to AI to Database):
                      </span>
                      <span className="font-metric-md text-metric-md font-semibold text-success">
                        280ms • Verified Pipeline
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col justify-between rounded-xl border border-border bg-surface p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl md:col-span-5">
                    <div>
                      <div className="mb-6 flex h-10 w-10 items-center justify-center rounded bg-primary-fixed text-primary">
                        <AppIcon name="event_available" className="text-[24px]" />
                      </div>
                      <h3 className="mb-3 font-headline-md text-headline-md text-text-primary">
                        Conflict-Free Scheduling
                      </h3>
                      <p className="mb-6 font-body-md text-body-md text-text-secondary">
                        Postgres{' '}
                        <code className="rounded bg-primary/10 px-1 py-0.5 font-mono text-xs text-primary">
                          EXCLUDE USING gist
                        </code>{' '}
                        exclusion constraints prevent two customers from reserving the same staff
                        slot simultaneously. Never relies on fragile app-level checks.
                      </p>
                    </div>
                    <div className="rounded-lg border border-border bg-surface-container-low p-4">
                      <div className="flex items-center gap-2 font-label-sm text-label-sm text-primary">
                        <AppIcon name="lock" className="text-[16px]" />
                        <span>100% Invariant-Backed Slot Verification</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-surface p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg md:col-span-4">
                    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded bg-surface-container-high text-text-primary">
                      <AppIcon name="contacts" className="text-[22px]" />
                    </div>
                    <h4 className="mb-2 font-headline-sm text-headline-sm text-text-primary">
                      High-Intent Client Capture
                    </h4>
                    <p className="font-body-sm text-body-sm text-text-secondary">
                      Captures preferred styles, barber requests, timing flexibility, and deposit
                      status. Builds clean client CRM profiles with zero manual bookkeeping.
                    </p>
                  </div>

                  <div className="rounded-xl border border-border bg-surface p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg md:col-span-4">
                    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded bg-surface-container-high text-text-primary">
                      <AppIcon name="history_edu" className="text-[22px]" />
                    </div>
                    <h4 className="mb-2 font-headline-sm text-headline-sm text-text-primary">
                      Cross-Channel Memory
                    </h4>
                    <p className="font-body-sm text-body-sm text-text-secondary">
                      Phone numbers bind customer conversation history across WhatsApp and web. When
                      a client comes back to reschedule or re-book, the agent remembers their
                      stylist and preferences.
                    </p>
                  </div>

                  <div className="rounded-xl border border-border bg-surface p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg md:col-span-4">
                    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded bg-surface-container-high text-text-primary">
                      <AppIcon name="phone_forwarded" className="text-[22px]" />
                    </div>
                    <h4 className="mb-2 font-headline-sm text-headline-sm text-text-primary">
                      Seamless Human Escalation
                    </h4>
                    <p className="font-body-sm text-body-sm text-text-secondary">
                      If an edge case or VIP customer requires personal attention, Switchboard flags
                      the thread in the owner inbox with an automated summary, allowing instant
                      staff takeover.
                    </p>
                  </div>
                </div>
              </ScrollReveal>
            </div>
          </section>

          {/* SECTION 5: HOW IT WORKS (4-Step Workflow) */}
          <section
            id="how-it-works"
            className="scroll-mt-16 w-full border-t border-border bg-surface-container-low px-5 sm:px-8 py-16 sm:py-20 lg:py-24 lg:px-12"
          >
            <div className="mx-auto max-w-7xl">
              <ScrollReveal yOffset={30}>
                <div className="mx-auto mb-16 max-w-2xl text-center">
                  <span className="font-label-md text-label-md font-semibold uppercase tracking-wider text-primary">
                    Fast Implementation
                  </span>
                  <ScrollFloat
                    as="h2"
                    effect="float"
                    splitBy="words"
                    distance={30}
                    stretch={1.1}
                    scrollStart="top 90%"
                    scrollEnd="bottom 70%"
                    containerClassName="my-0"
                    textClassName="mt-2 font-headline-lg text-headline-lg tracking-tight text-text-primary"
                  >
                    From zero to autonomous reception in four straightforward steps.
                  </ScrollFloat>
                </div>
              </ScrollReveal>

              <ScrollReveal staggerChildren staggerDelay={0.12} yOffset={36}>
                <div className="relative grid grid-cols-1 gap-6 md:grid-cols-4">
                  <div className="relative flex flex-col justify-between rounded-lg border border-border bg-surface p-6 transition-all hover:-translate-y-1 hover:shadow-xl">
                    <div>
                      <div className="mb-4 font-metric-lg text-metric-lg font-bold text-primary">
                        01
                      </div>
                      <h3 className="mb-2 font-headline-sm text-headline-sm text-text-primary">
                        Define Workspace
                      </h3>
                      <p className="font-body-sm text-body-sm text-text-secondary">
                        Input your salon or barber details: services, staff roster, operating hours,
                        and deposit requirements.
                      </p>
                    </div>
                    <div className="mt-6 border-t border-border pt-4 font-label-sm text-label-sm text-text-secondary">
                      Setup time: ~10 minutes
                    </div>
                  </div>

                  <div className="relative flex flex-col justify-between rounded-lg border border-border bg-surface p-6 transition-all hover:-translate-y-1 hover:shadow-xl">
                    <div>
                      <div className="mb-4 font-metric-lg text-metric-lg font-bold text-primary">
                        02
                      </div>
                      <h3 className="mb-2 font-headline-sm text-headline-sm text-text-primary">
                        Connect Kora Deposits
                      </h3>
                      <p className="font-body-sm text-body-sm text-text-secondary">
                        Link your Kora merchant credentials for automated bank-transfer deposits and
                        instant payment verification webhooks.
                      </p>
                    </div>
                    <div className="mt-6 border-t border-border pt-4 font-label-sm text-label-sm text-text-secondary">
                      Full Kora API sandbox & prod
                    </div>
                  </div>

                  <div className="relative flex flex-col justify-between rounded-lg border border-border bg-surface p-6 transition-all hover:-translate-y-1 hover:shadow-xl">
                    <div>
                      <div className="mb-4 font-metric-lg text-metric-lg font-bold text-primary">
                        03
                      </div>
                      <h3 className="mb-2 font-headline-sm text-headline-sm text-text-primary">
                        Test in Sandbox
                      </h3>
                      <p className="font-body-sm text-body-sm text-text-secondary">
                        Chat with your simulated agent in the browser test bench. Test booking
                        holds, payment cancellations, and slot expiries safely.
                      </p>
                    </div>
                    <div className="mt-6 border-t border-border pt-4 font-label-sm text-label-sm text-text-secondary">
                      Live browser test bench
                    </div>
                  </div>

                  <div className="relative flex flex-col justify-between rounded-lg border border-border bg-surface p-6 transition-all hover:-translate-y-1 hover:shadow-xl">
                    <div>
                      <div className="mb-4 font-metric-lg text-metric-lg font-bold text-primary">
                        04
                      </div>
                      <h3 className="mb-2 font-headline-sm text-headline-sm text-text-primary">
                        Connect WhatsApp & Go Live
                      </h3>
                      <p className="font-body-sm text-body-sm text-text-secondary">
                        Connect your WhatsApp Business number and embed the booking widget on your
                        site. Every confirmed slot is proven.
                      </p>
                    </div>
                    <div className="mt-6 border-t border-border pt-4 font-label-sm text-label-sm font-medium text-success">
                      Instant live readiness
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            </div>
          </section>

          {/* SECTION 6: INDUSTRIES */}
          <section className="w-full bg-background px-6 py-24 text-on-surface lg:px-12">
            <div className="mx-auto max-w-7xl">
              <ScrollReveal yOffset={30}>
                <div className="mb-16 flex flex-col justify-between gap-6 md:flex-row md:items-end">
                  <div>
                    <span className="font-label-md text-label-md font-semibold uppercase tracking-wider text-primary">
                      Tailored Workflows
                    </span>
                    <ScrollFloat
                      as="h2"
                      effect="float"
                      splitBy="words"
                      distance={30}
                      stretch={1.1}
                      scrollStart="top 90%"
                      scrollEnd="bottom 70%"
                      containerClassName="my-0"
                      textClassName="mt-2 font-headline-lg text-headline-lg tracking-tight text-text-primary"
                    >
                      Built for service businesses where every missed slot is lost revenue.
                    </ScrollFloat>
                  </div>
                </div>
              </ScrollReveal>

              <ScrollReveal staggerChildren staggerDelay={0.15} yOffset={36}>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                  <div className="flex flex-col justify-between rounded-xl border border-border bg-surface p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl">
                    <div>
                      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded bg-primary-fixed/50 text-primary">
                        <AppIcon name="content_cut" className="text-[24px]" />
                      </div>
                      <h3 className="mb-2 font-headline-sm text-headline-sm text-text-primary">
                        Barbershops & Grooming Lounges
                      </h3>
                      <p className="mb-4 font-body-sm text-body-sm text-text-secondary">
                        Automated chair selection, barber-specific schedules, Kora bank-transfer
                        deposits, and automatic slot release on expired holds.
                      </p>
                      <ul className="mb-6 space-y-1.5 font-label-sm text-label-sm text-text-secondary">
                        <li className="flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Multi-barber
                          chair concurrency
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary" /> ₦3,000–₦10,000
                          deposit enforcement
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary" /> After-hours
                          WhatsApp booking capture
                        </li>
                      </ul>
                    </div>
                    <div className="rounded bg-surface-container-low p-2.5 font-metric-sm text-metric-sm text-text-primary">
                      Impact: 85% drop in no-shows within 2 weeks
                    </div>
                  </div>

                  <div className="flex flex-col justify-between rounded-xl border border-border bg-surface p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl">
                    <div>
                      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded bg-primary-fixed/50 text-primary">
                        <AppIcon name="spa" className="text-[24px]" />
                      </div>
                      <h3 className="mb-2 font-headline-sm text-headline-sm text-text-primary">
                        Hair Salons & Braiding Studios
                      </h3>
                      <p className="mb-4 font-body-sm text-body-sm text-text-secondary">
                        Multi-hour service scheduling (knotless braids, sew-ins), stylist
                        assignments, and automatic duration blocking that stops double-booking.
                      </p>
                      <ul className="mb-6 space-y-1.5 font-label-sm text-label-sm text-text-secondary">
                        <li className="flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary" /> 2h–5h dynamic
                          slot durations
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Style
                          consultation image uploads
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Instant automated
                          reminders
                        </li>
                      </ul>
                    </div>
                    <div className="rounded bg-surface-container-low p-2.5 font-metric-sm text-metric-sm text-text-primary">
                      Impact: ₦320,000 monthly recovered revenue avg.
                    </div>
                  </div>

                  <div className="flex flex-col justify-between rounded-xl border border-border bg-surface p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl">
                    <div>
                      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded bg-primary-fixed/50 text-primary">
                        <AppIcon name="face_retouching_natural" className="text-[24px]" />
                      </div>
                      <h3 className="mb-2 font-headline-sm text-headline-sm text-text-primary">
                        Beauty Clinics & Aesthetics Spas
                      </h3>
                      <p className="mb-4 font-body-sm text-body-sm text-text-secondary">
                        Room and equipment allocations, treatment contraindication disclaimers, and
                        Kora deposit receipts for high-ticket consultations.
                      </p>
                      <ul className="mb-6 space-y-1.5 font-label-sm text-label-sm text-text-secondary">
                        <li className="flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Room and
                          specialist pairing
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Pre-treatment
                          guidelines over WhatsApp
                        </li>
                        <li className="flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Zero-deposit
                          bypass for VIP regulars
                        </li>
                      </ul>
                    </div>
                    <div className="rounded bg-surface-container-low p-2.5 font-metric-sm text-metric-sm text-text-primary">
                      Impact: 100% deposit collection on weekend slots
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            </div>
          </section>

          {/* SECTION 7: AI BOOKING & PAYMENTS WORKFLOW */}
          <section className="w-full border-y border-border bg-surface-container-low px-6 py-24 lg:px-12">
            <div className="mx-auto max-w-7xl">
              <ScrollReveal yOffset={30}>
                <div className="mx-auto mb-16 max-w-3xl text-center">
                  <span className="font-label-md text-label-md font-semibold uppercase tracking-wider text-primary">
                    End-to-End Execution
                  </span>
                  <ScrollFloat
                    as="h2"
                    effect="float"
                    splitBy="words"
                    distance={30}
                    stretch={1.1}
                    scrollStart="top 90%"
                    scrollEnd="bottom 70%"
                    containerClassName="my-0"
                    textClassName="mt-2 font-headline-lg text-headline-lg tracking-tight text-text-primary"
                  >
                    From the first WhatsApp message to a confirmed, paid booking.
                  </ScrollFloat>
                  <p className="mt-3 font-body-md text-body-md text-text-secondary">
                    No manual copy-pasting or missed bank alerts. The agent verifies every step in
                    real-time while the customer is chatting.
                  </p>
                </div>
              </ScrollReveal>

              {/* Horizontal 5-Stage Flow */}
              <ScrollReveal staggerChildren staggerDelay={0.1} yOffset={30}>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
                  <div className="flex flex-col justify-between rounded-lg border border-border bg-surface p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
                    <div>
                      <div className="mb-3 flex items-center justify-between">
                        <span className="rounded bg-surface-container px-2 py-0.5 font-metric-sm text-metric-sm text-text-secondary">
                          Stage 01
                        </span>
                        <AppIcon name="chat" className="text-[18px] text-primary" />
                      </div>
                      <h4 className="mb-2 font-headline-sm text-[16px] text-text-primary">
                        Customer Request
                      </h4>
                      <p className="font-body-sm text-body-sm text-text-secondary">
                        Customer messages on WhatsApp asking for a haircut or styling at a preferred
                        time.
                      </p>
                    </div>
                    <div className="mt-4 border-t border-border pt-3 font-metric-sm text-metric-sm text-primary">
                      → Intent parsed in 120ms
                    </div>
                  </div>

                  <div className="flex flex-col justify-between rounded-lg border border-border bg-surface p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
                    <div>
                      <div className="mb-3 flex items-center justify-between">
                        <span className="rounded bg-surface-container px-2 py-0.5 font-metric-sm text-metric-sm text-text-secondary">
                          Stage 02
                        </span>
                        <AppIcon name="event" className="text-[18px] text-primary" />
                      </div>
                      <h4 className="mb-2 font-headline-sm text-[16px] text-text-primary">
                        Live Availability Check
                      </h4>
                      <p className="font-body-sm text-body-sm text-text-secondary">
                        Postgres exclusion check queries barber schedules and places a 15-minute
                        hold band.
                      </p>
                    </div>
                    <div className="mt-4 border-t border-border pt-3 font-metric-sm text-metric-sm text-primary">
                      → Slot held atomically
                    </div>
                  </div>

                  <div className="flex flex-col justify-between rounded-lg border border-border bg-surface p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
                    <div>
                      <div className="mb-3 flex items-center justify-between">
                        <span className="rounded bg-primary-fixed/40 px-2 py-0.5 font-metric-sm text-metric-sm font-semibold text-primary">
                          Stage 03
                        </span>
                        <AppIcon name="account_balance" className="text-[18px] text-primary" />
                      </div>
                      <h4 className="mb-2 font-headline-sm text-[16px] text-text-primary">
                        Kora Dynamic Account
                      </h4>
                      <p className="font-body-sm text-body-sm text-text-secondary">
                        Generates a dedicated Kora bank transfer account number with integer kobo
                        deposit amount.
                      </p>
                    </div>
                    <div className="mt-4 border-t border-border pt-3 font-metric-sm text-metric-sm text-primary">
                      → Pushed via WhatsApp card
                    </div>
                  </div>

                  <div className="flex flex-col justify-between rounded-lg border border-border bg-surface p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
                    <div>
                      <div className="mb-3 flex items-center justify-between">
                        <span className="rounded bg-surface-container px-2 py-0.5 font-metric-sm text-metric-sm text-text-secondary">
                          Stage 04
                        </span>
                        <AppIcon name="verified" className="text-[18px] text-success" />
                      </div>
                      <h4 className="mb-2 font-headline-sm text-[16px] text-text-primary">
                        Dual-Verification
                      </h4>
                      <p className="font-body-sm text-body-sm text-text-secondary">
                        Webhook arrives, signature verified, and Kora query re-checks transaction
                        status directly.
                      </p>
                    </div>
                    <div className="mt-4 border-t border-border pt-3 font-metric-sm text-metric-sm text-success">
                      → Webhook + Query PASS
                    </div>
                  </div>

                  <div className="flex flex-col justify-between rounded-lg border border-border bg-surface p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
                    <div>
                      <div className="mb-3 flex items-center justify-between">
                        <span className="rounded bg-success/20 px-2 py-0.5 font-metric-sm text-metric-sm font-semibold text-success">
                          Stage 05
                        </span>
                        <AppIcon name="check_circle" className="text-[18px] text-success" />
                      </div>
                      <h4 className="mb-2 font-headline-sm text-[16px] text-text-primary">
                        Confirmed Booking
                      </h4>
                      <p className="font-body-sm text-body-sm text-text-secondary">
                        Slot transitions to confirmed, calendar updates, and WhatsApp confirmation
                        is dispatched.
                      </p>
                    </div>
                    <div className="mt-4 border-t border-border pt-3 font-metric-sm text-metric-sm text-text-secondary">
                      Total: &lt; 45s flow
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            </div>
          </section>

          {/* SECTION 8: RELIABILITY AND TRUST (Dark Midnight #101827 Surface) */}
          <section
            id="safety"
            className="scroll-mt-16 w-full bg-midnight-hero px-5 sm:px-8 py-16 sm:py-20 lg:py-24 text-on-primary lg:px-12"
          >
            <div className="mx-auto max-w-7xl">
              <ScrollReveal yOffset={30}>
                <div className="mb-16 flex flex-col justify-between gap-12 lg:flex-row lg:items-center">
                  <div className="max-w-2xl">
                    <span className="font-label-md text-label-md uppercase tracking-wider text-iris-light">
                      Enterprise Safety Fabric
                    </span>
                    <ScrollFloat
                      as="h2"
                      effect="float"
                      splitBy="words"
                      distance={30}
                      stretch={1.1}
                      scrollStart="top 90%"
                      scrollEnd="bottom 70%"
                      containerClassName="my-0"
                      textClassName="mt-2 font-headline-lg text-headline-lg tracking-tight text-on-primary"
                    >
                      Intelligent enough to act. Designed to know its limits.
                    </ScrollFloat>
                    <p className="mt-4 font-body-md text-body-md text-secondary-fixed-dim">
                      Autonomous execution without invariants is a liability. Switchboard is
                      engineered with strict database exclusion constraints and payment state
                      machines so your business never confirms a slot it cannot prove.
                    </p>
                  </div>

                  {/* Metric Highlight Badge */}
                  <div className="flex gap-8 rounded-xl border border-surface/10 bg-surface/5 p-6 backdrop-blur-md">
                    <div>
                      <div className="font-metric-lg text-metric-lg font-semibold text-success">
                        0.00%
                      </div>
                      <div className="mt-1 font-label-sm text-label-sm text-secondary-fixed-dim">
                        Double-Booked Slots
                      </div>
                    </div>
                    <div className="w-[1px] bg-surface/10" />
                    <div>
                      <div className="font-metric-lg text-metric-lg font-semibold text-iris-light">
                        100%
                      </div>
                      <div className="mt-1 font-label-sm text-label-sm text-secondary-fixed-dim">
                        Re-Verified Kora Webhooks
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollReveal>

              {/* Reliability Pillars with Staggered Entrance */}
              <ScrollReveal staggerChildren staggerDelay={0.15} yOffset={36}>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                  <div className="rounded-lg border border-surface/10 bg-surface/5 p-6 transition-all hover:-translate-y-1 hover:border-iris-light/30">
                    <div className="mb-4 flex items-center gap-3">
                      <AppIcon name="policy" className="text-[24px] text-iris-light" />
                      <h3 className="font-headline-sm text-headline-sm text-on-primary">
                        Postgres GIST Invariant
                      </h3>
                    </div>
                    <p className="font-body-sm text-body-sm text-secondary-fixed-dim">
                      Double booking is mathematically impossible at the database level. Even under
                      100 parallel requests for the same second, Postgres admits exactly 1 winner.
                    </p>
                  </div>
                  <div className="rounded-lg border border-surface/10 bg-surface/5 p-6 transition-all hover:-translate-y-1 hover:border-iris-light/30">
                    <div className="mb-4 flex items-center gap-3">
                      <AppIcon name="verified_user" className="text-[24px] text-iris-light" />
                      <h3 className="font-headline-sm text-headline-sm text-on-primary">
                        Idempotent Payment Events
                      </h3>
                    </div>
                    <p className="font-body-sm text-body-sm text-secondary-fixed-dim">
                      Every Kora charge webhook is deduplicated with a unique provider event key.
                      Duplicate, delayed, or out-of-order webhooks can never trigger double-credits.
                    </p>
                  </div>
                  <div className="rounded-lg border border-surface/10 bg-surface/5 p-6 transition-all hover:-translate-y-1 hover:border-iris-light/30">
                    <div className="mb-4 flex items-center gap-3">
                      <AppIcon name="support_agent" className="text-[24px] text-iris-light" />
                      <h3 className="font-headline-sm text-headline-sm text-on-primary">
                        Human Takeover Guarantee
                      </h3>
                    </div>
                    <p className="font-body-sm text-body-sm text-secondary-fixed-dim">
                      Business owners can view any conversation in real time on the dashboard and
                      take over with a single click. The AI assistant immediately steps aside.
                    </p>
                  </div>
                </div>
              </ScrollReveal>
            </div>
          </section>

          {/* SECTION 9: PRICING PREVIEW */}
          <section
            id="pricing"
            className="scroll-mt-16 w-full bg-background px-5 sm:px-8 py-16 sm:py-20 lg:py-24 text-on-surface lg:px-12"
          >
            <div className="mx-auto max-w-7xl">
              <ScrollReveal yOffset={30}>
                <div className="mx-auto mb-16 max-w-2xl text-center">
                  <span className="font-label-md text-label-md font-semibold uppercase tracking-wider text-primary">
                    Transparent Investment
                  </span>
                  <ScrollFloat
                    as="h2"
                    effect="float"
                    splitBy="words"
                    distance={30}
                    stretch={1.1}
                    scrollStart="top 90%"
                    scrollEnd="bottom 70%"
                    containerClassName="my-0"
                    textClassName="mt-2 font-headline-lg text-headline-lg tracking-tight text-text-primary"
                  >
                    Predictable pricing that scales with your salon or shop.
                  </ScrollFloat>
                  <p className="mt-3 font-body-md text-body-md text-text-secondary">
                    No hidden telephony surcharges. All plans include automated Kora deposit
                    integration and WhatsApp conversation management.
                  </p>
                </div>
              </ScrollReveal>

              {/* 3 Tier Cards with Staggered Entrance */}
              <ScrollReveal staggerChildren staggerDelay={0.15} yOffset={36}>
                <div className="grid grid-cols-1 items-stretch gap-8 md:grid-cols-3">
                  <div className="flex flex-col justify-between rounded-xl border border-border bg-surface p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl">
                    <div>
                      <div className="mb-2 font-label-md text-label-md font-semibold uppercase tracking-wider text-text-primary">
                        Starter Barbershop
                      </div>
                      <p className="mb-6 font-body-sm text-body-sm text-text-secondary">
                        Ideal for single-chair barbers and boutique private stylists.
                      </p>
                      <div className="mb-8 flex items-baseline gap-1">
                        <span className="font-headline-lg text-headline-lg font-bold text-text-primary">
                          ₦15,000
                        </span>
                        <span className="font-body-sm text-body-sm text-text-secondary">
                          / month
                        </span>
                      </div>
                      <ul className="mb-8 space-y-3 font-body-sm text-body-sm text-text-secondary">
                        <li className="flex items-center gap-2.5">
                          <AppIcon name="check" className="text-[18px] text-success" /> 1 Dedicated
                          WhatsApp Agent (Maya)
                        </li>
                        <li className="flex items-center gap-2.5">
                          <AppIcon name="check" className="text-[18px] text-success" /> Up to 200
                          completed bookings/mo
                        </li>
                        <li className="flex items-center gap-2.5">
                          <AppIcon name="check" className="text-[18px] text-success" /> Kora Bank
                          Transfer Deposits
                        </li>
                        <li className="flex items-center gap-2.5">
                          <AppIcon name="check" className="text-[18px] text-success" /> Postgres
                          conflict-free hold engine
                        </li>
                        <li className="flex items-center gap-2.5">
                          <AppIcon name="check" className="text-[18px] text-success" /> Mobile
                          dashboard access
                        </li>
                      </ul>
                    </div>
                    <Link
                      href="/auth/signup?plan=starter"
                      className="w-full rounded border border-border px-4 py-2.5 text-center font-label-md text-label-md text-text-primary transition-colors hover:bg-surface-container"
                    >
                      Start 14-Day Free Trial
                    </Link>
                  </div>

                  <div className="relative flex flex-col justify-between rounded-xl border-2 border-primary-container bg-surface p-8 shadow-xl transition-all hover:-translate-y-1 hover:shadow-2xl">
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-primary-container px-3 py-1 font-label-sm text-label-sm font-semibold uppercase tracking-wider text-on-primary">
                      Most Popular
                    </div>
                    <div>
                      <div className="mb-2 font-label-md text-label-md font-semibold uppercase tracking-wider text-primary">
                        Busy Salon & Spa
                      </div>
                      <p className="mb-6 font-body-sm text-body-sm text-text-secondary">
                        For salons and shops with 2–10 staff chairs needing simultaneous bookings.
                      </p>
                      <div className="mb-8 flex items-baseline gap-1">
                        <span className="font-headline-lg text-headline-lg font-bold text-text-primary">
                          ₦35,000
                        </span>
                        <span className="font-body-sm text-body-sm text-text-secondary">
                          / month
                        </span>
                      </div>
                      <ul className="mb-8 space-y-3 font-body-sm text-body-sm text-text-secondary">
                        <li className="flex items-center gap-2.5">
                          <AppIcon name="check" className="text-[18px] text-success" /> Multi-Staff
                          Roster & Chair Management
                        </li>
                        <li className="flex items-center gap-2.5">
                          <AppIcon name="check" className="text-[18px] text-success" /> Unlimited
                          WhatsApp & Web Conversations
                        </li>
                        <li className="flex items-center gap-2.5">
                          <AppIcon name="check" className="text-[18px] text-success" /> Live Human
                          Staff Takeover Inbox
                        </li>
                        <li className="flex items-center gap-2.5">
                          <AppIcon name="check" className="text-[18px] text-success" /> Automated
                          No-Show Deposit Collection
                        </li>
                        <li className="flex items-center gap-2.5">
                          <AppIcon name="check" className="text-[18px] text-success" /> Full
                          Analytics & Daily Revenue Reports
                        </li>
                      </ul>
                    </div>
                    <Link
                      href="/auth/signup?plan=growth"
                      className="w-full rounded bg-primary-container px-4 py-2.5 text-center font-label-md text-label-md text-on-primary shadow-md transition-colors hover:bg-primary"
                    >
                      Deploy Salon Plan
                    </Link>
                  </div>

                  <div className="flex flex-col justify-between rounded-xl border border-border bg-surface p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl">
                    <div>
                      <div className="mb-2 font-label-md text-label-md font-semibold uppercase tracking-wider text-text-primary">
                        Multi-Location Chain
                      </div>
                      <p className="mb-6 font-body-sm text-body-sm text-text-secondary">
                        For franchises, luxury chains, and multi-branch operations across Nigeria.
                      </p>
                      <div className="mb-8 flex items-baseline gap-1">
                        <span className="font-headline-lg text-headline-lg font-bold text-text-primary">
                          Custom
                        </span>
                        <span className="font-body-sm text-body-sm text-text-secondary">
                          / locations
                        </span>
                      </div>
                      <ul className="mb-8 space-y-3 font-body-sm text-body-sm text-text-secondary">
                        <li className="flex items-center gap-2.5">
                          <AppIcon name="check" className="text-[18px] text-success" /> Unlimited
                          branches and chairs
                        </li>
                        <li className="flex items-center gap-2.5">
                          <AppIcon name="check" className="text-[18px] text-success" /> Custom Kora
                          Sub-Account Split Payments
                        </li>
                        <li className="flex items-center gap-2.5">
                          <AppIcon name="check" className="text-[18px] text-success" /> Centralized
                          Chain Admin Dashboard
                        </li>
                        <li className="flex items-center gap-2.5">
                          <AppIcon name="check" className="text-[18px] text-success" /> Dedicated
                          WhatsApp Verified Business Onboarding
                        </li>
                        <li className="flex items-center gap-2.5">
                          <AppIcon name="check" className="text-[18px] text-success" /> 24/7 SLA &
                          Direct Account Manager
                        </li>
                      </ul>
                    </div>
                    <a
                      href="#demo"
                      className="w-full rounded border border-border px-4 py-2.5 text-center font-label-md text-label-md text-text-primary transition-colors hover:bg-surface-container"
                    >
                      Contact Enterprise Sales
                    </a>
                  </div>
                </div>
              </ScrollReveal>
            </div>
          </section>

          {/* SECTION 10: FAQ */}
          <section className="w-full border-t border-border bg-surface-container-low px-6 py-24 lg:px-12">
            <div className="mx-auto max-w-4xl">
              <ScrollReveal yOffset={30}>
                <div className="mb-16 text-center">
                  <span className="font-label-md text-label-md font-semibold uppercase tracking-wider text-primary">
                    Common Questions
                  </span>
                  <ScrollFloat
                    as="h2"
                    effect="float"
                    splitBy="words"
                    distance={30}
                    stretch={1.1}
                    scrollStart="top 90%"
                    scrollEnd="bottom 70%"
                    containerClassName="my-0"
                    textClassName="mt-2 font-headline-lg text-headline-lg tracking-tight text-text-primary"
                  >
                    Frequently Asked Questions
                  </ScrollFloat>
                </div>
              </ScrollReveal>

              <ScrollReveal staggerChildren staggerDelay={0.08} yOffset={24}>
                <div className="space-y-4">
                  <details
                    className="group rounded-lg border border-border bg-surface p-5 transition-all hover:shadow-md [&_summary::-webkit-details-marker]:hidden"
                    open
                  >
                    <summary className="flex cursor-pointer items-center justify-between font-headline-sm text-headline-sm text-text-primary">
                      <span>
                        How does Switchboard prevent double-booking when multiple customers book at
                        once?
                      </span>
                      <AppIcon
                        name="expand_more"
                        className="text-text-secondary transition-transform group-open:rotate-180"
                      />
                    </summary>
                    <p className="mt-4 border-t border-border pt-4 font-body-md text-body-md text-text-secondary">
                      Unlike standard booking apps that check availability in application code,
                      Switchboard enforces concurrency at the PostgreSQL engine level using an
                      exclusion constraint (
                      <code className="rounded bg-primary/10 px-1 py-0.5 font-mono text-xs text-primary">
                        EXCLUDE USING gist
                      </code>
                      ). When a customer starts booking, the slot is held for 15 minutes. If 50
                      people ask for the exact same time at the exact same millisecond, the database
                      mathematically guarantees exactly 1 hold winner while immediately offering
                      alternative slots to others.
                    </p>
                  </details>

                  <details className="group rounded-lg border border-border bg-surface p-5 transition-all hover:shadow-md [&_summary::-webkit-details-marker]:hidden">
                    <summary className="flex cursor-pointer items-center justify-between font-headline-sm text-headline-sm text-text-primary">
                      <span>How do Kora deposits work, and how does that stop no-shows?</span>
                      <AppIcon
                        name="expand_more"
                        className="text-text-secondary transition-transform group-open:rotate-180"
                      />
                    </summary>
                    <p className="mt-4 border-t border-border pt-4 font-body-md text-body-md text-text-secondary">
                      When a customer selects a slot on WhatsApp or web, Switchboard generates a
                      unique Kora bank transfer deposit link or account. The customer transfers the
                      commitment deposit (e.g. ₦3,000). The moment Kora verifies the payment, the
                      slot locks as confirmed. If no payment arrives within 15 minutes, the hold
                      expires and the slot returns to your calendar. Customers who put down a
                      deposit show up on time 98% of the time.
                    </p>
                  </details>

                  <details className="group rounded-lg border border-border bg-surface p-5 transition-all hover:shadow-md [&_summary::-webkit-details-marker]:hidden">
                    <summary className="flex cursor-pointer items-center justify-between font-headline-sm text-headline-sm text-text-primary">
                      <span>
                        Can my staff or I take over a chat if a customer has a unique question?
                      </span>
                      <AppIcon
                        name="expand_more"
                        className="text-text-secondary transition-transform group-open:rotate-180"
                      />
                    </summary>
                    <p className="mt-4 border-t border-border pt-4 font-body-md text-body-md text-text-secondary">
                      Yes. The Switchboard business dashboard has a live inbox. At any moment, you
                      can hit &ldquo;Take over conversation&rdquo;. The AI assistant immediately
                      steps back and lets you reply directly to the customer on WhatsApp. You can
                      also hand it back to the assistant whenever you want.
                    </p>
                  </details>

                  <details className="group rounded-lg border border-border bg-surface p-5 transition-all hover:shadow-md [&_summary::-webkit-details-marker]:hidden">
                    <summary className="flex cursor-pointer items-center justify-between font-headline-sm text-headline-sm text-text-primary">
                      <span>
                        Does Switchboard work with Nigerian WhatsApp numbers and local bank
                        transfers?
                      </span>
                      <AppIcon
                        name="expand_more"
                        className="text-text-secondary transition-transform group-open:rotate-180"
                      />
                    </summary>
                    <p className="mt-4 border-t border-border pt-4 font-body-md text-body-md text-text-secondary">
                      Yes, Switchboard is purpose-built for Nigeria. It connects to the official
                      Meta WhatsApp Cloud API and uses Kora for local bank transfers, debit cards,
                      and USSD. It understands local Nigerian business context, service menus, and
                      conversational style.
                    </p>
                  </details>

                  <details className="group rounded-lg border border-border bg-surface p-5 transition-all hover:shadow-md [&_summary::-webkit-details-marker]:hidden">
                    <summary className="flex cursor-pointer items-center justify-between font-headline-sm text-headline-sm text-text-primary">
                      <span>What happens if the customer cancels or reschedules?</span>
                      <AppIcon
                        name="expand_more"
                        className="text-text-secondary transition-transform group-open:rotate-180"
                      />
                    </summary>
                    <p className="mt-4 border-t border-border pt-4 font-body-md text-body-md text-text-secondary">
                      Depending on your cancellation policy (e.g. at least 2 hours in advance), the
                      customer can reschedule directly over WhatsApp without losing their deposit.
                      For eligible refunds, Switchboard can initiate a Kora payout refund back to
                      the customer&apos;s bank account with owner approval.
                    </p>
                  </details>

                  <details className="group rounded-lg border border-border bg-surface p-5 transition-all hover:shadow-md [&_summary::-webkit-details-marker]:hidden">
                    <summary className="flex cursor-pointer items-center justify-between font-headline-sm text-headline-sm text-text-primary">
                      <span>How fast can our barbershop or salon get set up?</span>
                      <AppIcon
                        name="expand_more"
                        className="text-text-secondary transition-transform group-open:rotate-180"
                      />
                    </summary>
                    <p className="mt-4 border-t border-border pt-4 font-body-md text-body-md text-text-secondary">
                      Setup takes less than 15 minutes. Enter your business name, operating hours,
                      staff list, and service prices. You immediately get a public booking link and
                      can connect your WhatsApp number to start taking verified bookings right away.
                    </p>
                  </details>
                </div>
              </ScrollReveal>
            </div>
          </section>

          {/* SECTION 11: FINAL CTA */}
          <section
            id="demo"
            className="scroll-mt-16 relative w-full overflow-hidden border-t border-surface/10 bg-midnight-hero px-5 sm:px-8 py-20 sm:py-24 lg:py-28 text-on-primary lg:px-12"
          >
            <div className="pointer-events-none absolute bottom-0 left-1/2 h-[350px] w-[700px] -translate-x-1/2 rounded-full bg-primary-container/20 blur-[140px]" />
            <div className="relative mx-auto flex max-w-5xl flex-col items-center text-center">
              <ScrollReveal yOffset={20}>
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-surface/10 bg-surface/5 px-3 py-1">
                  <span className="h-2 w-2 rounded-full bg-success" />
                  <span className="font-label-sm text-label-sm text-secondary-fixed-dim">
                    Instant Deployment Active
                  </span>
                </div>
              </ScrollReveal>

              <div className="mb-6 max-w-4xl">
                <ScrollFloat
                  as="h2"
                  effect="float"
                  splitBy="words"
                  distance={40}
                  stretch={1.15}
                  scrollStart="top 95%"
                  scrollEnd="bottom 65%"
                  containerClassName="my-0"
                  textClassName="font-display-hero text-display-hero-mobile tracking-tight text-on-primary lg:text-display-hero inline-block leading-tight"
                >
                  Every customer deserves an answer. Every slot deserves a deposit.
                </ScrollFloat>
              </div>

              <ScrollReveal delay={0.2} duration={0.8} yOffset={24}>
                <p className="mb-10 max-w-2xl text-balance font-body-lg text-body-lg text-secondary-fixed-dim">
                  Stop letting missed chats and no-shows eat into your weekly revenue. Deploy your
                  custom Switchboard assistant today and fill your chairs with guaranteed bookings.
                </p>
              </ScrollReveal>

              <ScrollReveal delay={0.3} duration={0.8} yOffset={20}>
                <div className="flex w-full flex-col items-center justify-center gap-4 sm:w-auto sm:flex-row">
                  <Link
                    href="/auth/signup"
                    className="inline-flex w-full items-center justify-center gap-2 rounded bg-primary-container px-8 py-4 font-headline-sm text-[16px] text-on-primary shadow-xl shadow-primary-container/25 transition-all hover:bg-primary sm:w-auto"
                  >
                    <span>Build your AI front desk</span>
                    <AppIcon name="arrow_forward" className="text-[20px]" />
                  </Link>
                  <Link
                    href="/b/fade-republic"
                    className="inline-flex w-full items-center justify-center gap-2 rounded border border-surface/10 bg-surface/10 px-8 py-4 font-headline-sm text-[16px] text-on-primary backdrop-blur-md transition-all hover:bg-surface/15 sm:w-auto"
                  >
                    <AppIcon name="calendar_today" className="text-[20px]" />
                    <span>View live booking demo</span>
                  </Link>
                </div>
              </ScrollReveal>

              {/* Trust Badges Under CTA */}
              <ScrollReveal delay={0.4} duration={0.8} yOffset={20}>
                <div className="mt-16 flex w-full flex-wrap items-center justify-center gap-8 border-t border-surface/10 pt-10 font-metric-sm text-metric-sm text-secondary-fixed-dim">
                  <div className="flex items-center gap-2">
                    <AppIcon name="verified" className="text-[18px] text-success" />
                    <span>Postgres GIST Invariant Enforced</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <AppIcon name="shield" className="text-[18px] text-success" />
                    <span>Kora Re-Verified Webhooks</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <AppIcon name="bolt" className="text-[18px] text-success" />
                    <span>99.99% Uptime Engine</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <AppIcon name="lock" className="text-[18px] text-success" />
                    <span>Zero Hallucination Protocol</span>
                  </div>
                </div>
              </ScrollReveal>
            </div>
          </section>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="w-full bg-midnight-hero text-secondary-fixed-dim">
        <div className="mx-auto max-w-7xl px-6 pb-12 pt-16 lg:px-12">
          <div className="mb-12 grid grid-cols-2 gap-8 md:grid-cols-5">
            <div className="col-span-2">
              <div className="mb-4">
                <SwitchboardLogo href="/" size="sm" theme="dark" />
              </div>
              <p className="mb-6 max-w-sm font-body-sm text-body-sm text-secondary-fixed-dim">
                The autonomous booking orchestration fabric for salons and barbers. Precision slot
                locks, Kora deposits, and never a confirmed booking without proof.
              </p>
              <div className="inline-flex items-center gap-2 rounded-full bg-surface/5 px-3 py-1.5">
                <span className="h-2 w-2 animate-pulse rounded-full bg-success" />
                <span className="font-metric-sm text-metric-sm text-on-primary">
                  Systems Operational
                </span>
              </div>
            </div>

            <div>
              <h4 className="mb-4 font-label-md text-label-md uppercase tracking-wider text-on-primary">
                Product
              </h4>
              <ul className="space-y-2.5 font-body-sm text-body-sm">
                <li>
                  <a href="#product" className="transition-colors hover:text-on-primary">
                    Booking Engine
                  </a>
                </li>
                <li>
                  <a href="#how-it-works" className="transition-colors hover:text-on-primary">
                    Kora Deposits
                  </a>
                </li>
                <li>
                  <a href="#solutions" className="transition-colors hover:text-on-primary">
                    WhatsApp AI Agent
                  </a>
                </li>
                <li>
                  <a href="#safety" className="transition-colors hover:text-on-primary">
                    Concurrency Guarantees
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="mb-4 font-label-md text-label-md uppercase tracking-wider text-on-primary">
                Solutions
              </h4>
              <ul className="space-y-2.5 font-body-sm text-body-sm">
                <li>
                  <a href="#solutions" className="transition-colors hover:text-on-primary">
                    Barbershops & Lounges
                  </a>
                </li>
                <li>
                  <a href="#solutions" className="transition-colors hover:text-on-primary">
                    Hair & Braiding Salons
                  </a>
                </li>
                <li>
                  <a href="#solutions" className="transition-colors hover:text-on-primary">
                    Beauty & Aesthetic Spas
                  </a>
                </li>
                <li>
                  <a href="#solutions" className="transition-colors hover:text-on-primary">
                    Multi-Location Chains
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="mb-4 font-label-md text-label-md uppercase tracking-wider text-on-primary">
                Company
              </h4>
              <ul className="space-y-2.5 font-body-sm text-body-sm">
                <li>
                  <a href="#how-it-works" className="transition-colors hover:text-on-primary">
                    About Us
                  </a>
                </li>
                <li>
                  <a href="#safety" className="transition-colors hover:text-on-primary">
                    Security & Trust
                  </a>
                </li>
                <li>
                  <a href="#safety" className="transition-colors hover:text-on-primary">
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a href="#safety" className="transition-colors hover:text-on-primary">
                    Terms of Service
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col items-center justify-between gap-4 border-t border-surface/10 pt-8 font-metric-sm text-metric-sm sm:flex-row">
            <p className="text-secondary-fixed-dim">
              © 2026 Switchboard Technologies. Built for Korabytes Challenge.
            </p>
            <div className="flex items-center gap-6 text-secondary-fixed-dim">
              <span>Postgres GIST Invariant</span>
              <span>Status: 99.99% Uptime</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
