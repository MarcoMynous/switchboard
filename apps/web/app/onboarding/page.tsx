'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export type BusinessCategory = 'barber' | 'beauty' | 'auto' | 'property' | 'other';

export interface ServiceItem {
  id: string;
  name: string;
  duration: number; // minutes
  price: number; // in Naira
  depositRequired: boolean;
  depositAmount: number; // in Naira
  description: string;
  assignedStaff: string[];
}

export interface StaffItem {
  id: string;
  name: string;
  role: string;
  services: string[];
}

export interface DaySchedule {
  open: boolean;
  openTime: string;
  closeTime: string;
}

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

export interface OnboardingState {
  // Step 1
  businessName: string;
  category: BusinessCategory;
  phone: string;
  address: string;
  country: string;
  timezone: string;
  website: string;
  description: string;

  // Step 2
  services: ServiceItem[];
  staff: StaffItem[];
  selfProvided: boolean;

  // Step 3
  schedule: Record<string, DaySchedule>;
  advanceDays: number;
  allowSameDay: boolean;

  // Step 4
  depositRequired: boolean;
  depositType: 'fixed' | 'percentage';
  depositAmount: number;
  cancellationPolicy: string;
  escalationContact: string;
  koraStatus: 'ready' | 'pending';

  // Step 5
  assistantName: string;
  greeting: string;
  language: string;
  tone: 'Friendly' | 'Professional' | 'Casual';
  faqs: FAQItem[];
  escalationStaff: string;
  webChatEnabled: boolean;
  whatsappConnected: boolean;
}

const CATEGORY_METADATA: Record<
  BusinessCategory,
  { label: string; sub: string; icon: string; defaultServices: Omit<ServiceItem, 'id'>[] }
> = {
  barber: {
    label: 'Salon & Barbershop',
    sub: 'Barbers, hair stylists & grooming',
    icon: 'content_cut',
    defaultServices: [
      {
        name: 'Classic Fade & Beard Sculpt',
        duration: 45,
        price: 5000,
        depositRequired: true,
        depositAmount: 1500,
        description: 'Detailed razor fade, hot towel prep and beard conditioning oil.',
        assignedStaff: ['1'],
      },
      {
        name: 'Standard Haircut',
        duration: 30,
        price: 3500,
        depositRequired: true,
        depositAmount: 1000,
        description: 'Clean clipper trim and edge line-up.',
        assignedStaff: ['1'],
      },
      {
        name: 'VIP Dreadlocks Retwist & Wash',
        duration: 90,
        price: 15000,
        depositRequired: true,
        depositAmount: 5000,
        description: 'Organic shampoo wash, deep palm-roll retwist and dryer setting.',
        assignedStaff: ['1'],
      },
    ],
  },
  beauty: {
    label: 'Beauty & Wellness',
    sub: 'Spa, lashes, nails & massage',
    icon: 'spa',
    defaultServices: [
      {
        name: 'Signature Gel Manicure & Pedicure',
        duration: 60,
        price: 12000,
        depositRequired: true,
        depositAmount: 3000,
        description: 'Exfoliating scrub, cuticle care, and chip-free gel polish.',
        assignedStaff: ['1'],
      },
      {
        name: 'Deep Tissue Massage (60 min)',
        duration: 60,
        price: 20000,
        depositRequired: true,
        depositAmount: 5000,
        description: 'Targeted muscle tension relief with aromatherapy oils.',
        assignedStaff: ['1'],
      },
      {
        name: 'Custom Glow Facial',
        duration: 75,
        price: 18000,
        depositRequired: true,
        depositAmount: 5000,
        description: 'Ultrasonic pore extraction and hydrating vitamin C mask.',
        assignedStaff: ['1'],
      },
    ],
  },
  auto: {
    label: 'Auto Services',
    sub: 'Diagnostics, detailing & mechanics',
    icon: 'directions_car',
    defaultServices: [
      {
        name: 'Full Computer Diagnostics',
        duration: 45,
        price: 10000,
        depositRequired: true,
        depositAmount: 3000,
        description: 'OBD-II live telemetry scan and electrical system assessment.',
        assignedStaff: ['1'],
      },
      {
        name: 'Executive Detailing & Ceramic Wash',
        duration: 120,
        price: 25000,
        depositRequired: true,
        depositAmount: 8000,
        description: 'Interior steam clean, exterior clay bar, and ceramic hydrophobic coat.',
        assignedStaff: ['1'],
      },
    ],
  },
  property: {
    label: 'Property Viewings',
    sub: 'Agent walkthroughs & inspections',
    icon: 'apartment',
    defaultServices: [
      {
        name: 'Guided 3-Bedroom Villa Inspection',
        duration: 45,
        price: 5000,
        depositRequired: true,
        depositAmount: 2000,
        description: 'Private in-person viewing of interior units and compound amenities.',
        assignedStaff: ['1'],
      },
      {
        name: 'Commercial Office Space Walkthrough',
        duration: 60,
        price: 8000,
        depositRequired: true,
        depositAmount: 3000,
        description: 'Floorplan review, power backup audit, and parking allotment tour.',
        assignedStaff: ['1'],
      },
    ],
  },
  other: {
    label: 'Other Appointment Services',
    sub: 'Consultations & scheduled visits',
    icon: 'calendar_month',
    defaultServices: [
      {
        name: 'General 45-Minute Consultation',
        duration: 45,
        price: 10000,
        depositRequired: true,
        depositAmount: 3000,
        description: 'One-on-one session with our senior specialist.',
        assignedStaff: ['1'],
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

const INITIAL_STATE: OnboardingState = {
  businessName: 'Fade Republic',
  category: 'barber',
  phone: '+234 803 123 4567',
  address: 'KM 10 Idiroko Road, Ota, Ogun State',
  country: 'Nigeria',
  timezone: 'Africa/Lagos (GMT+1)',
  website: 'https://faderepublic.ng',
  description: 'Premier modern barbershop offering precision fades, hair care, and beard grooming.',
  services: [
    {
      id: '1',
      name: 'Classic Fade & Beard Sculpt',
      duration: 45,
      price: 5000,
      depositRequired: true,
      depositAmount: 1500,
      description: 'Razor fade with hot towel finish and beard conditioning.',
      assignedStaff: ['1'],
    },
    {
      id: '2',
      name: 'Standard Haircut',
      duration: 30,
      price: 3500,
      depositRequired: true,
      depositAmount: 1000,
      description: 'Precision clipper cut and perimeter line-up.',
      assignedStaff: ['1'],
    },
    {
      id: '3',
      name: 'VIP Dreadlocks Retwist & Wash',
      duration: 90,
      price: 15000,
      depositRequired: true,
      depositAmount: 5000,
      description: 'Organic shampoo wash and deep palm-roll retwist under dryer.',
      assignedStaff: ['1'],
    },
  ],
  staff: [
    {
      id: '1',
      name: 'Tunde Adeyemi (Lead Barber)',
      role: 'Master Stylist',
      services: ['1', '2', '3'],
    },
    {
      id: '2',
      name: 'Emeka Okafor',
      role: 'Fade Specialist',
      services: ['1', '2'],
    },
  ],
  selfProvided: false,
  schedule: DEFAULT_SCHEDULE,
  advanceDays: 14,
  allowSameDay: true,
  depositRequired: true,
  depositType: 'fixed',
  depositAmount: 1500,
  cancellationPolicy:
    'Deposits are refundable if cancelled at least 4 hours before your scheduled appointment.',
  escalationContact: 'Tunde Adeyemi (+234 803 123 4567)',
  koraStatus: 'ready',
  assistantName: 'Maya',
  greeting:
    "Hello! Welcome to Fade Republic. I'm Maya, your AI booking assistant. How can I help you with an appointment today?",
  language: 'English (Nigeria)',
  tone: 'Friendly',
  faqs: [
    {
      id: '1',
      question: 'Do you accept walk-ins?',
      answer:
        'We do, but priority is given to confirmed reservations with a verified Kora deposit.',
    },
    {
      id: '2',
      question: 'Where can I park?',
      answer: 'Secure free customer parking is available right in front of the plaza.',
    },
  ],
  escalationStaff: '1',
  webChatEnabled: true,
  whatsappConnected: false,
};

const STEPS = [
  { id: 1, label: 'Your Business', desc: 'Business identity and contact details' },
  { id: 2, label: 'Services & Staff', desc: 'What customers can book' },
  { id: 3, label: 'Working Hours', desc: 'Your appointment availability' },
  { id: 4, label: 'Booking & Deposits', desc: 'Booking rules and payments' },
  { id: 5, label: 'AI Receptionist', desc: 'Customer messages and AI behavior' },
  { id: 6, label: 'Review & Activate', desc: 'Verify setup and get started' },
] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [state, setState] = useState<OnboardingState>(INITIAL_STATE);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testTimer, setTestTimer] = useState(900); // 15 mins in seconds

  // Hydrate draft from localStorage on initial client mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('switchboard_onboarding_draft');
      if (saved) {
        const parsed = JSON.parse(saved);
        setState((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      // ignore JSON or localStorage errors
    }
  }, []);

  // Autosave to localStorage
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
    }, 400);
  };

  // Timer for test booking modal
  useEffect(() => {
    if (!testModalOpen) return;
    const interval = setInterval(() => {
      setTestTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [testModalOpen]);

  const handleCategorySelect = (category: BusinessCategory) => {
    const meta = CATEGORY_METADATA[category];
    const newServices: ServiceItem[] = meta.defaultServices.map((s, idx) => ({
      ...s,
      id: String(idx + 1),
    }));

    updateState({
      category,
      services: newServices,
      greeting: `Hello! Welcome to ${state.businessName}. I'm ${state.assistantName}, your booking assistant. How can I help you today?`,
    });
  };

  const validateStep = (step: number): boolean => {
    const stepErrors: Record<string, string> = {};
    if (step === 1) {
      if (!state.businessName.trim()) {
        stepErrors.businessName = 'Business name is required';
      }
      if (!state.phone.trim()) {
        stepErrors.phone = 'Business phone is required';
      }
    } else if (step === 2) {
      if (state.services.length === 0) {
        stepErrors.services = 'Please provide at least one service customers can book.';
      }
      if (!state.selfProvided && state.staff.length === 0) {
        stepErrors.staff =
          'Please add at least one bookable staff member or check "I provide services myself".';
      }
    }
    setErrors(stepErrors);
    return Object.keys(stepErrors).length === 0;
  };

  const handleContinue = () => {
    if (!validateStep(currentStep)) return;
    if (currentStep < 6) {
      setCurrentStep((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      // Final activation
      router.push('/dashboard');
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-background font-body-md text-on-surface antialiased flex flex-col justify-between selection:bg-primary-container selection:text-white">
      {/* Top Header */}
      <header className="w-full py-space-md lg:py-space-lg px-gutter border-b border-border/40 bg-surface/50 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-[1120px] mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-space-sm group">
            <div className="w-8 h-8 rounded-lg bg-primary-container flex items-center justify-center transition-transform group-hover:scale-105 shadow-sm">
              <span className="material-symbols-outlined text-on-primary text-[20px]">hub</span>
            </div>
            <span className="font-headline-sm text-headline-sm font-semibold tracking-tight text-text-primary">
              Switchboard
            </span>
          </Link>

          <div className="flex items-center gap-space-sm">
            <span className="font-label-sm text-label-sm text-text-secondary uppercase tracking-wider font-mono hidden sm:inline-block">
              Workspace Setup
            </span>
            <span className="px-2 py-0.5 rounded bg-surface-container text-[11px] font-mono text-text-secondary border border-border">
              v2.4
            </span>
          </div>
        </div>
      </header>

      {/* Main Persistent Layout */}
      <div className="flex-1 max-w-[1120px] w-full mx-auto px-gutter py-4 lg:py-8">
        <main className="w-full bg-surface rounded-xl border border-border shadow-sm flex flex-col lg:flex-row overflow-hidden min-h-[720px]">
          {/* Left Persistent Sidebar (35%) */}
          <aside className="w-full lg:w-[35%] bg-surface-container-low p-space-lg border-b lg:border-b-0 lg:border-r border-border flex flex-col justify-between">
            <div className="space-y-space-lg">
              <div>
                <span className="font-label-sm text-label-sm uppercase tracking-wider text-primary font-semibold block mb-1">
                  Onboarding Wizard
                </span>
                <h1 className="font-headline-md text-headline-md font-semibold text-text-primary tracking-tight">
                  Get Started
                </h1>
                <p className="font-body-sm text-body-sm text-text-secondary mt-1">
                  Configure your appointment engine in 6 quick stages.
                </p>
              </div>

              {/* Vertical Stepper with continuous line */}
              <nav
                aria-label="Onboarding Progress"
                className="relative flex flex-col gap-space-lg py-2"
              >
                <div className="absolute left-[15px] top-3 bottom-3 w-[2px] bg-border z-0" />

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
                      className="group relative z-10 flex items-start gap-space-md text-left transition-opacity"
                    >
                      <span
                        className={`w-8 h-8 rounded-full font-metric-md text-metric-md flex items-center justify-center shrink-0 transition-all ${
                          isActive
                            ? 'bg-primary text-on-primary ring-4 ring-primary/10 shadow-sm'
                            : isDone
                              ? 'bg-success text-on-primary'
                              : 'border border-border bg-surface text-text-secondary group-hover:border-primary group-hover:text-primary'
                        }`}
                      >
                        {isDone ? (
                          <span className="material-symbols-outlined text-[18px]">check</span>
                        ) : (
                          `0${step.id}`
                        )}
                      </span>

                      <div className="space-y-0.5 pt-0.5">
                        <div
                          className={`font-label-md text-label-md font-medium transition-colors ${
                            isActive
                              ? 'text-primary font-semibold'
                              : 'text-text-primary group-hover:text-primary'
                          }`}
                        >
                          {step.label}
                        </div>
                        <div className="font-body-sm text-body-sm text-text-secondary text-xs">
                          {step.desc}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Sidebar Engine Status */}
            <div className="pt-space-lg mt-6 border-t border-border flex items-center justify-between text-text-secondary">
              <span className="font-label-sm text-label-sm">Switchboard Engine</span>
              <span className="font-metric-sm text-metric-sm text-success flex items-center gap-1.5 font-medium">
                <span className="w-2 h-2 rounded-full bg-success inline-block animate-pulse" />
                Live
              </span>
            </div>
          </aside>

          {/* Right Persistent Content Panel (65%) */}
          <section className="w-full lg:w-[65%] flex flex-col justify-between bg-surface">
            {/* Scrollable Form Region */}
            <div className="p-space-lg lg:p-space-xl flex-1 overflow-y-auto">
              <div className="flex flex-col gap-space-lg">
                {/* Step Header Context */}
                <div className="space-y-space-xs border-b border-border/60 pb-space-md">
                  <div className="flex items-center justify-between">
                    <span className="font-label-sm text-label-sm uppercase tracking-wider text-primary font-semibold">
                      Step 0{currentStep} of 06
                    </span>

                    <div className="flex items-center gap-space-xs bg-surface-container-low px-2.5 py-1 rounded-full border border-border/50">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          saveStatus === 'saved' ? 'bg-success' : 'bg-primary animate-spin'
                        }`}
                      />
                      <span className="font-metric-sm text-metric-sm text-text-secondary">
                        {saveStatus === 'saved' ? 'Draft Saved' : 'Saving Changes...'}
                      </span>
                    </div>
                  </div>

                  <h2 className="font-headline-md text-headline-md font-semibold text-text-primary tracking-tight">
                    {currentStep === 1 && 'Tell us about your business'}
                    {currentStep === 2 && 'What services do you offer?'}
                    {currentStep === 3 && 'When are you available?'}
                    {currentStep === 4 && 'How should appointments be confirmed?'}
                    {currentStep === 5 && 'Meet your AI receptionist'}
                    {currentStep === 6 && 'Your business is almost ready'}
                  </h2>

                  <p className="font-body-md text-body-md text-text-secondary max-w-xl text-sm">
                    {currentStep === 1 &&
                      'Provide foundational information so your AI assistant knows who it represents and how to handle customer inquiries accurately.'}
                    {currentStep === 2 &&
                      'Add the services customers can book and the people who provide them. Prices in Nigerian Naira (₦).'}
                    {currentStep === 3 &&
                      'Set the days and times customers can book your services, and configure advance reservation limits.'}
                    {currentStep === 4 &&
                      'Choose how customers reserve appointments and set up Kora deposits to eliminate no-shows.'}
                    {currentStep === 5 &&
                      'Customize how Switchboard greets customers and handles questions on web chat and WhatsApp.'}
                    {currentStep === 6 &&
                      'Review your workspace configuration, test the 15-minute booking hold, and activate your assistant.'}
                  </p>
                </div>

                {/* Step 1: Your Business */}
                {currentStep === 1 && (
                  <div className="space-y-space-lg">
                    {/* Business Name */}
                    <div className="space-y-1.5">
                      <label
                        htmlFor="biz-name"
                        className="font-label-md text-label-md font-medium text-text-primary flex items-center justify-between"
                      >
                        <span>
                          Official Business Name <span className="text-error">*</span>
                        </span>
                        <span className="font-label-sm text-label-sm text-text-secondary">
                          Public display name
                        </span>
                      </label>
                      <div className="relative rounded-lg shadow-sm">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-secondary">
                          <span className="material-symbols-outlined text-[18px]">domain</span>
                        </div>
                        <input
                          id="biz-name"
                          type="text"
                          value={state.businessName}
                          onChange={(e) => updateState({ businessName: e.target.value })}
                          placeholder="e.g. Fade Republic, Ota"
                          className={`w-full pl-9 pr-10 py-2.5 bg-surface text-text-primary font-body-sm text-body-sm rounded-lg border-0 shadow-sm ring-1 ring-inset ${
                            errors.businessName ? 'ring-error' : 'ring-border'
                          } focus:ring-2 focus:ring-inset focus:ring-primary outline-none transition-all`}
                        />
                        {state.businessName && (
                          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-success">
                            <span className="material-symbols-outlined text-[18px]">verified</span>
                          </div>
                        )}
                      </div>
                      {errors.businessName && (
                        <p className="text-xs text-error font-medium">{errors.businessName}</p>
                      )}
                    </div>

                    {/* Industry Cards */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-label-md text-label-md font-medium text-text-primary">
                          Primary Business Category <span className="text-error">*</span>
                        </span>
                        <span className="font-label-sm text-label-sm text-text-secondary">
                          Loads tailored presets
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm">
                        {(Object.keys(CATEGORY_METADATA) as BusinessCategory[]).map((catKey) => {
                          const meta = CATEGORY_METADATA[catKey];
                          const isSelected = state.category === catKey;

                          return (
                            <button
                              key={catKey}
                              type="button"
                              onClick={() => handleCategorySelect(catKey)}
                              className={`p-3.5 rounded-lg border text-left flex items-start gap-3 transition-all ${
                                isSelected
                                  ? 'border-primary ring-2 ring-primary/20 bg-primary-fixed/20'
                                  : 'border-border bg-surface hover:bg-surface-container-low/50'
                              }`}
                            >
                              <div
                                className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${
                                  isSelected
                                    ? 'bg-primary text-on-primary'
                                    : 'bg-surface-container text-text-secondary'
                                }`}
                              >
                                <span className="material-symbols-outlined text-[18px]">
                                  {meta.icon}
                                </span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-label-md text-label-md font-medium text-text-primary flex items-center justify-between">
                                  <span>{meta.label}</span>
                                  {isSelected && (
                                    <span className="material-symbols-outlined text-primary text-[18px]">
                                      check_circle
                                    </span>
                                  )}
                                </div>
                                <div className="font-body-sm text-body-sm text-text-secondary text-xs truncate">
                                  {meta.sub}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Country & Timezone (Nigerian Defaults) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
                      <div className="space-y-1.5">
                        <label
                          htmlFor="country-select"
                          className="font-label-md text-label-md font-medium text-text-primary"
                        >
                          Country of Registry
                        </label>
                        <select
                          id="country-select"
                          value={state.country}
                          onChange={(e) => updateState({ country: e.target.value })}
                          className="w-full py-2.5 px-3 bg-surface text-text-primary font-body-sm text-body-sm rounded-lg border-0 shadow-sm ring-1 ring-inset ring-border focus:ring-2 focus:ring-inset focus:ring-primary outline-none"
                        >
                          <option value="Nigeria">Nigeria (NG)</option>
                          <option value="Ghana">Ghana (GH)</option>
                          <option value="Kenya">Kenya (KE)</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label
                          htmlFor="timezone-select"
                          className="font-label-md text-label-md font-medium text-text-primary"
                        >
                          Operating Timezone
                        </label>
                        <select
                          id="timezone-select"
                          value={state.timezone}
                          onChange={(e) => updateState({ timezone: e.target.value })}
                          className="w-full py-2.5 px-3 bg-surface text-text-primary font-body-sm text-body-sm rounded-lg border-0 shadow-sm ring-1 ring-inset ring-border focus:ring-2 focus:ring-inset focus:ring-primary outline-none"
                        >
                          <option value="Africa/Lagos (GMT+1)">Africa/Lagos (GMT+1)</option>
                          <option value="Africa/Accra (GMT)">Africa/Accra (GMT)</option>
                          <option value="Africa/Nairobi (GMT+3)">Africa/Nairobi (GMT+3)</option>
                        </select>
                      </div>
                    </div>

                    {/* Phone & Address */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
                      <div className="space-y-1.5">
                        <label
                          htmlFor="biz-phone"
                          className="font-label-md text-label-md font-medium text-text-primary flex items-center justify-between"
                        >
                          <span>
                            Dispatch Phone Number <span className="text-error">*</span>
                          </span>
                          <span className="font-label-sm text-label-sm text-text-secondary">
                            Customer contact
                          </span>
                        </label>
                        <div className="relative rounded-lg shadow-sm">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-secondary">
                            <span className="material-symbols-outlined text-[18px]">call</span>
                          </div>
                          <input
                            id="biz-phone"
                            type="tel"
                            value={state.phone}
                            onChange={(e) => updateState({ phone: e.target.value })}
                            placeholder="+234 803 000 0000"
                            className={`w-full pl-9 pr-3 py-2.5 bg-surface text-text-primary font-body-sm text-body-sm rounded-lg border-0 shadow-sm ring-1 ring-inset ${
                              errors.phone ? 'ring-error' : 'ring-border'
                            } focus:ring-2 focus:ring-inset focus:ring-primary outline-none`}
                          />
                        </div>
                        {errors.phone && (
                          <p className="text-xs text-error font-medium">{errors.phone}</p>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <label
                          htmlFor="biz-address"
                          className="font-label-md text-label-md font-medium text-text-primary flex items-center justify-between"
                        >
                          <span>Physical Address</span>
                          <span className="font-label-sm text-label-sm text-text-secondary">
                            Optional
                          </span>
                        </label>
                        <div className="relative rounded-lg shadow-sm">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-secondary">
                            <span className="material-symbols-outlined text-[18px]">
                              location_on
                            </span>
                          </div>
                          <input
                            id="biz-address"
                            type="text"
                            value={state.address}
                            onChange={(e) => updateState({ address: e.target.value })}
                            placeholder="e.g. 14 Ogunu Road, Warri or Victoria Island, Lagos"
                            className="w-full pl-9 pr-3 py-2.5 bg-surface text-text-primary font-body-sm text-body-sm rounded-lg border-0 shadow-sm ring-1 ring-inset ring-border focus:ring-2 focus:ring-inset focus:ring-primary outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Website & Description */}
                    <div className="space-y-1.5">
                      <label
                        htmlFor="biz-website"
                        className="font-label-md text-label-md font-medium text-text-primary flex items-center justify-between"
                      >
                        <span>Website or Social Profile URL</span>
                        <span className="font-label-sm text-label-sm text-text-secondary">
                          Optional
                        </span>
                      </label>
                      <input
                        id="biz-website"
                        type="url"
                        value={state.website}
                        onChange={(e) => updateState({ website: e.target.value })}
                        placeholder="https://instagram.com/yourbusiness or https://yourbiz.ng"
                        className="w-full px-3 py-2.5 bg-surface text-text-primary font-body-sm text-body-sm rounded-lg border-0 shadow-sm ring-1 ring-inset ring-border focus:ring-2 focus:ring-inset focus:ring-primary outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* Step 2: Services & Staff */}
                {currentStep === 2 && (
                  <div className="space-y-space-xl">
                    {/* Services Section */}
                    <div className="space-y-space-md">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-headline-sm text-headline-sm font-semibold text-text-primary">
                            Bookable Services
                          </h3>
                          <p className="font-body-sm text-body-sm text-text-secondary">
                            Define durations and pricing in Nigerian Naira (₦).
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
                                  name: 'New Custom Service',
                                  duration: 30,
                                  price: 4000,
                                  depositRequired: true,
                                  depositAmount: 1000,
                                  description: 'Service description.',
                                  assignedStaff: prev.staff.map((s) => s.id),
                                },
                              ],
                            }));
                          }}
                          className="px-3 py-1.5 rounded-lg border border-border bg-surface text-primary hover:bg-surface-container-low font-label-md text-label-md font-medium flex items-center gap-1.5 shadow-sm transition-colors"
                        >
                          <span className="material-symbols-outlined text-[18px]">add</span>
                          Add Service
                        </button>
                      </div>

                      {errors.services && (
                        <p className="text-xs text-error font-medium">{errors.services}</p>
                      )}

                      <div className="space-y-3">
                        {state.services.map((svc, idx) => (
                          <div
                            key={svc.id}
                            className="p-4 rounded-lg border border-border bg-surface space-y-3 hover:border-primary/40 transition-colors shadow-xs"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 grid grid-cols-1 sm:grid-cols-12 gap-3">
                                <div className="sm:col-span-6">
                                  <label
                                    htmlFor={`svc-name-${svc.id}`}
                                    className="font-label-sm text-label-sm text-text-secondary block mb-1"
                                  >
                                    Service Name
                                  </label>
                                  <input
                                    id={`svc-name-${svc.id}`}
                                    type="text"
                                    value={svc.name}
                                    onChange={(e) => {
                                      const updated = [...state.services];
                                      if (updated[idx]) {
                                        updated[idx] = { ...updated[idx], name: e.target.value };
                                        updateState({ services: updated });
                                      }
                                    }}
                                    className="w-full px-3 py-1.5 bg-surface text-text-primary font-body-sm text-body-sm rounded-md border border-border focus:ring-1 focus:ring-primary outline-none"
                                  />
                                </div>

                                <div className="sm:col-span-3">
                                  <label
                                    htmlFor={`svc-duration-${svc.id}`}
                                    className="font-label-sm text-label-sm text-text-secondary block mb-1"
                                  >
                                    Duration
                                  </label>
                                  <select
                                    id={`svc-duration-${svc.id}`}
                                    value={svc.duration}
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
                                    className="w-full px-2 py-1.5 bg-surface text-text-primary font-body-sm text-body-sm rounded-md border border-border focus:ring-1 focus:ring-primary outline-none"
                                  >
                                    <option value={15}>15 mins</option>
                                    <option value={30}>30 mins</option>
                                    <option value={45}>45 mins</option>
                                    <option value={60}>60 mins</option>
                                    <option value={90}>90 mins</option>
                                    <option value={120}>120 mins</option>
                                  </select>
                                </div>

                                <div className="sm:col-span-3">
                                  <label
                                    htmlFor={`svc-price-${svc.id}`}
                                    className="font-label-sm text-label-sm text-text-secondary block mb-1"
                                  >
                                    Price (₦)
                                  </label>
                                  <input
                                    id={`svc-price-${svc.id}`}
                                    type="number"
                                    min={0}
                                    step={500}
                                    value={svc.price}
                                    onChange={(e) => {
                                      const updated = [...state.services];
                                      if (updated[idx]) {
                                        const p = Number(e.target.value);
                                        updated[idx] = {
                                          ...updated[idx],
                                          price: p,
                                          depositAmount: Math.min(updated[idx].depositAmount, p),
                                        };
                                        updateState({ services: updated });
                                      }
                                    }}
                                    className="w-full px-3 py-1.5 bg-surface text-text-primary font-body-sm text-body-sm rounded-md border border-border focus:ring-1 focus:ring-primary outline-none"
                                  />
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  updateState((prev) => ({
                                    ...prev,
                                    services: prev.services.filter((_, i) => i !== idx),
                                  }));
                                }}
                                className="p-1.5 text-text-secondary hover:text-error hover:bg-error-container/30 rounded transition-colors"
                                title="Remove Service"
                              >
                                <span className="material-symbols-outlined text-[18px]">
                                  delete
                                </span>
                              </button>
                            </div>

                            <input
                              type="text"
                              value={svc.description}
                              placeholder="Brief description for customers (optional)"
                              onChange={(e) => {
                                const updated = [...state.services];
                                if (updated[idx]) {
                                  updated[idx] = { ...updated[idx], description: e.target.value };
                                  updateState({ services: updated });
                                }
                              }}
                              className="w-full px-3 py-1 bg-surface-container-low/50 text-text-secondary text-xs rounded border border-border/40 focus:ring-1 focus:ring-primary outline-none"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Staff Members Section */}
                    <div className="space-y-space-md pt-space-md border-t border-border">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-headline-sm text-headline-sm font-semibold text-text-primary">
                            Staff Roster & Providers
                          </h3>
                          <p className="font-body-sm text-body-sm text-text-secondary">
                            Bookable team members assigned to provide appointments.
                          </p>
                        </div>

                        {!state.selfProvided && (
                          <button
                            type="button"
                            onClick={() => {
                              const newId = String(Date.now());
                              updateState((prev) => ({
                                ...prev,
                                staff: [
                                  ...prev.staff,
                                  {
                                    id: newId,
                                    name: 'New Stylist / Specialist',
                                    role: 'Staff Specialist',
                                    services: prev.services.map((s) => s.id),
                                  },
                                ],
                              }));
                            }}
                            className="px-3 py-1.5 rounded-lg border border-border bg-surface text-text-primary hover:bg-surface-container-low font-label-md text-label-md font-medium flex items-center gap-1.5 shadow-sm"
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              person_add
                            </span>
                            Add Staff
                          </button>
                        )}
                      </div>

                      {/* Solo Provider Toggle */}
                      <label className="flex items-center gap-2 p-3 bg-surface-container-low/60 rounded-lg border border-border cursor-pointer">
                        <input
                          type="checkbox"
                          checked={state.selfProvided}
                          onChange={(e) => updateState({ selfProvided: e.target.checked })}
                          className="w-4 h-4 text-primary rounded border-border focus:ring-primary"
                        />
                        <span className="font-label-md text-label-md text-text-primary">
                          I provide all the services myself (Solo operator)
                        </span>
                      </label>

                      {errors.staff && (
                        <p className="text-xs text-error font-medium">{errors.staff}</p>
                      )}

                      {!state.selfProvided && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm">
                          {state.staff.map((member, idx) => (
                            <div
                              key={member.id}
                              className="p-3.5 rounded-lg border border-border bg-surface space-y-2 relative"
                            >
                              <div className="flex items-start justify-between">
                                <div className="space-y-1 flex-1 pr-2">
                                  <label
                                    htmlFor={`staff-name-${member.id}`}
                                    className="font-label-sm text-label-sm text-text-secondary block"
                                  >
                                    Staff Name
                                  </label>
                                  <input
                                    id={`staff-name-${member.id}`}
                                    type="text"
                                    value={member.name}
                                    onChange={(e) => {
                                      const updated = [...state.staff];
                                      if (updated[idx]) {
                                        updated[idx] = { ...updated[idx], name: e.target.value };
                                        updateState({ staff: updated });
                                      }
                                    }}
                                    className="w-full px-2.5 py-1 text-sm font-medium text-text-primary rounded border border-border focus:ring-1 focus:ring-primary outline-none"
                                  />
                                </div>

                                <button
                                  type="button"
                                  onClick={() => {
                                    updateState((prev) => ({
                                      ...prev,
                                      staff: prev.staff.filter((_, i) => i !== idx),
                                    }));
                                  }}
                                  className="text-text-secondary hover:text-error p-1"
                                  title="Remove Staff"
                                >
                                  <span className="material-symbols-outlined text-[16px]">
                                    close
                                  </span>
                                </button>
                              </div>

                              <div className="flex items-center gap-1.5 text-xs text-text-secondary pt-1">
                                <span className="material-symbols-outlined text-[14px]">
                                  event_available
                                </span>
                                <span>Assigned to {state.services.length} services</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Step 3: Working Hours */}
                {currentStep === 3 && (
                  <div className="space-y-space-lg">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="font-label-md text-label-md text-text-secondary">
                        Adjust weekly working hours & booking windows
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const mon = state.schedule.Monday;
                            if (!mon) return;
                            updateState((prev) => {
                              const updated = { ...prev.schedule };
                              ['Tuesday', 'Wednesday', 'Thursday', 'Friday'].forEach((day) => {
                                updated[day] = { ...mon };
                              });
                              return { ...prev, schedule: updated };
                            });
                          }}
                          className="px-2.5 py-1 text-xs font-medium rounded border border-border bg-surface hover:bg-surface-container-low text-text-primary transition-colors"
                        >
                          Apply Mon to Weekdays
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const mon = state.schedule.Monday;
                            if (!mon) return;
                            updateState((prev) => ({
                              ...prev,
                              schedule: { ...prev.schedule, Saturday: { ...mon } },
                            }));
                          }}
                          className="px-2.5 py-1 text-xs font-medium rounded border border-border bg-surface hover:bg-surface-container-low text-text-primary transition-colors"
                        >
                          Copy to Saturday
                        </button>
                      </div>
                    </div>

                    {/* Schedule List */}
                    <div className="space-y-2 rounded-lg border border-border divide-y divide-border overflow-hidden bg-surface">
                      {Object.entries(state.schedule).map(([day, sched]) => (
                        <div
                          key={day}
                          className="p-3 flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap"
                        >
                          <div className="flex items-center gap-3 w-32 shrink-0">
                            <input
                              type="checkbox"
                              id={`day-toggle-${day}`}
                              checked={sched.open}
                              onChange={(e) => {
                                updateState((prev) => ({
                                  ...prev,
                                  schedule: {
                                    ...prev.schedule,
                                    [day]: { ...sched, open: e.target.checked },
                                  },
                                }));
                              }}
                              className="w-4 h-4 text-primary rounded border-border focus:ring-primary cursor-pointer"
                            />
                            <label
                              htmlFor={`day-toggle-${day}`}
                              className={`font-label-md text-label-md font-medium cursor-pointer ${
                                sched.open
                                  ? 'text-text-primary'
                                  : 'text-text-secondary line-through'
                              }`}
                            >
                              {day}
                            </label>
                          </div>

                          {sched.open ? (
                            <div className="flex items-center gap-2 flex-1 justify-end">
                              <input
                                type="time"
                                value={sched.openTime}
                                onChange={(e) => {
                                  updateState((prev) => ({
                                    ...prev,
                                    schedule: {
                                      ...prev.schedule,
                                      [day]: { ...sched, openTime: e.target.value },
                                    },
                                  }));
                                }}
                                className="px-2.5 py-1 text-xs rounded border border-border bg-surface text-text-primary focus:ring-1 focus:ring-primary outline-none"
                              />
                              <span className="text-text-secondary text-xs">to</span>
                              <input
                                type="time"
                                value={sched.closeTime}
                                onChange={(e) => {
                                  updateState((prev) => ({
                                    ...prev,
                                    schedule: {
                                      ...prev.schedule,
                                      [day]: { ...sched, closeTime: e.target.value },
                                    },
                                  }));
                                }}
                                className="px-2.5 py-1 text-xs rounded border border-border bg-surface text-text-primary focus:ring-1 focus:ring-primary outline-none"
                              />
                            </div>
                          ) : (
                            <span className="text-xs font-mono uppercase text-text-secondary px-2 py-0.5 rounded bg-surface-container-low">
                              Closed
                            </span>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Advance Limits */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md pt-2">
                      <div className="space-y-1.5">
                        <label
                          htmlFor="advance-window"
                          className="font-label-md text-label-md font-medium text-text-primary"
                        >
                          Booking Advance Window
                        </label>
                        <select
                          id="advance-window"
                          value={state.advanceDays}
                          onChange={(e) => updateState({ advanceDays: Number(e.target.value) })}
                          className="w-full py-2.5 px-3 bg-surface text-text-primary font-body-sm text-body-sm rounded-lg border-0 shadow-sm ring-1 ring-inset ring-border focus:ring-2 focus:ring-primary outline-none"
                        >
                          <option value={7}>Up to 7 days in advance</option>
                          <option value={14}>Up to 14 days in advance</option>
                          <option value={30}>Up to 30 days in advance</option>
                          <option value={60}>Up to 60 days in advance</option>
                        </select>
                      </div>

                      <div className="space-y-1.5 flex flex-col justify-end">
                        <label className="flex items-center gap-2 p-2.5 bg-surface-container-low rounded-lg border border-border cursor-pointer">
                          <input
                            type="checkbox"
                            checked={state.allowSameDay}
                            onChange={(e) => updateState({ allowSameDay: e.target.checked })}
                            className="w-4 h-4 text-primary rounded border-border focus:ring-primary"
                          />
                          <span className="font-label-md text-label-md text-text-primary">
                            Allow same-day bookings
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 4: Booking & Deposits */}
                {currentStep === 4 && (
                  <div className="space-y-space-lg">
                    {/* Deposit Toggle */}
                    <div className="p-4 rounded-lg border border-border bg-surface-container-low/50 space-y-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <span className="font-label-md text-label-md font-semibold text-text-primary block">
                            Require Upfront Deposit
                          </span>
                          <p className="font-body-sm text-body-sm text-text-secondary text-xs">
                            Customers pay a non-refundable or credited deposit through Kora to
                            confirm and reserve their slot.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => updateState({ depositRequired: !state.depositRequired })}
                          className={`w-12 h-6 rounded-full transition-colors relative focus:outline-none ${
                            state.depositRequired ? 'bg-primary' : 'bg-surface-container-highest'
                          }`}
                        >
                          <span
                            className={`w-5 h-5 rounded-full bg-white shadow-sm block transition-transform absolute top-0.5 ${
                              state.depositRequired ? 'translate-x-6' : 'translate-x-0.5'
                            }`}
                          />
                        </button>
                      </div>

                      {state.depositRequired && (
                        <div className="pt-3 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label
                              htmlFor="dep-amount"
                              className="font-label-sm text-label-sm text-text-secondary block"
                            >
                              Standard Deposit Amount (₦)
                            </label>
                            <input
                              id="dep-amount"
                              type="number"
                              step={500}
                              value={state.depositAmount}
                              onChange={(e) =>
                                updateState({ depositAmount: Number(e.target.value) })
                              }
                              className="w-full px-3 py-2 bg-surface text-text-primary rounded border border-border focus:ring-1 focus:ring-primary outline-none text-sm font-semibold"
                            />
                          </div>

                          <div className="space-y-1">
                            <span className="font-label-sm text-label-sm text-text-secondary block">
                              Hold Duration Window
                            </span>
                            <div className="px-3 py-2 bg-surface-container rounded border border-border text-sm font-mono text-text-primary flex items-center justify-between">
                              <span>15 Minutes</span>
                              <span className="material-symbols-outlined text-text-secondary text-[16px]">
                                lock
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Invariant Explanation Callout */}
                    <div className="p-4 rounded-lg bg-primary-fixed/30 border border-primary/20 space-y-2">
                      <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                        <span className="material-symbols-outlined text-[20px]">verified_user</span>
                        <span>Switchboard Correctness Guarantee</span>
                      </div>
                      <p className="text-xs text-text-secondary leading-relaxed">
                        Customers receive a temporary <strong>15-minute slot hold</strong> during
                        checkout. A booking is confirmed <strong>only</strong> after Kora
                        independently verifies the transaction through our cryptographic webhook and
                        server-side query. If payment is uncompleted, the slot releases
                        automatically.
                      </p>
                    </div>

                    {/* Kora Status Badge */}
                    <div className="p-3.5 rounded-lg border border-border bg-surface flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center text-success">
                          <span className="material-symbols-outlined text-[18px]">credit_card</span>
                        </div>
                        <div>
                          <div className="font-label-md text-label-md font-medium text-text-primary">
                            Kora Checkout Engine
                          </div>
                          <div className="text-xs text-text-secondary">
                            Cards, Bank Transfer & USSD in Nigerian Naira
                          </div>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-success/10 text-success text-xs font-mono font-medium flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-success" />
                        Connected
                      </span>
                    </div>

                    {/* Cancellation Policy */}
                    <div className="space-y-1.5">
                      <label
                        htmlFor="cancellation-policy"
                        className="font-label-md text-label-md font-medium text-text-primary flex items-center justify-between"
                      >
                        <span>Cancellation & Refund Policy</span>
                        <span className="font-label-sm text-label-sm text-text-secondary">
                          Relayed by AI
                        </span>
                      </label>
                      <textarea
                        id="cancellation-policy"
                        rows={2}
                        value={state.cancellationPolicy}
                        onChange={(e) => updateState({ cancellationPolicy: e.target.value })}
                        className="w-full px-3 py-2 bg-surface text-text-primary font-body-sm text-body-sm rounded-lg border-0 shadow-sm ring-1 ring-inset ring-border focus:ring-2 focus:ring-primary outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* Step 5: AI Receptionist */}
                {currentStep === 5 && (
                  <div className="space-y-space-lg">
                    {/* Persona & Tone */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
                      <div className="space-y-1.5">
                        <label
                          htmlFor="ai-name"
                          className="font-label-md text-label-md font-medium text-text-primary"
                        >
                          Assistant Name
                        </label>
                        <input
                          id="ai-name"
                          type="text"
                          value={state.assistantName}
                          onChange={(e) => updateState({ assistantName: e.target.value })}
                          className="w-full px-3 py-2.5 bg-surface text-text-primary font-body-sm text-body-sm rounded-lg border-0 shadow-sm ring-1 ring-inset ring-border focus:ring-2 focus:ring-primary outline-none"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <span className="font-label-md text-label-md font-medium text-text-primary block">
                          Conversation Tone
                        </span>
                        <div className="grid grid-cols-3 gap-2">
                          {(['Friendly', 'Professional', 'Casual'] as const).map((tone) => (
                            <button
                              key={tone}
                              type="button"
                              onClick={() => updateState({ tone })}
                              className={`py-2 px-2 text-xs font-medium rounded-lg border text-center transition-all ${
                                state.tone === tone
                                  ? 'border-primary bg-primary-fixed/20 text-primary font-semibold ring-1 ring-primary'
                                  : 'border-border bg-surface text-text-secondary hover:bg-surface-container-low'
                              }`}
                            >
                              {tone}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Greeting Message */}
                    <div className="space-y-1.5">
                      <label
                        htmlFor="ai-greeting"
                        className="font-label-md text-label-md font-medium text-text-primary flex items-center justify-between"
                      >
                        <span>Customer Welcome Greeting</span>
                        <span className="font-label-sm text-label-sm text-text-secondary">
                          First message
                        </span>
                      </label>
                      <textarea
                        id="ai-greeting"
                        rows={3}
                        value={state.greeting}
                        onChange={(e) => updateState({ greeting: e.target.value })}
                        className="w-full px-3 py-2 bg-surface text-text-primary font-body-sm text-body-sm rounded-lg border-0 shadow-sm ring-1 ring-inset ring-border focus:ring-2 focus:ring-primary outline-none text-sm"
                      />
                    </div>

                    {/* Common FAQs */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-label-md text-label-md font-medium text-text-primary">
                          Common Questions (FAQs)
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const newId = String(Date.now());
                            updateState((prev) => ({
                              ...prev,
                              faqs: [
                                ...prev.faqs,
                                {
                                  id: newId,
                                  question: 'What is your address?',
                                  answer: `We are located at ${state.address || 'our main studio'}.`,
                                },
                              ],
                            }));
                          }}
                          className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[16px]">add</span>
                          Add FAQ
                        </button>
                      </div>

                      <div className="space-y-2">
                        {state.faqs.map((faq, idx) => (
                          <div
                            key={faq.id}
                            className="p-3 rounded-lg border border-border bg-surface space-y-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <input
                                type="text"
                                value={faq.question}
                                placeholder="Customer Question"
                                onChange={(e) => {
                                  const updated = [...state.faqs];
                                  if (updated[idx]) {
                                    updated[idx] = { ...updated[idx], question: e.target.value };
                                    updateState({ faqs: updated });
                                  }
                                }}
                                className="w-full font-medium text-xs text-text-primary border-0 border-b border-transparent focus:border-primary outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  updateState((prev) => ({
                                    ...prev,
                                    faqs: prev.faqs.filter((_, i) => i !== idx),
                                  }));
                                }}
                                className="text-text-secondary hover:text-error text-xs"
                              >
                                <span className="material-symbols-outlined text-[16px]">
                                  delete
                                </span>
                              </button>
                            </div>
                            <input
                              type="text"
                              value={faq.answer}
                              placeholder="Answer"
                              onChange={(e) => {
                                const updated = [...state.faqs];
                                if (updated[idx]) {
                                  updated[idx] = { ...updated[idx], answer: e.target.value };
                                  updateState({ faqs: updated });
                                }
                              }}
                              className="w-full text-xs text-text-secondary border-0 outline-none"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Channels Configuration */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm pt-2">
                      <div className="p-3 rounded-lg border border-border bg-surface flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-primary text-[20px]">
                            chat
                          </span>
                          <div>
                            <div className="text-xs font-semibold text-text-primary">
                              Web Booking Widget
                            </div>
                            <div className="text-[11px] text-text-secondary">
                              Embeddable online chat
                            </div>
                          </div>
                        </div>
                        <span className="text-[11px] font-mono text-success bg-success/10 px-2 py-0.5 rounded">
                          Enabled
                        </span>
                      </div>

                      <div className="p-3 rounded-lg border border-border bg-surface flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-text-secondary text-[20px]">
                            phone_iphone
                          </span>
                          <div>
                            <div className="text-xs font-semibold text-text-primary">
                              WhatsApp Business
                            </div>
                            <div className="text-[11px] text-text-secondary">Pair in Dashboard</div>
                          </div>
                        </div>
                        <span className="text-[11px] font-mono text-text-secondary bg-surface-container px-2 py-0.5 rounded">
                          Ready to Pair
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 6: Review & Activate */}
                {currentStep === 6 && (
                  <div className="space-y-space-lg">
                    {/* 6 Summary Sections */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm">
                      {/* 1. Profile */}
                      <div className="p-3.5 rounded-lg border border-border bg-surface space-y-1 relative">
                        <div className="flex items-center justify-between">
                          <span className="font-label-sm text-label-sm font-semibold text-primary uppercase">
                            01 Business Profile
                          </span>
                          <button
                            type="button"
                            onClick={() => setCurrentStep(1)}
                            className="text-xs text-text-secondary hover:text-primary underline"
                          >
                            Edit
                          </button>
                        </div>
                        <div className="font-medium text-sm text-text-primary">
                          {state.businessName}
                        </div>
                        <div className="text-xs text-text-secondary">
                          {CATEGORY_METADATA[state.category].label} • {state.country}
                        </div>
                        <div className="text-xs text-text-secondary">{state.phone}</div>
                      </div>

                      {/* 2. Services */}
                      <div className="p-3.5 rounded-lg border border-border bg-surface space-y-1 relative">
                        <div className="flex items-center justify-between">
                          <span className="font-label-sm text-label-sm font-semibold text-primary uppercase">
                            02 Services & Staff
                          </span>
                          <button
                            type="button"
                            onClick={() => setCurrentStep(2)}
                            className="text-xs text-text-secondary hover:text-primary underline"
                          >
                            Edit
                          </button>
                        </div>
                        <div className="font-medium text-sm text-text-primary">
                          {state.services.length} active service
                          {state.services.length === 1 ? '' : 's'}
                        </div>
                        <div className="text-xs text-text-secondary">
                          {state.selfProvided
                            ? 'Solo provider'
                            : `${state.staff.length} staff members`}
                        </div>
                        <div className="text-xs text-text-secondary">
                          Ranging from ₦
                          {Math.min(...state.services.map((s) => s.price)).toLocaleString()}
                        </div>
                      </div>

                      {/* 3. Hours */}
                      <div className="p-3.5 rounded-lg border border-border bg-surface space-y-1 relative">
                        <div className="flex items-center justify-between">
                          <span className="font-label-sm text-label-sm font-semibold text-primary uppercase">
                            03 Working Hours
                          </span>
                          <button
                            type="button"
                            onClick={() => setCurrentStep(3)}
                            className="text-xs text-text-secondary hover:text-primary underline"
                          >
                            Edit
                          </button>
                        </div>
                        <div className="font-medium text-sm text-text-primary">
                          {Object.values(state.schedule).filter((s) => s.open).length} days open /
                          week
                        </div>
                        <div className="text-xs text-text-secondary">
                          Timezone: {state.timezone}
                        </div>
                        <div className="text-xs text-text-secondary">
                          Up to {state.advanceDays} days in advance
                        </div>
                      </div>

                      {/* 4. Deposits */}
                      <div className="p-3.5 rounded-lg border border-border bg-surface space-y-1 relative">
                        <div className="flex items-center justify-between">
                          <span className="font-label-sm text-label-sm font-semibold text-primary uppercase">
                            04 Booking & Deposits
                          </span>
                          <button
                            type="button"
                            onClick={() => setCurrentStep(4)}
                            className="text-xs text-text-secondary hover:text-primary underline"
                          >
                            Edit
                          </button>
                        </div>
                        <div className="font-medium text-sm text-text-primary">
                          {state.depositRequired
                            ? `₦${state.depositAmount.toLocaleString()} Kora Deposit`
                            : 'No Deposit'}
                        </div>
                        <div className="text-xs text-text-secondary">
                          15-minute slot reservation hold
                        </div>
                        <div className="text-xs text-success flex items-center gap-1 font-mono">
                          <span className="w-1.5 h-1.5 rounded-full bg-success" />
                          Kora payments verified
                        </div>
                      </div>

                      {/* 5. Receptionist */}
                      <div className="p-3.5 rounded-lg border border-border bg-surface space-y-1 relative">
                        <div className="flex items-center justify-between">
                          <span className="font-label-sm text-label-sm font-semibold text-primary uppercase">
                            05 AI Receptionist
                          </span>
                          <button
                            type="button"
                            onClick={() => setCurrentStep(5)}
                            className="text-xs text-text-secondary hover:text-primary underline"
                          >
                            Edit
                          </button>
                        </div>
                        <div className="font-medium text-sm text-text-primary">
                          {state.assistantName} ({state.tone} tone)
                        </div>
                        <div className="text-xs text-text-secondary">{state.language}</div>
                        <div className="text-xs text-text-secondary">
                          {state.faqs.length} pre-trained answers
                        </div>
                      </div>

                      {/* 6. Channels */}
                      <div className="p-3.5 rounded-lg border border-border bg-surface space-y-1 relative">
                        <div className="flex items-center justify-between">
                          <span className="font-label-sm text-label-sm font-semibold text-primary uppercase">
                            06 Channels
                          </span>
                          <button
                            type="button"
                            onClick={() => setCurrentStep(5)}
                            className="text-xs text-text-secondary hover:text-primary underline"
                          >
                            Edit
                          </button>
                        </div>
                        <div className="font-medium text-sm text-text-primary">
                          Web Booking Widget (Live)
                        </div>
                        <div className="text-xs text-text-secondary">
                          WhatsApp Cloud bridge ready
                        </div>
                        <div className="text-xs text-text-secondary">
                          Public link: switchboard.ng/b/fade-republic
                        </div>
                      </div>
                    </div>

                    {/* Launch Actions */}
                    <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setTestTimer(900);
                          setTestModalOpen(true);
                        }}
                        className="w-full sm:w-auto px-4 py-2.5 rounded-lg border border-border bg-surface hover:bg-surface-container-low text-text-primary font-label-md text-label-md font-medium flex items-center justify-center gap-2 shadow-sm transition-colors"
                      >
                        <span className="material-symbols-outlined text-[18px] text-primary">
                          play_circle
                        </span>
                        Test Booking Flow
                      </button>

                      <button
                        type="button"
                        onClick={() => router.push('/dashboard')}
                        className="w-full sm:w-auto px-4 py-2.5 rounded-lg border border-border bg-surface hover:bg-surface-container-low text-text-secondary font-label-md text-label-md font-medium text-center transition-colors"
                      >
                        Save & Go to Dashboard
                      </button>

                      <button
                        type="button"
                        onClick={() => router.push('/dashboard')}
                        className="w-full sm:flex-1 py-2.5 px-5 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md font-semibold flex items-center justify-center gap-2 shadow-sm transition-all"
                      >
                        <span className="material-symbols-outlined text-[18px]">rocket_launch</span>
                        Activate Workspace
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Persistent Bottom Navigation Footer */}
            <div className="p-space-md lg:p-space-lg border-t border-border bg-surface flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={handleBack}
                disabled={currentStep === 1}
                className="px-4 py-2 rounded-lg border border-border text-text-primary hover:bg-surface-container-low font-label-md text-label-md font-medium disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                Back
              </button>

              <div className="hidden sm:flex items-center gap-2 text-text-secondary text-xs">
                <span className="material-symbols-outlined text-[16px] text-success">
                  check_circle
                </span>
                <span>All changes saved</span>
              </div>

              <div className="flex items-center gap-3">
                {currentStep < 6 && (
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentStep((prev) => prev + 1);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="text-text-secondary hover:text-text-primary text-xs font-medium px-2 py-1"
                  >
                    Skip
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleContinue}
                  className="px-5 py-2 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md font-medium flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <span>{currentStep === 6 ? 'Activate Workspace' : 'Continue'}</span>
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
              </div>
            </div>
          </section>
        </main>
      </div>

      {/* Test Booking Simulation Modal */}
      {testModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-surface rounded-xl border border-border shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary-container flex items-center justify-center text-on-primary">
                  <span className="material-symbols-outlined text-[18px]">science</span>
                </div>
                <div>
                  <h3 className="font-semibold text-text-primary text-sm">
                    Safe Test Booking Simulation
                  </h3>
                  <p className="text-xs text-text-secondary">Sandbox Mode • No live charges</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTestModalOpen(false)}
                className="text-text-secondary hover:text-text-primary p-1"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="p-3 rounded-lg bg-surface-container-low border border-border space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-text-secondary">Service:</span>
                <span className="font-semibold text-text-primary">
                  {state.services[0]?.name || 'Classic Haircut'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Assigned Staff:</span>
                <span className="font-semibold text-text-primary">
                  {state.staff[0]?.name || 'Lead Barber'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Slot Hold Timer:</span>
                <span className="font-mono font-bold text-primary">
                  {Math.floor(testTimer / 60)}:{(testTimer % 60).toString().padStart(2, '0')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Kora Required Deposit:</span>
                <span className="font-semibold text-success">
                  ₦{state.depositAmount.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-primary-fixed/20 border border-primary/20 text-[11px] text-text-secondary">
              🔒 <strong>Invariant Verification</strong>: The slot will be tentatively held for
              exactly 15 minutes. Confirmation only occurs when Kora transaction status returns{' '}
              <code>success</code>.
            </div>

            <button
              type="button"
              onClick={() => setTestModalOpen(false)}
              className="w-full py-2 rounded-lg bg-primary text-on-primary font-medium text-xs shadow-sm hover:bg-primary-container transition-colors"
            >
              Close Test Preview
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="w-full py-4 text-center text-xs text-text-secondary">
        © 2026 Switchboard Technologies Inc. All rights reserved.
      </footer>
    </div>
  );
}
