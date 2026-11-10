'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppIcon } from '@/components/AppIcon';
import { SwitchboardLogo } from '@/components/SwitchboardLogo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export type BusinessCategory = 'barber' | 'beauty' | 'auto' | 'property';

export interface ServiceItem {
  id: string;
  name: string;
  duration: number; // minutes
  price: number; // in Naira
  depositRequired: boolean;
  depositAmount: number; // in Naira
  description: string;
}

export interface StaffItem {
  id: string;
  name: string;
  role: string;
}

export interface DaySchedule {
  open: boolean;
  openTime: string;
  closeTime: string;
}

export interface CapabilityItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  badge?: string;
  enabled: boolean;
}

export interface OnboardingState {
  // Step 1: Business details
  businessName: string;
  category: BusinessCategory;
  phone: string;
  location: string;
  country: string;
  timezone: string;
  instagramOrWeb: string;

  // Step 2: Services & staff
  services: ServiceItem[];
  staff: StaffItem[];
  selfProvided: boolean;

  // Step 3: Working hours
  schedule: Record<string, DaySchedule>;
  advanceDays: number;
  allowSameDay: boolean;

  // Step 4: Deposits & Kora
  depositRequired: boolean;
  depositType: 'fixed' | 'percentage';
  depositAmount: number;
  cancellationPolicy: string;
  koraStatus: 'ready' | 'pending';

  // Step 5: AI receptionist & goals
  assistantName: string;
  greeting: string;
  tone: 'Friendly' | 'Professional' | 'Casual';
  capabilities: CapabilityItem[];

  // Step 6: Review & launch
  slug: string;
}

const CATEGORY_PRESETS: Record<
  BusinessCategory,
  { label: string; sub: string; icon: string; defaultServices: ServiceItem[] }
> = {
  barber: {
    label: 'Salon & Barbershop',
    sub: 'Haircuts, fades, styling & grooming',
    icon: 'content_cut',
    defaultServices: [
      {
        id: '1',
        name: 'Classic Fade & Beard Sculpt',
        duration: 45,
        price: 5000,
        depositRequired: true,
        depositAmount: 1500,
        description: 'Detailed razor fade, hot towel prep & beard oil.',
      },
      {
        id: '2',
        name: 'Standard Haircut',
        duration: 30,
        price: 3500,
        depositRequired: true,
        depositAmount: 1000,
        description: 'Clean clipper cut and sharp perimeter line-up.',
      },
      {
        id: '3',
        name: 'VIP Dreadlocks Retwist & Wash',
        duration: 90,
        price: 15000,
        depositRequired: true,
        depositAmount: 5000,
        description: 'Organic shampoo wash & deep palm-roll retwist.',
      },
    ],
  },
  beauty: {
    label: 'Beauty & Wellness',
    sub: 'Spa, lashes, nails & massage',
    icon: 'spa',
    defaultServices: [
      {
        id: '1',
        name: 'Signature Gel Manicure & Pedicure',
        duration: 60,
        price: 12000,
        depositRequired: true,
        depositAmount: 3000,
        description: 'Cuticle care, scrub, and chip-free gel polish.',
      },
      {
        id: '2',
        name: 'Deep Tissue Tension Massage',
        duration: 60,
        price: 20000,
        depositRequired: true,
        depositAmount: 5000,
        description: 'Targeted muscle relief with aromatherapy oils.',
      },
      {
        id: '3',
        name: 'Custom Glow Facial',
        duration: 75,
        price: 18000,
        depositRequired: true,
        depositAmount: 5000,
        description: 'Ultrasonic extraction and hydrating vitamin C mask.',
      },
    ],
  },
  auto: {
    label: 'Auto Services',
    sub: 'Diagnostics, detailing & car care',
    icon: 'directions_car',
    defaultServices: [
      {
        id: '1',
        name: 'Full Computer Diagnostics',
        duration: 45,
        price: 10000,
        depositRequired: true,
        depositAmount: 3000,
        description: 'OBD-II live telemetry scan & system check.',
      },
      {
        id: '2',
        name: 'Executive Detailing & Ceramic Wash',
        duration: 120,
        price: 25000,
        depositRequired: true,
        depositAmount: 8000,
        description: 'Deep interior steam clean & hydrophobic coat.',
      },
    ],
  },
  property: {
    label: 'Property & Consultations',
    sub: 'Guided viewings, tours & sessions',
    icon: 'apartment',
    defaultServices: [
      {
        id: '1',
        name: 'Guided Property Inspection',
        duration: 45,
        price: 5000,
        depositRequired: true,
        depositAmount: 2000,
        description: 'Private in-person viewing of units and compound.',
      },
      {
        id: '2',
        name: 'Commercial Space Walkthrough',
        duration: 60,
        price: 8000,
        depositRequired: true,
        depositAmount: 3000,
        description: 'Floorplan review, power audit & parking tour.',
      },
    ],
  },
};

const DEFAULT_SCHEDULE: Record<string, DaySchedule> = {
  Monday: { open: true, openTime: '09:00', closeTime: '19:00' },
  Tuesday: { open: true, openTime: '09:00', closeTime: '19:00' },
  Wednesday: { open: true, openTime: '09:00', closeTime: '19:00' },
  Thursday: { open: true, openTime: '09:00', closeTime: '19:00' },
  Friday: { open: true, openTime: '09:00', closeTime: '20:00' },
  Saturday: { open: true, openTime: '09:00', closeTime: '20:00' },
  Sunday: { open: false, openTime: '12:00', closeTime: '18:00' },
};

const DEFAULT_CAPABILITIES: CapabilityItem[] = [
  {
    id: 'questions',
    title: 'Answer customer questions',
    description: 'Instant replies on services, pricing, shop location & walk-in policies.',
    icon: 'forum',
    enabled: true,
  },
  {
    id: 'appointments',
    title: 'Manage appointments',
    description: 'Two-way sync with staff availability, 15-minute holds & reminders.',
    icon: 'calendar_month',
    enabled: true,
  },
  {
    id: 'payments',
    title: 'Support customer payments',
    description: 'Secure deposit collection, bank transfer checkout links & refunds.',
    icon: 'payments',
    badge: 'VIA KORA',
    enabled: true,
  },
  {
    id: 'leads',
    title: 'Capture customer leads',
    description: 'Save WhatsApp & web visitor details directly to your customer list.',
    icon: 'person_add',
    enabled: true,
  },
  {
    id: 'support',
    title: 'Escalate to human staff',
    description: 'Hand over complex inquiries or special requests with full chat context.',
    icon: 'support_agent',
    enabled: false,
  },
];

const INITIAL_STATE: OnboardingState = {
  businessName: 'Fade Republic',
  category: 'barber',
  phone: '+234 803 123 4567',
  location: 'KM 10 Idiroko Road, Ota, Ogun State',
  country: 'Nigeria (NG)',
  timezone: 'Africa/Lagos (GMT+1)',
  instagramOrWeb: 'https://faderepublic.ng',
  services: CATEGORY_PRESETS.barber.defaultServices,
  staff: [
    { id: '1', name: 'Tunde Adeyemi', role: 'Lead Barber' },
    { id: '2', name: 'Emeka Okafor', role: 'Fade Specialist' },
  ],
  selfProvided: false,
  schedule: DEFAULT_SCHEDULE,
  advanceDays: 14,
  allowSameDay: true,
  depositRequired: true,
  depositType: 'fixed',
  depositAmount: 1500,
  cancellationPolicy: 'Full refund if cancelled at least 4 hours before your scheduled slot.',
  koraStatus: 'ready',
  assistantName: 'Maya',
  greeting:
    "Hi! Welcome to Fade Republic. I'm Maya, your booking assistant. Which service or barber would you like to book today?",
  tone: 'Friendly',
  capabilities: DEFAULT_CAPABILITIES,
  slug: 'fade-republic',
};

const STEPS = [
  {
    id: 1,
    eyebrow: 'YOUR BUSINESS',
    label: 'Your Business',
    desc: 'Shop identity & contact details',
    title: 'Tell us about your business',
    subtitle:
      'Provide foundational information so your AI assistant knows who it represents and how to handle customer inquiries accurately.',
  },
  {
    id: 2,
    eyebrow: 'SERVICES & STAFF',
    label: 'Services & Staff',
    desc: 'What customers can book',
    title: 'What services do you offer?',
    subtitle:
      'Review or customize the services customers can book and the team members who provide them.',
  },
  {
    id: 3,
    eyebrow: 'WORKING HOURS',
    label: 'Working Hours',
    desc: 'Your appointment availability',
    title: 'When are you open for bookings?',
    subtitle:
      'Set your weekly opening hours so Switchboard only offers real, conflict-free appointment slots.',
  },
  {
    id: 4,
    eyebrow: 'BOOKING & DEPOSITS',
    label: 'Booking & Deposits',
    desc: '15-min hold & Kora deposit',
    title: 'How should bookings be confirmed?',
    subtitle:
      'Stop no-shows by holding slots for 15 minutes while customers complete a verified Kora deposit.',
  },
  {
    id: 5,
    eyebrow: 'YOUR GOALS',
    label: 'AI Receptionist',
    desc: 'Capabilities, greeting & tone',
    title: 'What should Switchboard handle?',
    subtitle:
      'Select all key tasks your autonomous assistant will orchestrate on WhatsApp and web chat.',
  },
  {
    id: 6,
    eyebrow: 'REVIEW & LAUNCH',
    label: 'Review & Activate',
    desc: 'Verify setup and launch',
    title: 'Your business is ready to launch',
    subtitle:
      'Review your configuration, test a safe simulated booking, and activate your front desk.',
  },
] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [state, setState] = useState<OnboardingState>(INITIAL_STATE);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testTimer, setTestTimer] = useState(900);
  const [copiedLink, setCopiedLink] = useState(false);

  // Restore draft from localStorage & hydrate from database (/api/workspace)
  useEffect(() => {
    try {
      const saved = localStorage.getItem('switchboard_onboarding_draft');
      if (saved) {
        const parsed = JSON.parse(saved);
        setState((prev) => ({
          ...prev,
          ...parsed,
          capabilities: parsed.capabilities || DEFAULT_CAPABILITIES,
        }));
      }
    } catch {
      // ignore
    }

    let active = true;
    fetch('/api/workspace')
      .then((res) => res.json())
      .then((data) => {
        if (!active || !data?.ok) return;
        if (data.user?.email) {
          setVerifiedEmail(data.user.email);
        }
        if (data.business) {
          const b = data.business;
          setState((prev) => {
            const next: OnboardingState = {
              ...prev,
              businessName: b.businessName || b.name || prev.businessName,
              slug: b.slug || prev.slug,
              category: b.category || prev.category,
              phone: b.phone || prev.phone,
              location: b.location || prev.location,
              country: b.country || prev.country,
              timezone: b.timezoneLabel || prev.timezone,
              instagramOrWeb: b.instagramOrWeb ?? prev.instagramOrWeb,
              selfProvided: b.selfProvided ?? prev.selfProvided,
              schedule: b.schedule || prev.schedule,
              advanceDays: b.advanceDays ?? prev.advanceDays,
              allowSameDay: b.allowSameDay ?? prev.allowSameDay,
              depositRequired: b.depositRequired ?? prev.depositRequired,
              depositType: b.depositType || prev.depositType,
              depositAmount: b.depositAmount ?? prev.depositAmount,
              cancellationPolicy: b.cancellationPolicy || prev.cancellationPolicy,
              koraStatus: b.koraStatus || prev.koraStatus,
              assistantName: b.assistantName || prev.assistantName,
              greeting: b.greeting || prev.greeting,
              tone: b.tone || prev.tone,
              capabilities:
                Array.isArray(b.capabilities) && b.capabilities.length > 0
                  ? b.capabilities
                  : prev.capabilities,
              services:
                Array.isArray(data.services) && data.services.length > 0
                  ? data.services
                  : prev.services,
              staff: Array.isArray(data.staff) && data.staff.length > 0 ? data.staff : prev.staff,
            };
            try {
              localStorage.setItem('switchboard_onboarding_draft', JSON.stringify(next));
            } catch {
              // ignore
            }
            return next;
          });
        }
      })
      .catch(() => {
        // Keep local draft when offline
      });

    return () => {
      active = false;
    };
  }, []);

  const persistToDatabase = async (
    payload: OnboardingState,
    onboardingCompleted: boolean,
  ): Promise<boolean> => {
    setSaveStatus('saving');
    try {
      const res = await fetch('/api/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: payload.businessName,
          name: payload.businessName,
          slug: payload.slug,
          category: payload.category,
          vertical: payload.category === 'beauty' ? 'salon' : payload.category,
          phone: payload.phone,
          location: payload.location,
          country: payload.country,
          timezone: payload.timezone,
          instagramOrWeb: payload.instagramOrWeb,
          services: payload.services,
          staff: payload.staff,
          selfProvided: payload.selfProvided,
          schedule: payload.schedule,
          advanceDays: payload.advanceDays,
          allowSameDay: payload.allowSameDay,
          depositRequired: payload.depositRequired,
          depositType: payload.depositType,
          depositAmount: payload.depositAmount,
          cancellationPolicy: payload.cancellationPolicy,
          koraStatus: payload.koraStatus,
          assistantName: payload.assistantName,
          greeting: payload.greeting,
          tone: payload.tone,
          capabilities: payload.capabilities,
          agentEnabled: true,
          onboardingCompleted,
        }),
      });
      if (!res.ok) {
        setSaveStatus('error');
        return false;
      }
      setSaveStatus('saved');
      return true;
    } catch {
      setSaveStatus('error');
      return false;
    }
  };

  // Autosave
  const updateState = (
    updater: Partial<OnboardingState> | ((prev: OnboardingState) => OnboardingState),
  ) => {
    setSaveStatus('saving');
    setState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
      try {
        localStorage.setItem('switchboard_onboarding_draft', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
    setTimeout(() => {
      setSaveStatus('saved');
    }, 300);
  };

  // Test countdown timer
  useEffect(() => {
    if (!testModalOpen) return;
    const interval = setInterval(() => {
      setTestTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [testModalOpen]);

  const handleCategorySelect = (category: BusinessCategory) => {
    const meta = CATEGORY_PRESETS[category];
    updateState({
      category,
      services: meta.defaultServices,
    });
  };

  const toggleCapability = (id: string) => {
    updateState((prev) => ({
      ...prev,
      capabilities: prev.capabilities.map((cap) =>
        cap.id === id ? { ...cap, enabled: !cap.enabled } : cap,
      ),
    }));
  };

  const validateStep = (step: number): boolean => {
    const stepErrors: Record<string, string> = {};
    if (step === 1) {
      if (!state.businessName.trim()) {
        stepErrors.businessName = 'Please enter your business name';
      }
      if (!state.phone.trim()) {
        stepErrors.phone = 'Please enter your phone number';
      }
    } else if (step === 2) {
      if (state.services.length === 0) {
        stepErrors.services = 'Please keep at least one bookable service.';
      }
    }
    setErrors(stepErrors);
    return Object.keys(stepErrors).length === 0;
  };

  const handleContinue = async () => {
    if (!validateStep(currentStep) || isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (currentStep < 6) {
        await persistToDatabase(state, false);
        setCurrentStep((prev) => prev + 1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        await persistToDatabase(state, true);
        router.push('/dashboard');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const activeStepMeta = STEPS[currentStep - 1] ?? STEPS[0];
  const bookingUrl = `https://switchboard-bm.vercel.app/b/${state.slug}`;

  return (
    <div className="relative min-h-screen bg-linear-to-br from-[#F7F8FE] via-[#F2F4FC] to-[#FFFDF8] font-sans text-[#0C1233] antialiased flex flex-col justify-between selection:bg-[#6258E8] selection:text-white overflow-x-hidden">
      {/* Ambient Logo-Harmonized Gradient Glows */}
      <div className="pointer-events-none fixed -top-28 -left-28 w-96 h-96 rounded-full bg-[#181F63]/7 blur-3xl" />
      <div className="pointer-events-none fixed top-1/4 -right-28 w-96 h-96 rounded-full bg-[#F59E0B]/8 blur-3xl" />

      {/* =====================================================================
          DESKTOP HEADER (>= lg)
      ===================================================================== */}
      <header className="hidden lg:block w-full py-5 px-6 relative z-20">
        <div className="max-w-[1140px] mx-auto flex items-center justify-between">
          <SwitchboardLogo href="/" size="md" theme="light" />

          <div className="flex items-center gap-2.5">
            {verifiedEmail && (
              <Badge
                variant="secondary"
                className="px-3 py-1 rounded-full font-mono text-xs text-emerald-700 bg-emerald-50 border border-emerald-200"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                Verified · {verifiedEmail}
              </Badge>
            )}
            <Badge variant="default" className="px-3.5 py-1 rounded-full font-mono text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
              Workspace Setup · Step 0{currentStep}/06
            </Badge>
            <Badge variant="secondary" className="font-mono text-xs">
              v2.4
            </Badge>
          </div>
        </div>
      </header>

      {/* =====================================================================
          MOBILE HEADER (< lg) — Clean Glassmorphic Top Bar (No Account Icon)
      ===================================================================== */}
      <header className="lg:hidden w-full bg-white/85 backdrop-blur-md border-b border-slate-200/75 sticky top-0 z-30 transition-all">
        <div className="px-5 py-3.5 flex items-center justify-between">
          <SwitchboardLogo href="/" size="sm" theme="light" />

          <div className="flex items-center gap-2">
            <Badge
              variant="default"
              className="px-3.5 py-1 rounded-full font-semibold text-xs shadow-2xs transition-all duration-200 active:scale-95"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B] animate-pulse" />
              Step {currentStep} of 6
            </Badge>
          </div>
        </div>
      </header>

      {/* =====================================================================
          MAIN CONTAINER (Responsive Mobile Single-Col / Desktop Split Card)
      ===================================================================== */}
      <main className="relative z-10 w-full flex-1 flex items-start lg:items-center justify-center px-0 lg:px-6 py-0 lg:py-3">
        <div className="w-full max-w-[1140px] bg-white/95 backdrop-blur-xs lg:rounded-3xl lg:border lg:border-slate-200/85 lg:shadow-[0_12px_40px_-12px_rgba(12,18,51,0.08)] overflow-hidden flex flex-col lg:flex-row lg:min-h-[680px]">
          {/* -----------------------------------------------------------------
              LEFT PERSISTENT SIDEBAR (Desktop Only >= lg)
          ----------------------------------------------------------------- */}
          <aside className="hidden lg:flex lg:w-[34%] bg-linear-to-b from-[#F4F6FC] via-[#F2F3F8] to-[#FAF8F5] p-8 border-r border-slate-200/80 flex-col justify-between">
            <div className="space-y-7">
              <div className="space-y-1">
                <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold block">
                  Onboarding Wizard
                </span>
                <h1 className="text-2xl font-bold text-[#111827] tracking-tight">Get Started</h1>
                <p className="text-sm text-slate-500">
                  Configure your orchestration engine in 6 quick stages.
                </p>
              </div>

              {/* Vertical Stepper */}
              <nav aria-label="Onboarding Progress" className="relative flex flex-col gap-6 py-1">
                <div className="absolute left-[17px] top-4 bottom-4 w-[2px] bg-slate-200/90 z-0" />

                {STEPS.map((step) => {
                  const isActive = currentStep === step.id;
                  const isDone = currentStep > step.id;

                  return (
                    <button
                      key={step.id}
                      type="button"
                      onClick={() => {
                        if (isDone || step.id <= currentStep) {
                          setCurrentStep(step.id);
                        }
                      }}
                      className="group relative z-10 flex items-start gap-4 text-left transition-opacity cursor-pointer"
                    >
                      <span
                        className={`w-9 h-9 rounded-full text-xs font-mono font-semibold flex items-center justify-center shrink-0 transition-all ${
                          isActive
                            ? 'bg-[#6258E8] text-white shadow-sm ring-4 ring-[#6258E8]/15'
                            : isDone
                              ? 'bg-[#10B981] text-white'
                              : 'border border-slate-300 bg-white text-slate-500 group-hover:border-[#6258E8] group-hover:text-[#6258E8]'
                        }`}
                      >
                        {isDone ? <AppIcon name="check" className="text-[18px]" /> : `0${step.id}`}
                      </span>

                      <div className="space-y-0.5 pt-0.5">
                        <div
                          className={`text-[15px] font-semibold transition-colors ${
                            isActive
                              ? 'text-[#6258E8]'
                              : 'text-[#111827] group-hover:text-[#6258E8]'
                          }`}
                        >
                          {step.label}
                        </div>
                        <div className="text-[13px] text-slate-500">{step.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Sidebar Engine Status */}
            <div className="pt-6 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <span className="font-medium">Switchboard Engine</span>
              <span className="text-xs font-mono font-semibold text-[#10B981] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#10B981] inline-block animate-pulse" />
                Live
              </span>
            </div>
          </aside>

          {/* -----------------------------------------------------------------
              RIGHT CONTENT PANEL (Mobile Full-Width / Desktop 66%)
          ----------------------------------------------------------------- */}
          <section className="w-full lg:w-[66%] flex flex-col justify-between bg-white">
            <div className="px-5 py-6 sm:px-8 lg:p-9 flex-1 flex flex-col justify-between">
              <div key={currentStep} className="step-animated flex flex-col gap-6">
                {/* STEP HEADER (Responsive Mobile + Desktop) */}
                <div className="space-y-2 lg:border-b lg:border-slate-100 lg:pb-5">
                  {/* Top status line */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wider text-[#6258E8] font-bold">
                      Step 0{currentStep} of 06
                    </span>

                    <div className="flex items-center gap-1.5 lg:bg-[#f2f3f6] lg:px-3 lg:py-1 lg:rounded-full">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          saveStatus === 'saved'
                            ? 'bg-[#10B981]'
                            : saveStatus === 'error'
                              ? 'bg-[#ba1a1a]'
                              : 'bg-[#6258E8] animate-pulse'
                        }`}
                      />
                      <span className="text-xs font-mono text-slate-500">
                        {saveStatus === 'saved'
                          ? 'Saved to DB'
                          : saveStatus === 'error'
                            ? 'Draft saved locally'
                            : 'Saving...'}
                      </span>
                    </div>
                  </div>

                  {/* Mobile secondary segmented bar + Eyebrow */}
                  <div className="lg:hidden space-y-3 pt-1">
                    <div className="grid grid-cols-6 gap-1.5">
                      {STEPS.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          aria-label={`Go to step ${s.id}`}
                          onClick={() => {
                            if (s.id <= currentStep) setCurrentStep(s.id);
                          }}
                          className={`h-2 rounded-full transition-all duration-300 active:scale-95 ${
                            s.id < currentStep
                              ? 'bg-[#181F63]'
                              : s.id === currentStep
                                ? 'bg-linear-to-r from-[#181F63] via-[#6258E8] to-[#F59E0B]'
                                : 'bg-slate-200'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-xs uppercase tracking-wider text-[#6258E8] font-bold block pt-1">
                      {activeStepMeta.eyebrow}
                    </span>
                  </div>

                  <h2 className="text-2xl sm:text-[26px] font-bold text-[#111827] tracking-tight">
                    {activeStepMeta.title}
                  </h2>

                  <p className="text-[15px] text-slate-500 max-w-xl leading-relaxed">
                    {activeStepMeta.subtitle}
                  </p>
                </div>

                {/* =============================================================
                    STEP 1: YOUR BUSINESS
                ============================================================= */}
                {currentStep === 1 && (
                  <div className="space-y-5">
                    {/* Official Business Name */}
                    <div className="space-y-1.5">
                      <label
                        htmlFor="biz-name"
                        className="text-sm font-semibold text-[#111827] flex items-center justify-between"
                      >
                        <span>
                          Official Business Name <span className="text-[#ba1a1a]">*</span>
                        </span>
                        <span className="text-xs font-normal text-slate-500">
                          Public display name
                        </span>
                      </label>
                      <div className="relative rounded-xl shadow-xs">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <AppIcon name="domain" className="text-[20px]" />
                        </div>
                        <input
                          id="biz-name"
                          type="text"
                          value={state.businessName}
                          onChange={(e) => {
                            const name = e.target.value;
                            const slug =
                              name
                                .toLowerCase()
                                .replace(/[^a-z0-9]+/g, '-')
                                .replace(/(^-|-$)/g, '') || 'my-business';
                            updateState({ businessName: name, slug });
                          }}
                          placeholder="e.g. Fade Republic, Ota"
                          className={`w-full pl-10 pr-10 py-3 bg-white text-[#111827] text-[15px] font-medium rounded-xl border ${
                            errors.businessName
                              ? 'border-[#ba1a1a] ring-1 ring-[#ba1a1a]'
                              : 'border-slate-200'
                          } focus:ring-2 focus:ring-[#6258E8] focus:border-transparent outline-none transition-all`}
                        />
                        {state.businessName && (
                          <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-[#10B981]">
                            <AppIcon name="verified" className="text-[20px]" />
                          </div>
                        )}
                      </div>
                      {errors.businessName && (
                        <p className="text-xs text-[#ba1a1a] font-medium">{errors.businessName}</p>
                      )}
                    </div>

                    {/* Primary Business Category Cards (Tactile Mobile & Desktop Cards) */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-[#111827]">
                          Primary Business Category <span className="text-[#ba1a1a]">*</span>
                        </span>
                        <span className="text-xs text-slate-500 hidden sm:inline">
                          Loads tailored presets
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {(Object.keys(CATEGORY_PRESETS) as BusinessCategory[]).map((catKey) => {
                          const meta = CATEGORY_PRESETS[catKey];
                          const isSelected = state.category === catKey;

                          return (
                            <button
                              key={catKey}
                              type="button"
                              onClick={() => handleCategorySelect(catKey)}
                              className={`p-4 rounded-2xl border text-left flex items-start gap-3.5 transition-all relative cursor-pointer ${
                                isSelected
                                  ? 'border-[#6258E8]/40 ring-2 ring-[#6258E8] bg-[#f2f3f6]/90 shadow-xs'
                                  : 'border-slate-200/90 bg-white hover:bg-slate-50 shadow-xs'
                              }`}
                            >
                              <div
                                className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                                  isSelected
                                    ? 'bg-white text-[#6258E8]'
                                    : 'bg-slate-100 text-slate-500'
                                }`}
                              >
                                <AppIcon name={meta.icon} className="text-[22px]" />
                              </div>
                              <div className="flex-1 min-w-0 pr-8">
                                <p className="text-[15px] font-bold text-[#111827] truncate">
                                  {meta.label}
                                </p>
                                <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                                  {meta.sub}
                                </p>
                              </div>
                              <div
                                className={`w-6 h-6 rounded-full flex items-center justify-center absolute top-4 right-4 transition-colors ${
                                  isSelected
                                    ? 'bg-[#6258E8] text-white'
                                    : 'bg-slate-200/70 text-slate-400'
                                }`}
                              >
                                <AppIcon
                                  name={isSelected ? 'check' : 'add'}
                                  className="text-[15px]"
                                />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Country & Timezone */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label
                          htmlFor="biz-country"
                          className="text-sm font-semibold text-[#111827] block"
                        >
                          Country of Registry
                        </label>
                        <div className="relative rounded-xl shadow-xs">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                            <AppIcon name="public" className="text-[18px]" />
                          </div>
                          <select
                            id="biz-country"
                            value={state.country}
                            onChange={(e) => updateState({ country: e.target.value })}
                            className="w-full pl-10 pr-8 py-2.5 bg-white text-[#111827] text-sm font-medium rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#6258E8] outline-none appearance-none cursor-pointer"
                          >
                            <option value="Nigeria (NG)">Nigeria (NG)</option>
                            <option value="Ghana (GH)">Ghana (GH)</option>
                            <option value="Kenya (KE)">Kenya (KE)</option>
                          </select>
                          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                            <AppIcon name="expand_more" className="text-[18px]" />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label
                          htmlFor="biz-timezone"
                          className="text-sm font-semibold text-[#111827] block"
                        >
                          Operating Timezone
                        </label>
                        <div className="relative rounded-xl shadow-xs">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                            <AppIcon name="schedule" className="text-[18px]" />
                          </div>
                          <select
                            id="biz-timezone"
                            value={state.timezone}
                            onChange={(e) => updateState({ timezone: e.target.value })}
                            className="w-full pl-10 pr-8 py-2.5 bg-white text-[#111827] text-sm font-medium rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#6258E8] outline-none appearance-none cursor-pointer"
                          >
                            <option value="Africa/Lagos (GMT+1)">Africa/Lagos (GMT+1)</option>
                            <option value="Africa/Accra (GMT)">Africa/Accra (GMT)</option>
                            <option value="Africa/Nairobi (GMT+3)">Africa/Nairobi (GMT+3)</option>
                          </select>
                          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                            <AppIcon name="expand_more" className="text-[18px]" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Phone & Website/Address Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label
                            htmlFor="biz-phone"
                            className="text-sm font-semibold text-[#111827]"
                          >
                            WhatsApp / Phone <span className="text-[#ba1a1a]">*</span>
                          </label>
                          <span className="text-xs text-slate-500">Booking alerts</span>
                        </div>
                        <div className="relative rounded-xl shadow-xs">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                            <AppIcon name="call" className="text-[18px]" />
                          </div>
                          <input
                            id="biz-phone"
                            type="tel"
                            value={state.phone}
                            onChange={(e) => updateState({ phone: e.target.value })}
                            placeholder="+234 803 000 0000"
                            className={`w-full pl-10 pr-9 py-2.5 bg-white text-[#111827] text-sm font-mono rounded-xl border ${
                              errors.phone
                                ? 'border-[#ba1a1a] ring-1 ring-[#ba1a1a]'
                                : 'border-slate-200'
                            } focus:ring-2 focus:ring-[#6258E8] outline-none`}
                          />
                          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                            <AppIcon name="dialpad" className="text-[18px]" />
                          </div>
                        </div>
                        {errors.phone && (
                          <p className="text-xs text-[#ba1a1a] font-medium">{errors.phone}</p>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label
                            htmlFor="biz-location"
                            className="text-sm font-semibold text-[#111827]"
                          >
                            Shop Address
                          </label>
                          <span className="text-xs text-slate-500">Shared on booking</span>
                        </div>
                        <div className="relative rounded-xl shadow-xs">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                            <AppIcon name="location_on" className="text-[18px]" />
                          </div>
                          <input
                            id="biz-location"
                            type="text"
                            value={state.location}
                            onChange={(e) => updateState({ location: e.target.value })}
                            placeholder="e.g. KM 10 Idiroko Road, Ota"
                            className="w-full pl-10 pr-3 py-2.5 bg-white text-[#111827] text-sm rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#6258E8] outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Instagram / Website Row */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label
                          htmlFor="biz-website"
                          className="text-sm font-semibold text-[#111827]"
                        >
                          Instagram or Website Link
                        </label>
                        <span className="text-xs text-slate-500">Optional</span>
                      </div>
                      <div className="relative rounded-xl shadow-xs">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <AppIcon name="link" className="text-[18px]" />
                        </div>
                        <input
                          id="biz-website"
                          type="text"
                          value={state.instagramOrWeb}
                          onChange={(e) => updateState({ instagramOrWeb: e.target.value })}
                          placeholder="e.g. https://instagram.com/faderepublic or https://faderepublic.ng"
                          className="w-full pl-10 pr-3 py-2.5 bg-white text-[#111827] text-sm rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#6258E8] outline-none"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* =============================================================
                    STEP 2: SERVICES & STAFF
                ============================================================= */}
                {currentStep === 2 && (
                  <div className="space-y-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-bold text-[#111827]">Bookable Services</h3>
                        <p className="text-xs text-slate-500">
                          Prices in Nigerian Naira (₦) • Stored in integer kobo
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const newId = String(Date.now());
                          updateState((prev) => ({
                            ...prev,
                            services: [
                              ...prev.services,
                              {
                                id: newId,
                                name: 'Custom Service',
                                duration: 45,
                                price: 5000,
                                depositRequired: true,
                                depositAmount: 1500,
                                description: 'Appointment service.',
                              },
                            ],
                          }));
                        }}
                        className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-[#6258E8] hover:bg-slate-50 text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                      >
                        <AppIcon name="add" className="text-[16px]" />
                        Add Service
                      </button>
                    </div>

                    {errors.services && (
                      <p className="text-xs text-[#ba1a1a] font-medium">{errors.services}</p>
                    )}

                    {/* Tactile Service Cards */}
                    <div className="space-y-3">
                      {state.services.map((svc, idx) => (
                        <div
                          key={svc.id}
                          className="p-4 rounded-2xl border border-slate-200 bg-[#f2f3f6]/60 flex items-center gap-3.5 transition-all hover:border-[#6258E8]/40"
                        >
                          <div className="w-11 h-11 rounded-xl bg-white shadow-xs flex items-center justify-center text-[#6258E8] shrink-0">
                            <AppIcon
                              name={CATEGORY_PRESETS[state.category].icon}
                              className="text-[20px]"
                            />
                          </div>

                          <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                            <div className="sm:col-span-6">
                              <input
                                type="text"
                                value={svc.name}
                                aria-label="Service Name"
                                onChange={(e) => {
                                  const updated = [...state.services];
                                  if (updated[idx]) {
                                    updated[idx] = { ...updated[idx], name: e.target.value };
                                    updateState({ services: updated });
                                  }
                                }}
                                className="w-full bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-bold text-[#111827] focus:ring-2 focus:ring-[#6258E8] outline-none"
                              />
                            </div>

                            <div className="sm:col-span-3">
                              <select
                                value={svc.duration}
                                aria-label="Service Duration"
                                onChange={(e) => {
                                  const updated = [...state.services];
                                  if (updated[idx]) {
                                    updated[idx] = {
                                      ...updated[idx],
                                      duration: Number(e.target.value),
                                    };
                                    updateState({ services: updated });
                                  }
                                }}
                                className="w-full bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 outline-none cursor-pointer"
                              >
                                <option value={15}>15 mins</option>
                                <option value={30}>30 mins</option>
                                <option value={45}>45 mins</option>
                                <option value={60}>60 mins</option>
                                <option value={90}>90 mins</option>
                                <option value={120}>120 mins</option>
                              </select>
                            </div>

                            <div className="sm:col-span-3 flex items-center bg-white px-2.5 py-1.5 rounded-lg border border-slate-200">
                              <span className="text-xs font-bold text-slate-400 mr-1">₦</span>
                              <input
                                type="number"
                                step={500}
                                min={0}
                                value={svc.price}
                                aria-label="Service Price in Naira"
                                onChange={(e) => {
                                  const updated = [...state.services];
                                  if (updated[idx]) {
                                    updated[idx] = {
                                      ...updated[idx],
                                      price: Number(e.target.value),
                                    };
                                    updateState({ services: updated });
                                  }
                                }}
                                className="w-full text-sm font-bold text-[#111827] bg-transparent outline-none"
                              />
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              if (state.services.length > 1) {
                                updateState((prev) => ({
                                  ...prev,
                                  services: prev.services.filter((_, i) => i !== idx),
                                }));
                              }
                            }}
                            className="w-7 h-7 rounded-full bg-white text-slate-400 hover:text-[#ba1a1a] flex items-center justify-center shrink-0 shadow-xs"
                            title="Remove Service"
                          >
                            <AppIcon name="close" className="text-[16px]" />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Staff Providers Section */}
                    <div className="pt-3 border-t border-slate-100 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-[#111827]">
                            Bookable Staff Roster
                          </h3>
                          <p className="text-xs text-slate-500">
                            Each staff member gets conflict-free calendar protection
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const newId = String(Date.now());
                            updateState((prev) => ({
                              ...prev,
                              staff: [
                                ...prev.staff,
                                { id: newId, name: 'New Specialist', role: 'Staff Provider' },
                              ],
                            }));
                          }}
                          className="text-xs font-bold text-[#6258E8] hover:underline flex items-center gap-1"
                        >
                          <AppIcon name="person_add" className="text-[16px]" />
                          Add Staff
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {state.staff.map((member, idx) => (
                          <div
                            key={member.id}
                            className="p-3 rounded-xl border border-slate-200 bg-white flex items-center gap-3 shadow-xs"
                          >
                            <div className="w-9 h-9 rounded-full bg-[#6258E8]/10 text-[#6258E8] flex items-center justify-center font-bold text-xs shrink-0">
                              {member.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <input
                                type="text"
                                value={member.name}
                                aria-label="Staff Member Name"
                                onChange={(e) => {
                                  const updated = [...state.staff];
                                  if (updated[idx]) {
                                    updated[idx] = { ...updated[idx], name: e.target.value };
                                    updateState({ staff: updated });
                                  }
                                }}
                                className="w-full text-sm font-bold text-[#111827] outline-none truncate"
                              />
                              <input
                                type="text"
                                value={member.role}
                                aria-label="Staff Role Title"
                                onChange={(e) => {
                                  const updated = [...state.staff];
                                  if (updated[idx]) {
                                    updated[idx] = { ...updated[idx], role: e.target.value };
                                    updateState({ staff: updated });
                                  }
                                }}
                                className="w-full text-xs text-slate-500 outline-none truncate"
                              />
                            </div>
                            {state.staff.length > 1 ? (
                              <button
                                type="button"
                                onClick={() => {
                                  updateState((prev) => ({
                                    ...prev,
                                    staff: prev.staff.filter((_, i) => i !== idx),
                                  }));
                                }}
                                className="w-6 h-6 rounded-full bg-slate-100 text-slate-400 hover:text-[#ba1a1a] flex items-center justify-center shrink-0"
                                title="Remove Staff"
                              >
                                <AppIcon name="close" className="text-[14px]" />
                              </button>
                            ) : (
                              <span className="w-6 h-6 rounded-full bg-[#6258E8] text-white flex items-center justify-center shrink-0">
                                <AppIcon name="check" className="text-[14px]" />
                              </span>
                            )}
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => updateState({ selfProvided: !state.selfProvided })}
                        className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50/80 hover:bg-slate-100/70 flex items-center justify-between text-left transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <AppIcon name="person" className="text-[18px] text-[#6258E8]" />
                          <span className="text-xs font-semibold text-[#111827]">
                            I also personally take customer appointments as the owner
                          </span>
                        </div>
                        <span
                          className={`w-5 h-5 rounded-full flex items-center justify-center ${
                            state.selfProvided
                              ? 'bg-[#6258E8] text-white'
                              : 'bg-slate-200 text-slate-400'
                          }`}
                        >
                          <AppIcon
                            name={state.selfProvided ? 'check' : 'add'}
                            className="text-[13px]"
                          />
                        </span>
                      </button>
                    </div>
                  </div>
                )}

                {/* =============================================================
                    STEP 3: WORKING HOURS
                ============================================================= */}
                {currentStep === 3 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-sm font-semibold text-[#111827]">
                        Weekly Opening Schedule
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const mon = state.schedule.Monday;
                            if (!mon) return;
                            updateState((prev) => {
                              const updated = { ...prev.schedule };
                              ['Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].forEach(
                                (d) => {
                                  updated[d] = { ...mon };
                                },
                              );
                              return { ...prev, schedule: updated };
                            });
                          }}
                          className="px-3 py-1 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[#6258E8] transition-colors cursor-pointer"
                        >
                          Copy Mon to Mon–Sat
                        </button>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden bg-white shadow-xs">
                      {Object.entries(state.schedule).map(([day, sched]) => (
                        <div
                          key={day}
                          className="px-4 py-2.5 flex items-center justify-between gap-3"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              updateState((prev) => ({
                                ...prev,
                                schedule: {
                                  ...prev.schedule,
                                  [day]: { ...sched, open: !sched.open },
                                },
                              }));
                            }}
                            className="flex items-center gap-3 text-left cursor-pointer"
                          >
                            <span
                              className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                                sched.open
                                  ? 'bg-[#6258E8] text-white'
                                  : 'bg-slate-200 text-slate-400'
                              }`}
                            >
                              <AppIcon
                                name={sched.open ? 'check' : 'close'}
                                className="text-[14px]"
                              />
                            </span>
                            <span
                              className={`text-sm font-bold ${
                                sched.open ? 'text-[#111827]' : 'text-slate-400 line-through'
                              }`}
                            >
                              {day}
                            </span>
                          </button>

                          {sched.open ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="time"
                                value={sched.openTime}
                                aria-label={`${day} opening time`}
                                onChange={(e) => {
                                  updateState((prev) => ({
                                    ...prev,
                                    schedule: {
                                      ...prev.schedule,
                                      [day]: { ...sched, openTime: e.target.value },
                                    },
                                  }));
                                }}
                                className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 bg-slate-50 text-[#111827] font-mono font-semibold outline-none"
                              />
                              <span className="text-slate-400 text-xs">to</span>
                              <input
                                type="time"
                                value={sched.closeTime}
                                aria-label={`${day} closing time`}
                                onChange={(e) => {
                                  updateState((prev) => ({
                                    ...prev,
                                    schedule: {
                                      ...prev.schedule,
                                      [day]: { ...sched, closeTime: e.target.value },
                                    },
                                  }));
                                }}
                                className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 bg-slate-50 text-[#111827] font-mono font-semibold outline-none"
                              />
                            </div>
                          ) : (
                            <span className="text-xs font-mono uppercase text-slate-400 px-2.5 py-0.5 rounded-full bg-slate-100">
                              Closed
                            </span>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Booking Window Settings (advanceDays & allowSameDay) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between gap-3">
                        <div>
                          <div className="text-xs font-bold text-[#111827]">
                            Advance Booking Window
                          </div>
                          <div className="text-[11px] text-slate-500">
                            How far ahead customers can book
                          </div>
                        </div>
                        <select
                          value={state.advanceDays}
                          aria-label="Advance Booking Window in Days"
                          onChange={(e) => updateState({ advanceDays: Number(e.target.value) })}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-bold text-[#111827] outline-none cursor-pointer"
                        >
                          <option value={7}>7 days</option>
                          <option value={14}>14 days</option>
                          <option value={30}>30 days</option>
                          <option value={60}>60 days</option>
                        </select>
                      </div>

                      <button
                        type="button"
                        onClick={() => updateState({ allowSameDay: !state.allowSameDay })}
                        className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between gap-3 text-left cursor-pointer"
                      >
                        <div>
                          <div className="text-xs font-bold text-[#111827]">Same-Day Bookings</div>
                          <div className="text-[11px] text-slate-500">
                            Allow booking open slots for today
                          </div>
                        </div>
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center ${
                            state.allowSameDay
                              ? 'bg-[#6258E8] text-white'
                              : 'bg-slate-200 text-slate-400'
                          }`}
                        >
                          <AppIcon
                            name={state.allowSameDay ? 'check' : 'close'}
                            className="text-[14px]"
                          />
                        </span>
                      </button>
                    </div>
                  </div>
                )}

                {/* =============================================================
                    STEP 4: BOOKING & DEPOSITS
                ============================================================= */}
                {currentStep === 4 && (
                  <div className="space-y-4">
                    {/* Tactile Deposit Card with VIA KORA Badge */}
                    <button
                      type="button"
                      onClick={() => updateState({ depositRequired: !state.depositRequired })}
                      className={`w-full p-4 rounded-2xl border text-left flex items-start gap-4 transition-all cursor-pointer ${
                        state.depositRequired
                          ? 'border-[#6258E8]/40 ring-2 ring-[#6258E8] bg-[#f2f3f6]/90'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="w-12 h-12 rounded-xl bg-white shadow-xs flex items-center justify-center text-[#6258E8] shrink-0">
                        <AppIcon name="payments" className="text-[24px]" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-base font-bold text-[#111827]">
                            Require upfront booking deposit
                          </span>
                          <span className="px-2.5 py-0.5 rounded-md bg-[#dbe2f8] text-[#141c2b] text-[11px] font-mono font-bold uppercase tracking-wide">
                            VIA KORA
                          </span>
                        </div>
                        <p className="text-sm text-slate-500 mt-1 leading-snug">
                          Eliminate no-shows. Customers receive a 15-minute slot hold and pay via
                          Kora bank transfer or card to lock their appointment.
                        </p>
                      </div>

                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1 ${
                          state.depositRequired
                            ? 'bg-[#6258E8] text-white'
                            : 'bg-slate-200 text-slate-400'
                        }`}
                      >
                        <AppIcon
                          name={state.depositRequired ? 'check' : 'add'}
                          className="text-[16px]"
                        />
                      </div>
                    </button>

                    {state.depositRequired && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-1.5">
                          <label
                            htmlFor="dep-amount"
                            className="text-xs font-bold text-slate-500 uppercase tracking-wider block"
                          >
                            Default Deposit Amount (₦)
                          </label>
                          <div className="relative">
                            <span className="absolute left-3.5 top-2.5 text-sm font-bold text-slate-400">
                              ₦
                            </span>
                            <input
                              id="dep-amount"
                              type="number"
                              step={500}
                              value={state.depositAmount}
                              onChange={(e) =>
                                updateState({ depositAmount: Number(e.target.value) })
                              }
                              className="w-full pl-8 pr-4 py-2 bg-slate-50 text-[#111827] rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#6258E8] outline-none text-base font-bold"
                            />
                          </div>
                        </div>

                        <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-1.5">
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                            Automatic Hold Expiry
                          </span>
                          <div className="px-3.5 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm font-mono font-bold text-[#111827] flex items-center justify-between">
                            <span>15 Minutes (Strict)</span>
                            <AppIcon name="timer" className="text-[#6258E8] text-[18px]" />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Cancellation Policy */}
                    <div className="space-y-1.5">
                      <label
                        htmlFor="cancel-policy"
                        className="text-sm font-semibold text-[#111827] flex items-center justify-between"
                      >
                        <span>Cancellation & Refund Policy</span>
                        <span className="text-xs text-slate-500">Shared with customers</span>
                      </label>
                      <input
                        id="cancel-policy"
                        type="text"
                        value={state.cancellationPolicy}
                        onChange={(e) => updateState({ cancellationPolicy: e.target.value })}
                        className="w-full px-4 py-2.5 bg-white text-[#111827] text-sm rounded-xl border border-slate-200 focus:ring-2 focus:ring-[#6258E8] outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* =============================================================
                    STEP 5: AI RECEPTIONIST & GOALS (Matches Mobile Mockup)
                ============================================================= */}
                {currentStep === 5 && (
                  <div className="space-y-4">
                    {/* Capability Cards matching the user's screenshot */}
                    <div className="space-y-3">
                      {state.capabilities.map((cap) => (
                        <button
                          key={cap.id}
                          type="button"
                          onClick={() => toggleCapability(cap.id)}
                          className={`w-full p-4 rounded-2xl border text-left flex items-start gap-3.5 transition-all cursor-pointer ${
                            cap.enabled
                              ? 'border-transparent bg-[#f2f3f6]/90 shadow-xs'
                              : 'border-slate-200/80 bg-white hover:bg-slate-50'
                          }`}
                        >
                          <div
                            className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                              cap.enabled
                                ? 'bg-white text-[#6258E8]'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            <AppIcon name={cap.icon} className="text-[22px]" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-base font-bold text-[#111827]">
                                {cap.title}
                              </span>
                              {cap.badge && (
                                <span className="px-2.5 py-0.5 rounded-lg bg-[#dbe2f8] text-[#141c2b] text-[10px] font-mono font-bold uppercase tracking-wider shrink-0">
                                  {cap.badge}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-slate-500 mt-1 leading-snug">
                              {cap.description}
                            </p>
                          </div>

                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1 transition-colors ${
                              cap.enabled
                                ? 'bg-[#6258E8] text-white'
                                : 'bg-slate-200/80 text-slate-500'
                            }`}
                          >
                            <AppIcon name={cap.enabled ? 'check' : 'add'} className="text-[16px]" />
                          </div>
                        </button>
                      ))}
                    </div>

                    {/* Assistant Name & Tone Compact Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div className="p-3 rounded-xl border border-slate-200 bg-white flex items-center gap-3">
                        <span className="text-xs font-bold text-slate-500 uppercase">Name:</span>
                        <input
                          type="text"
                          value={state.assistantName}
                          aria-label="Assistant Name"
                          onChange={(e) => updateState({ assistantName: e.target.value })}
                          className="flex-1 text-sm font-bold text-[#111827] outline-none"
                        />
                      </div>

                      <div className="p-2 rounded-xl border border-slate-200 bg-white grid grid-cols-3 gap-1">
                        {(['Friendly', 'Professional', 'Casual'] as const).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => updateState({ tone: t })}
                            className={`py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                              state.tone === t
                                ? 'bg-[#6258E8] text-white'
                                : 'text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Welcome Greeting Input */}
                    <div className="space-y-1.5">
                      <label
                        htmlFor="assistant-greeting"
                        className="text-xs font-bold text-slate-500 uppercase tracking-wider block"
                      >
                        Opening Greeting Message
                      </label>
                      <input
                        id="assistant-greeting"
                        type="text"
                        value={state.greeting}
                        onChange={(e) => updateState({ greeting: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-[#111827] focus:ring-2 focus:ring-[#6258E8] outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* =============================================================
                    STEP 6: REVIEW & LAUNCH
                ============================================================= */}
                {currentStep === 6 && (
                  <div className="space-y-4">
                    {/* Public Booking Link Card */}
                    <div className="p-4 rounded-2xl border border-[#6258E8]/30 bg-[#6258E8]/5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#6258E8] uppercase font-mono">
                          Your Public Booking Link
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(bookingUrl);
                            setCopiedLink(true);
                            setTimeout(() => setCopiedLink(false), 2000);
                          }}
                          className="text-xs font-bold text-[#6258E8] bg-white px-3 py-1 rounded-lg border border-[#6258E8]/30 hover:bg-[#6258E8]/10 transition-colors flex items-center gap-1 shadow-xs cursor-pointer"
                        >
                          <AppIcon name="content_copy" className="text-[14px]" />
                          {copiedLink ? 'Copied!' : 'Copy Link'}
                        </button>
                      </div>
                      <div className="text-base font-mono font-bold text-[#111827] break-all">
                        {bookingUrl}
                      </div>
                    </div>

                    {/* 6 Summary Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[#6258E8] uppercase font-mono">
                            01 Business
                          </span>
                          <button
                            type="button"
                            onClick={() => setCurrentStep(1)}
                            className="text-xs text-slate-500 hover:text-[#6258E8] underline font-medium"
                          >
                            Edit
                          </button>
                        </div>
                        <div className="font-bold text-sm text-[#111827]">{state.businessName}</div>
                        <div className="text-xs text-slate-500">
                          {CATEGORY_PRESETS[state.category].label} • {state.phone}
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[#6258E8] uppercase font-mono">
                            02 Services & Staff
                          </span>
                          <button
                            type="button"
                            onClick={() => setCurrentStep(2)}
                            className="text-xs text-slate-500 hover:text-[#6258E8] underline font-medium"
                          >
                            Edit
                          </button>
                        </div>
                        <div className="font-bold text-sm text-[#111827]">
                          {state.services.length} Services • {state.staff.length} Staff
                        </div>
                        <div className="text-xs text-slate-500">
                          From ₦{Math.min(...state.services.map((s) => s.price)).toLocaleString()}
                        </div>
                      </div>

                      <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[#6258E8] uppercase font-mono">
                            03 Working Hours
                          </span>
                          <button
                            type="button"
                            onClick={() => setCurrentStep(3)}
                            className="text-xs text-slate-500 hover:text-[#6258E8] underline font-medium"
                          >
                            Edit
                          </button>
                        </div>
                        <div className="font-bold text-sm text-[#111827]">
                          {Object.values(state.schedule).filter((s) => s.open).length} days open /
                          week
                        </div>
                        <div className="text-xs text-slate-500">{state.timezone}</div>
                      </div>

                      <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[#6258E8] uppercase font-mono">
                            04 Kora Deposit
                          </span>
                          <button
                            type="button"
                            onClick={() => setCurrentStep(4)}
                            className="text-xs text-slate-500 hover:text-[#6258E8] underline font-medium"
                          >
                            Edit
                          </button>
                        </div>
                        <div className="font-bold text-sm text-[#111827]">
                          {state.depositRequired
                            ? `₦${state.depositAmount.toLocaleString()} Deposit`
                            : 'No Deposit'}
                        </div>
                        <div className="text-xs text-[#10B981] font-medium">
                          15-min hold • Kora verified
                        </div>
                      </div>
                    </div>

                    {/* Test Booking Action */}
                    <button
                      type="button"
                      onClick={() => {
                        setTestTimer(900);
                        setTestModalOpen(true);
                      }}
                      className="w-full py-3 px-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-sm font-bold text-[#111827] flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <AppIcon name="play_circle" className="text-[18px] text-[#6258E8]" />
                      Run Safe Test Booking Preview
                    </button>
                  </div>
                )}

                {/* Auto-Configured Capabilities Banner (Matches Mobile Mockup) */}
                <div className="p-3.5 rounded-2xl bg-[#f2f3f6]/80 flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-full bg-[#e3dfff] text-[#493cce] flex items-center justify-center shrink-0">
                    <AppIcon name="bolt" className="text-[20px]" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-[#111827]">
                      Auto-configured capabilities
                    </div>
                    <div className="text-xs text-slate-500">
                      Model will specialize based on selected objectives
                    </div>
                  </div>
                </div>
              </div>

              {/* ===============================================================
                  MOBILE BOTTOM NAVIGATION (< lg) — Shadcn Rounded Animated Buttons
              =============================================================== */}
              <div className="lg:hidden pt-6 space-y-3">
                <Button
                  type="button"
                  variant="default"
                  size="lg"
                  disabled={isSubmitting}
                  onClick={handleContinue}
                  className="w-full rounded-2xl py-4 text-base"
                >
                  <span>
                    {isSubmitting
                      ? 'Saving to Database...'
                      : currentStep < 6
                        ? `Continue to Step ${currentStep + 1}`
                        : 'Activate Workspace'}
                  </span>
                  <AppIcon name="arrow_forward" className="text-[20px]" />
                </Button>

                {currentStep > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleBack}
                    className="w-full rounded-xl text-sm font-medium text-slate-500"
                  >
                    <AppIcon name="arrow_back" className="text-[18px]" />
                    <span>Back to Step {currentStep - 1}</span>
                  </Button>
                )}
              </div>
            </div>

            {/* ===============================================================
                DESKTOP PERSISTENT FOOTER (>= lg)
            =============================================================== */}
            <footer className="hidden lg:flex px-9 py-5 border-t border-slate-200/80 bg-white/90 items-center justify-between gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                disabled={currentStep === 1}
              >
                <AppIcon name="arrow_back" className="text-[18px]" />
                Back
              </Button>

              <div className="flex items-center gap-1.5 text-slate-500 text-xs font-medium">
                <AppIcon name="check_circle" className="text-[18px] text-[#10B981]" />
                <span>All changes saved</span>
              </div>

              <div className="flex items-center gap-3">
                {currentStep < 6 && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setCurrentStep((prev) => prev + 1)}
                  >
                    Skip
                  </Button>
                )}

                <Button
                  type="button"
                  variant="default"
                  disabled={isSubmitting}
                  onClick={handleContinue}
                >
                  <span>
                    {isSubmitting
                      ? 'Saving to Database...'
                      : currentStep === 6
                        ? 'Activate Workspace'
                        : `Continue to Step ${currentStep + 1}`}
                  </span>
                  <AppIcon name="arrow_forward" className="text-[18px]" />
                </Button>
              </div>
            </footer>
          </section>
        </div>
      </main>

      {/* Test Booking Simulation Modal */}
      {testModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#6258E8] flex items-center justify-center text-white">
                  <AppIcon name="science" className="text-[20px]" />
                </div>
                <div>
                  <h3 className="font-bold text-[#111827] text-base">Test Booking Preview</h3>
                  <p className="text-xs text-slate-500">Sandbox Mode • No live charges</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTestModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <AppIcon name="close" className="text-[20px]" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Service:</span>
                <span className="font-bold text-[#111827]">
                  {state.services[0]?.name || 'Classic Haircut'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Assigned Staff:</span>
                <span className="font-bold text-[#111827]">
                  {state.staff[0]?.name || 'Lead Barber'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Slot Hold Timer:</span>
                <span className="font-mono font-bold text-[#6258E8]">
                  {Math.floor(testTimer / 60)}:{(testTimer % 60).toString().padStart(2, '0')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Kora Required Deposit:</span>
                <span className="font-bold text-[#10B981]">
                  ₦{state.depositAmount.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#6258E8]/5 border border-[#6258E8]/15 text-xs text-slate-600 leading-relaxed">
              🔒 <strong>Invariant Verification</strong>: The slot is held for 15 minutes and
              confirms only after Kora webhook + transaction verification.
            </div>

            <button
              type="button"
              onClick={() => setTestModalOpen(false)}
              className="w-full py-2.5 rounded-xl bg-[#6258E8] text-white font-semibold text-sm shadow-sm hover:bg-[#5247d8] transition-colors"
            >
              Close Preview
            </button>
          </div>
        </div>
      )}

      {/* Desktop Footer */}
      <footer className="hidden lg:block w-full py-4 text-center text-xs text-slate-400">
        © 2026 Switchboard Technologies Inc. All rights reserved.
      </footer>
    </div>
  );
}
