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
    <div className="min-h-screen bg-[#F7F8FB] font-sans text-[#111827] antialiased flex flex-col justify-between selection:bg-[#6258E8] selection:text-white">
      {/* Top Header */}
      <header className="w-full py-5 px-6">
        <div className="max-w-[1120px] mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-[#6258E8] flex items-center justify-center text-white shadow-sm transition-transform group-hover:scale-105">
              <span className="material-symbols-outlined text-[20px]">hub</span>
            </div>
            <span className="text-xl font-bold tracking-tight text-[#111827]">Switchboard</span>
          </Link>

          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-slate-500 font-mono font-medium hidden sm:inline-block">
              Workspace Setup
            </span>
            <span className="px-2 py-0.5 rounded-full bg-[#dbe2f8] text-[#3f4758] text-[11px] font-mono font-medium">
              v2.4
            </span>
          </div>
        </div>
      </header>

      {/* Main Persistent Layout Container */}
      <main className="w-full flex-1 flex items-center justify-center px-4 sm:px-6 py-4">
        <div className="w-full max-w-[1120px] bg-white rounded-xl border border-slate-200 shadow-[0_1px_3px_0_rgba(16,24,39,0.04),0_1px_2px_-1px_rgba(16,24,39,0.04)] overflow-hidden flex flex-col lg:flex-row min-h-[660px]">
          {/* Left Persistent Sidebar (35%) */}
          <aside className="w-full lg:w-[35%] bg-[#f2f3f6] p-6 lg:p-8 border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col justify-between">
            <div className="space-y-6">
              <div className="space-y-1">
                <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold block">
                  Onboarding Wizard
                </span>
                <h1 className="text-xl font-bold text-[#111827] tracking-tight">Get Started</h1>
                <p className="text-xs text-slate-500 mt-1">
                  Configure your appointment engine in 6 quick stages.
                </p>
              </div>

              {/* Vertical Stepper with continuous line */}
              <nav aria-label="Onboarding Progress" className="relative flex flex-col gap-6 py-2">
                <div className="absolute left-[15px] top-4 bottom-4 w-[2px] bg-slate-200 z-0" />

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
                      className="group relative z-10 flex items-start gap-3.5 text-left transition-opacity"
                    >
                      <span
                        className={`w-8 h-8 rounded-full text-xs font-mono font-medium flex items-center justify-center shrink-0 transition-all ${
                          isActive
                            ? 'bg-[#6258E8] text-white shadow-sm ring-4 ring-[#6258E8]/15 font-semibold'
                            : isDone
                              ? 'bg-[#10B981] text-white'
                              : 'border border-slate-200 bg-white text-slate-500 group-hover:border-[#6258E8] group-hover:text-[#6258E8]'
                        }`}
                      >
                        {isDone ? (
                          <span className="material-symbols-outlined text-[16px]">check</span>
                        ) : (
                          `0${step.id}`
                        )}
                      </span>

                      <div className="space-y-0.5 pt-0.5">
                        <div
                          className={`text-xs font-semibold transition-colors ${
                            isActive
                              ? 'text-[#111827]'
                              : 'text-slate-700 group-hover:text-[#111827]'
                          }`}
                        >
                          {step.label}
                        </div>
                        <div className="text-[11px] text-slate-500">{step.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Sidebar Engine Status */}
            <div className="pt-6 mt-6 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <span>Switchboard Engine</span>
              <span className="text-xs font-mono font-medium text-[#10B981] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#10B981] inline-block animate-pulse" />
                Live
              </span>
            </div>
          </aside>

          {/* Right Persistent Content Panel (65%) */}
          <section className="w-full lg:w-[65%] flex flex-col justify-between bg-white">
            {/* Scrollable Form Region */}
            <div className="p-6 lg:p-8 flex-1 overflow-y-auto">
              <div className="flex flex-col gap-6">
                {/* Step Header Context */}
                <div className="space-y-1.5 border-b border-slate-100 pb-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wider text-[#6258E8] font-bold">
                      Step 0{currentStep} of 06
                    </span>

                    <div className="flex items-center gap-1.5 bg-[#f2f3f6] px-2.5 py-1 rounded-full border border-slate-200/50">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          saveStatus === 'saved' ? 'bg-[#10B981]' : 'bg-[#6258E8] animate-pulse'
                        }`}
                      />
                      <span className="text-xs font-mono text-slate-500">
                        {saveStatus === 'saved' ? 'Profile Draft Sync' : 'Saving Changes...'}
                      </span>
                    </div>
                  </div>

                  <h2 className="text-2xl font-bold text-[#111827] tracking-tight">
                    {currentStep === 1 && 'Tell us about your business'}
                    {currentStep === 2 && 'What services do you offer?'}
                    {currentStep === 3 && 'When are you available?'}
                    {currentStep === 4 && 'How should appointments be confirmed?'}
                    {currentStep === 5 && 'Meet your AI receptionist'}
                    {currentStep === 6 && 'Your business is almost ready'}
                  </h2>

                  <p className="text-sm text-slate-500 max-w-xl">
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
                  <div className="space-y-5">
                    {/* Business Name */}
                    <div className="space-y-1.5">
                      <label
                        htmlFor="biz-name"
                        className="text-xs font-semibold text-[#111827] flex items-center justify-between"
                      >
                        <span>
                          Official Business Name <span className="text-[#ba1a1a]">*</span>
                        </span>
                        <span className="text-xs font-normal text-slate-500">
                          Public display name
                        </span>
                      </label>
                      <div className="relative rounded-lg shadow-xs">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                          <span className="material-symbols-outlined text-[18px]">domain</span>
                        </div>
                        <input
                          id="biz-name"
                          type="text"
                          value={state.businessName}
                          onChange={(e) => updateState({ businessName: e.target.value })}
                          placeholder="e.g. Acme Studio Inc."
                          className={`w-full pl-9 pr-10 py-2.5 bg-white text-[#111827] text-sm rounded-lg border ${
                            errors.businessName
                              ? 'border-[#ba1a1a] ring-1 ring-[#ba1a1a]'
                              : 'border-slate-200'
                          } focus:ring-2 focus:ring-[#6258E8] focus:border-transparent outline-none transition-all shadow-xs`}
                        />
                        {state.businessName && (
                          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-[#10B981]">
                            <span className="material-symbols-outlined text-[18px]">verified</span>
                          </div>
                        )}
                      </div>
                      {errors.businessName && (
                        <p className="text-xs text-[#ba1a1a] font-medium">{errors.businessName}</p>
                      )}
                    </div>

                    {/* Industry Cards */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#111827]">
                          Primary Business Category <span className="text-[#ba1a1a]">*</span>
                        </span>
                        <span className="text-xs text-slate-500">
                          Tailors reasoning prompts & schema
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {(Object.keys(CATEGORY_METADATA) as BusinessCategory[]).map((catKey) => {
                          const meta = CATEGORY_METADATA[catKey];
                          const isSelected = state.category === catKey;

                          return (
                            <button
                              key={catKey}
                              type="button"
                              onClick={() => handleCategorySelect(catKey)}
                              className={`p-3.5 rounded-lg border text-left flex items-start gap-3 transition-all relative cursor-pointer ${
                                isSelected
                                  ? 'border-[#6258E8] ring-2 ring-[#6258E8]/20 bg-[#6258E8]/5 shadow-xs'
                                  : 'border-slate-200 bg-white hover:bg-slate-50/80 shadow-xs'
                              }`}
                            >
                              <div
                                className={`w-8 h-8 rounded flex items-center justify-center shrink-0 mt-0.5 ${
                                  isSelected
                                    ? 'bg-[#6258E8]/10 text-[#6258E8]'
                                    : 'bg-slate-100 text-slate-500'
                                }`}
                              >
                                <span className="material-symbols-outlined text-[20px]">
                                  {meta.icon}
                                </span>
                              </div>
                              <div className="flex-1 min-w-0 pr-4">
                                <p className="text-xs font-semibold text-[#111827] truncate">
                                  {meta.label}
                                </p>
                                <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                  {meta.sub}
                                </p>
                              </div>
                              {isSelected && (
                                <span className="material-symbols-outlined text-[#6258E8] text-[18px] absolute top-3 right-3">
                                  check_circle
                                </span>
                              )}
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
                          className="text-xs font-semibold text-[#111827] block"
                        >
                          Country of Registry
                        </label>
                        <div className="relative rounded-lg shadow-xs">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <span className="material-symbols-outlined text-[18px]">public</span>
                          </div>
                          <select
                            id="biz-country"
                            value={state.country}
                            onChange={(e) => updateState({ country: e.target.value })}
                            className="w-full pl-9 pr-8 py-2.5 bg-white text-[#111827] text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-[#6258E8] focus:border-transparent outline-none appearance-none cursor-pointer"
                          >
                            <option value="Nigeria">Nigeria (NG)</option>
                            <option value="Ghana">Ghana (GH)</option>
                            <option value="Kenya">Kenya (KE)</option>
                          </select>
                          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                            <span className="material-symbols-outlined text-[18px]">
                              expand_more
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label
                          htmlFor="biz-timezone"
                          className="text-xs font-semibold text-[#111827] block"
                        >
                          Operating Timezone
                        </label>
                        <div className="relative rounded-lg shadow-xs">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <span className="material-symbols-outlined text-[18px]">schedule</span>
                          </div>
                          <select
                            id="biz-timezone"
                            value={state.timezone}
                            onChange={(e) => updateState({ timezone: e.target.value })}
                            className="w-full pl-9 pr-8 py-2.5 bg-white text-[#111827] text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-[#6258E8] focus:border-transparent outline-none appearance-none cursor-pointer"
                          >
                            <option value="Africa/Lagos (GMT+1)">Africa/Lagos (GMT+1)</option>
                            <option value="Africa/Accra (GMT)">Africa/Accra (GMT)</option>
                            <option value="Africa/Nairobi (GMT+3)">Africa/Nairobi (GMT+3)</option>
                          </select>
                          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                            <span className="material-symbols-outlined text-[18px]">
                              expand_more
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Phone & Address */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label
                            htmlFor="biz-phone"
                            className="text-xs font-semibold text-[#111827]"
                          >
                            Dispatch Phone <span className="text-[#ba1a1a]">*</span>
                          </label>
                          <span className="text-xs text-slate-500">Voice & SMS bridge</span>
                        </div>
                        <div className="relative rounded-lg shadow-xs">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <span className="material-symbols-outlined text-[18px]">call</span>
                          </div>
                          <input
                            id="biz-phone"
                            type="tel"
                            value={state.phone}
                            onChange={(e) => updateState({ phone: e.target.value })}
                            placeholder="+234 803 000 0000"
                            className={`w-full pl-9 pr-9 py-2.5 bg-white text-[#111827] text-sm font-mono rounded-lg border ${
                              errors.phone
                                ? 'border-[#ba1a1a] ring-1 ring-[#ba1a1a]'
                                : 'border-slate-200'
                            } focus:ring-2 focus:ring-[#6258E8] focus:border-transparent outline-none`}
                          />
                          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                            <span className="material-symbols-outlined text-[18px]">dialpad</span>
                          </div>
                        </div>
                        {errors.phone && (
                          <p className="text-xs text-[#ba1a1a] font-medium">{errors.phone}</p>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label
                            htmlFor="biz-address"
                            className="text-xs font-semibold text-[#111827]"
                          >
                            Physical Address
                          </label>
                          <span className="text-xs text-slate-500">Optional</span>
                        </div>
                        <div className="relative rounded-lg shadow-xs">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <span className="material-symbols-outlined text-[18px]">
                              location_on
                            </span>
                          </div>
                          <input
                            id="biz-address"
                            type="text"
                            value={state.address}
                            onChange={(e) => updateState({ address: e.target.value })}
                            placeholder="e.g. KM 10 Idiroko Road, Ota"
                            className="w-full pl-9 pr-3 py-2.5 bg-white text-[#111827] text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-[#6258E8] focus:border-transparent outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Website */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label
                          htmlFor="biz-website"
                          className="text-xs font-semibold text-[#111827]"
                        >
                          Primary Web Domain
                        </label>
                        <span className="text-xs text-slate-500">Auto-ingests FAQ</span>
                      </div>
                      <div className="relative rounded-lg shadow-xs">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                          <span className="material-symbols-outlined text-[18px]">language</span>
                        </div>
                        <input
                          id="biz-website"
                          type="url"
                          value={state.website}
                          onChange={(e) => updateState({ website: e.target.value })}
                          placeholder="https://yourbusiness.ng"
                          className="w-full pl-9 pr-9 py-2.5 bg-white text-[#111827] text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-[#6258E8] focus:border-transparent outline-none"
                        />
                        {state.website && (
                          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-[#10B981]">
                            <span className="material-symbols-outlined text-[18px]">
                              check_circle
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Info Callout */}
                    <div className="flex items-center gap-2 bg-[#f2f3f6]/70 p-3 rounded-lg border border-slate-200/50 text-xs text-slate-600">
                      <span className="material-symbols-outlined text-[18px] text-[#6258E8]">
                        info
                      </span>
                      <span>Changes save automatically to your draft workspace.</span>
                    </div>
                  </div>
                )}

                {/* Step 2: Services & Staff */}
                {currentStep === 2 && (
                  <div className="space-y-6">
                    {/* Services Section */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-base font-bold text-[#111827]">Bookable Services</h3>
                          <p className="text-xs text-slate-500">
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
                          className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-[#6258E8] hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
                        >
                          <span className="material-symbols-outlined text-[16px]">add</span>
                          Add Service
                        </button>
                      </div>

                      {errors.services && (
                        <p className="text-xs text-[#ba1a1a] font-medium">{errors.services}</p>
                      )}

                      <div className="space-y-3">
                        {state.services.map((svc, idx) => (
                          <div
                            key={svc.id}
                            className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-2.5 hover:border-[#6258E8]/30 transition-colors shadow-xs"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 grid grid-cols-1 sm:grid-cols-12 gap-3">
                                <div className="sm:col-span-6">
                                  <label
                                    htmlFor={`svc-name-${svc.id}`}
                                    className="text-[11px] text-slate-500 font-medium block mb-1"
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
                                    className="w-full px-3 py-1.5 bg-white text-[#111827] text-xs font-medium rounded-md border border-slate-200 focus:ring-1 focus:ring-[#6258E8] outline-none"
                                  />
                                </div>

                                <div className="sm:col-span-3">
                                  <label
                                    htmlFor={`svc-duration-${svc.id}`}
                                    className="text-[11px] text-slate-500 font-medium block mb-1"
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
                                    className="w-full px-2 py-1.5 bg-white text-[#111827] text-xs rounded-md border border-slate-200 focus:ring-1 focus:ring-[#6258E8] outline-none cursor-pointer"
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
                                    className="text-[11px] text-slate-500 font-medium block mb-1"
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
                                    className="w-full px-3 py-1.5 bg-white text-[#111827] text-xs font-semibold rounded-md border border-slate-200 focus:ring-1 focus:ring-[#6258E8] outline-none"
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
                                className="p-1 text-slate-400 hover:text-[#ba1a1a] rounded transition-colors"
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
                              className="w-full px-2.5 py-1 bg-slate-50 text-slate-500 text-xs rounded border border-slate-200/60 focus:ring-1 focus:ring-[#6258E8] outline-none"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Staff Members Section */}
                    <div className="space-y-3 pt-4 border-t border-slate-100">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-base font-bold text-[#111827]">
                            Staff Roster & Providers
                          </h3>
                          <p className="text-xs text-slate-500">
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
                            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-[#111827] hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5 shadow-xs"
                          >
                            <span className="material-symbols-outlined text-[16px]">
                              person_add
                            </span>
                            Add Staff
                          </button>
                        )}
                      </div>

                      {/* Solo Provider Toggle */}
                      <label className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={state.selfProvided}
                          onChange={(e) => updateState({ selfProvided: e.target.checked })}
                          className="w-4 h-4 text-[#6258E8] rounded border-slate-300 focus:ring-[#6258E8]"
                        />
                        <span className="text-xs font-medium text-[#111827]">
                          I provide all the services myself (Solo operator)
                        </span>
                      </label>

                      {errors.staff && (
                        <p className="text-xs text-[#ba1a1a] font-medium">{errors.staff}</p>
                      )}

                      {!state.selfProvided && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {state.staff.map((member, idx) => (
                            <div
                              key={member.id}
                              className="p-3 rounded-lg border border-slate-200 bg-white space-y-2 relative shadow-xs"
                            >
                              <div className="flex items-start justify-between">
                                <div className="space-y-1 flex-1 pr-2">
                                  <label
                                    htmlFor={`staff-name-${member.id}`}
                                    className="text-[11px] text-slate-500 font-medium block"
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
                                    className="w-full px-2.5 py-1 text-xs font-semibold text-[#111827] rounded border border-slate-200 focus:ring-1 focus:ring-[#6258E8] outline-none"
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
                                  className="text-slate-400 hover:text-[#ba1a1a] p-1"
                                  title="Remove Staff"
                                >
                                  <span className="material-symbols-outlined text-[16px]">
                                    close
                                  </span>
                                </button>
                              </div>

                              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 pt-1">
                                <span className="material-symbols-outlined text-[14px]">
                                  event_available
                                </span>
                                <span>Assigned to all services</span>
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
                  <div className="space-y-5">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-xs font-semibold text-[#111827]">
                        Weekly Working Schedule
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
                          className="px-2.5 py-1 text-xs font-medium rounded border border-slate-200 bg-white hover:bg-slate-50 text-[#111827] transition-colors"
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
                          className="px-2.5 py-1 text-xs font-medium rounded border border-slate-200 bg-white hover:bg-slate-50 text-[#111827] transition-colors"
                        >
                          Copy to Saturday
                        </button>
                      </div>
                    </div>

                    {/* Schedule List */}
                    <div className="space-y-1.5 rounded-lg border border-slate-200 divide-y divide-slate-100 overflow-hidden bg-white">
                      {Object.entries(state.schedule).map(([day, sched]) => (
                        <div
                          key={day}
                          className="px-3.5 py-2.5 flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap"
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
                              className="w-4 h-4 text-[#6258E8] rounded border-slate-300 focus:ring-[#6258E8] cursor-pointer"
                            />
                            <label
                              htmlFor={`day-toggle-${day}`}
                              className={`text-xs font-semibold cursor-pointer ${
                                sched.open ? 'text-[#111827]' : 'text-slate-400 line-through'
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
                                className="px-2.5 py-1 text-xs rounded border border-slate-200 bg-white text-[#111827] font-mono focus:ring-1 focus:ring-[#6258E8] outline-none"
                              />
                              <span className="text-slate-400 text-xs">to</span>
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
                                className="px-2.5 py-1 text-xs rounded border border-slate-200 bg-white text-[#111827] font-mono focus:ring-1 focus:ring-[#6258E8] outline-none"
                              />
                            </div>
                          ) : (
                            <span className="text-[11px] font-mono uppercase text-slate-400 px-2 py-0.5 rounded bg-slate-100">
                              Closed
                            </span>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Advance Limits */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                      <div className="space-y-1.5">
                        <label
                          htmlFor="advance-window"
                          className="text-xs font-semibold text-[#111827] block"
                        >
                          Booking Advance Window
                        </label>
                        <select
                          id="advance-window"
                          value={state.advanceDays}
                          onChange={(e) => updateState({ advanceDays: Number(e.target.value) })}
                          className="w-full py-2.5 px-3 bg-white text-[#111827] text-xs font-medium rounded-lg border border-slate-200 focus:ring-2 focus:ring-[#6258E8] outline-none"
                        >
                          <option value={7}>Up to 7 days in advance</option>
                          <option value={14}>Up to 14 days in advance</option>
                          <option value={30}>Up to 30 days in advance</option>
                          <option value={60}>Up to 60 days in advance</option>
                        </select>
                      </div>

                      <div className="space-y-1.5 flex flex-col justify-end">
                        <label className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={state.allowSameDay}
                            onChange={(e) => updateState({ allowSameDay: e.target.checked })}
                            className="w-4 h-4 text-[#6258E8] rounded border-slate-300 focus:ring-[#6258E8]"
                          />
                          <span className="text-xs font-semibold text-[#111827]">
                            Allow same-day bookings
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 4: Booking & Deposits */}
                {currentStep === 4 && (
                  <div className="space-y-5">
                    {/* Deposit Toggle */}
                    <div className="p-4 rounded-lg border border-slate-200 bg-[#f2f3f6]/40 space-y-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-0.5">
                          <span className="text-xs font-bold text-[#111827] block">
                            Require Upfront Deposit
                          </span>
                          <p className="text-xs text-slate-500">
                            Customers pay a verified deposit through Kora to eliminate no-shows and
                            lock their slot.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => updateState({ depositRequired: !state.depositRequired })}
                          className={`w-11 h-6 rounded-full transition-colors relative focus:outline-none ${
                            state.depositRequired ? 'bg-[#6258E8]' : 'bg-slate-200'
                          }`}
                        >
                          <span
                            className={`w-5 h-5 rounded-full bg-white shadow-sm block transition-transform absolute top-0.5 ${
                              state.depositRequired ? 'translate-x-5' : 'translate-x-0.5'
                            }`}
                          />
                        </button>
                      </div>

                      {state.depositRequired && (
                        <div className="pt-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label
                              htmlFor="dep-amount"
                              className="text-[11px] text-slate-500 font-medium block"
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
                              className="w-full px-3 py-2 bg-white text-[#111827] rounded border border-slate-200 focus:ring-1 focus:ring-[#6258E8] outline-none text-xs font-bold"
                            />
                          </div>

                          <div className="space-y-1">
                            <span className="text-[11px] text-slate-500 font-medium block">
                              Hold Duration Window
                            </span>
                            <div className="px-3 py-2 bg-slate-100 rounded border border-slate-200 text-xs font-mono text-[#111827] flex items-center justify-between">
                              <span>15 Minutes</span>
                              <span className="material-symbols-outlined text-slate-400 text-[16px]">
                                lock
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Invariant Explanation Callout */}
                    <div className="p-4 rounded-lg bg-[#6258E8]/5 border border-[#6258E8]/20 space-y-2">
                      <div className="flex items-center gap-2 text-[#6258E8] font-bold text-xs">
                        <span className="material-symbols-outlined text-[18px]">verified_user</span>
                        <span>Switchboard Correctness Guarantee</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Customers receive a temporary <strong>15-minute slot hold</strong> during
                        checkout. A booking is confirmed <strong>only</strong> after Kora
                        independently verifies the transaction through our cryptographic webhook and
                        server-side query. If payment is uncompleted, the slot releases
                        automatically.
                      </p>
                    </div>

                    {/* Kora Status Badge */}
                    <div className="p-3.5 rounded-lg border border-slate-200 bg-white flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#10B981]/10 flex items-center justify-center text-[#10B981]">
                          <span className="material-symbols-outlined text-[18px]">credit_card</span>
                        </div>
                        <div>
                          <div className="text-xs font-bold text-[#111827]">
                            Kora Checkout Engine
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Cards, Bank Transfer & USSD in Nigerian Naira
                          </div>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full bg-[#10B981]/10 text-[#10B981] text-xs font-mono font-medium flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                        Connected
                      </span>
                    </div>

                    {/* Cancellation Policy */}
                    <div className="space-y-1.5">
                      <label
                        htmlFor="cancellation-policy"
                        className="text-xs font-semibold text-[#111827] flex items-center justify-between"
                      >
                        <span>Cancellation & Refund Policy</span>
                        <span className="text-xs text-slate-500">Relayed by AI</span>
                      </label>
                      <textarea
                        id="cancellation-policy"
                        rows={2}
                        value={state.cancellationPolicy}
                        onChange={(e) => updateState({ cancellationPolicy: e.target.value })}
                        className="w-full px-3 py-2 bg-white text-[#111827] text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-[#6258E8] outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* Step 5: AI Receptionist */}
                {currentStep === 5 && (
                  <div className="space-y-5">
                    {/* Persona & Tone */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label
                          htmlFor="ai-name"
                          className="text-xs font-semibold text-[#111827] block"
                        >
                          Assistant Name
                        </label>
                        <input
                          id="ai-name"
                          type="text"
                          value={state.assistantName}
                          onChange={(e) => updateState({ assistantName: e.target.value })}
                          className="w-full px-3 py-2.5 bg-white text-[#111827] text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-[#6258E8] outline-none"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <span className="text-xs font-semibold text-[#111827] block">
                          Conversation Tone
                        </span>
                        <div className="grid grid-cols-3 gap-2">
                          {(['Friendly', 'Professional', 'Casual'] as const).map((tone) => (
                            <button
                              key={tone}
                              type="button"
                              onClick={() => updateState({ tone })}
                              className={`py-2 px-2 text-xs font-semibold rounded-lg border text-center transition-all ${
                                state.tone === tone
                                  ? 'border-[#6258E8] bg-[#6258E8]/10 text-[#6258E8] ring-1 ring-[#6258E8]'
                                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
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
                        className="text-xs font-semibold text-[#111827] flex items-center justify-between"
                      >
                        <span>Customer Welcome Greeting</span>
                        <span className="text-xs text-slate-500">First message</span>
                      </label>
                      <textarea
                        id="ai-greeting"
                        rows={3}
                        value={state.greeting}
                        onChange={(e) => updateState({ greeting: e.target.value })}
                        className="w-full px-3 py-2 bg-white text-[#111827] text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-[#6258E8] outline-none"
                      />
                    </div>

                    {/* Common FAQs */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#111827]">
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
                          className="text-xs text-[#6258E8] font-semibold hover:underline flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[16px]">add</span>
                          Add FAQ
                        </button>
                      </div>

                      <div className="space-y-2">
                        {state.faqs.map((faq, idx) => (
                          <div
                            key={faq.id}
                            className="p-3 rounded-lg border border-slate-200 bg-white space-y-1.5 shadow-xs"
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
                                className="w-full font-semibold text-xs text-[#111827] border-0 border-b border-transparent focus:border-[#6258E8] outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  updateState((prev) => ({
                                    ...prev,
                                    faqs: prev.faqs.filter((_, i) => i !== idx),
                                  }));
                                }}
                                className="text-slate-400 hover:text-[#ba1a1a] text-xs"
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
                              className="w-full text-xs text-slate-500 border-0 outline-none"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Channels Configuration */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div className="p-3 rounded-lg border border-slate-200 bg-white flex items-center justify-between shadow-xs">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[#6258E8] text-[20px]">
                            chat
                          </span>
                          <div>
                            <div className="text-xs font-bold text-[#111827]">
                              Web Booking Widget
                            </div>
                            <div className="text-[11px] text-slate-500">Embeddable online chat</div>
                          </div>
                        </div>
                        <span className="text-[11px] font-mono text-[#10B981] bg-[#10B981]/10 px-2 py-0.5 rounded font-medium">
                          Enabled
                        </span>
                      </div>

                      <div className="p-3 rounded-lg border border-slate-200 bg-white flex items-center justify-between shadow-xs">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-slate-400 text-[20px]">
                            phone_iphone
                          </span>
                          <div>
                            <div className="text-xs font-bold text-[#111827]">
                              WhatsApp Business
                            </div>
                            <div className="text-[11px] text-slate-500">Pair in Dashboard</div>
                          </div>
                        </div>
                        <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-medium">
                          Ready to Pair
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 6: Review & Activate */}
                {currentStep === 6 && (
                  <div className="space-y-5">
                    {/* 6 Summary Sections */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* 1. Profile */}
                      <div className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-1 relative shadow-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-[#6258E8] uppercase font-mono">
                            01 Business Profile
                          </span>
                          <button
                            type="button"
                            onClick={() => setCurrentStep(1)}
                            className="text-xs text-slate-500 hover:text-[#6258E8] underline font-medium"
                          >
                            Edit
                          </button>
                        </div>
                        <div className="font-bold text-xs text-[#111827]">{state.businessName}</div>
                        <div className="text-[11px] text-slate-500">
                          {CATEGORY_METADATA[state.category].label} • {state.country}
                        </div>
                        <div className="text-[11px] text-slate-500">{state.phone}</div>
                      </div>

                      {/* 2. Services */}
                      <div className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-1 relative shadow-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-[#6258E8] uppercase font-mono">
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
                        <div className="font-bold text-xs text-[#111827]">
                          {state.services.length} active service
                          {state.services.length === 1 ? '' : 's'}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {state.selfProvided
                            ? 'Solo provider'
                            : `${state.staff.length} staff members`}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          From ₦{Math.min(...state.services.map((s) => s.price)).toLocaleString()}
                        </div>
                      </div>

                      {/* 3. Hours */}
                      <div className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-1 relative shadow-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-[#6258E8] uppercase font-mono">
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
                        <div className="font-bold text-xs text-[#111827]">
                          {Object.values(state.schedule).filter((s) => s.open).length} days open /
                          week
                        </div>
                        <div className="text-[11px] text-slate-500">{state.timezone}</div>
                        <div className="text-[11px] text-slate-500">
                          Up to {state.advanceDays} days ahead
                        </div>
                      </div>

                      {/* 4. Deposits */}
                      <div className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-1 relative shadow-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-[#6258E8] uppercase font-mono">
                            04 Booking & Deposits
                          </span>
                          <button
                            type="button"
                            onClick={() => setCurrentStep(4)}
                            className="text-xs text-slate-500 hover:text-[#6258E8] underline font-medium"
                          >
                            Edit
                          </button>
                        </div>
                        <div className="font-bold text-xs text-[#111827]">
                          {state.depositRequired
                            ? `₦${state.depositAmount.toLocaleString()} Kora Deposit`
                            : 'No Deposit'}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          15-minute slot reservation hold
                        </div>
                        <div className="text-[11px] text-[#10B981] flex items-center gap-1 font-mono">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                          Kora payments verified
                        </div>
                      </div>

                      {/* 5. Receptionist */}
                      <div className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-1 relative shadow-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-[#6258E8] uppercase font-mono">
                            05 AI Receptionist
                          </span>
                          <button
                            type="button"
                            onClick={() => setCurrentStep(5)}
                            className="text-xs text-slate-500 hover:text-[#6258E8] underline font-medium"
                          >
                            Edit
                          </button>
                        </div>
                        <div className="font-bold text-xs text-[#111827]">
                          {state.assistantName} ({state.tone} tone)
                        </div>
                        <div className="text-[11px] text-slate-500">{state.language}</div>
                        <div className="text-[11px] text-slate-500">
                          {state.faqs.length} pre-trained answers
                        </div>
                      </div>

                      {/* 6. Channels */}
                      <div className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-1 relative shadow-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-[#6258E8] uppercase font-mono">
                            06 Channels
                          </span>
                          <button
                            type="button"
                            onClick={() => setCurrentStep(5)}
                            className="text-xs text-slate-500 hover:text-[#6258E8] underline font-medium"
                          >
                            Edit
                          </button>
                        </div>
                        <div className="font-bold text-xs text-[#111827]">
                          Web Booking Widget (Live)
                        </div>
                        <div className="text-[11px] text-slate-500">WhatsApp bridge ready</div>
                        <div className="text-[11px] text-slate-500">
                          switchboard.ng/b/fade-republic
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
                        className="w-full sm:w-auto px-4 py-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[#111827] text-xs font-semibold flex items-center justify-center gap-2 shadow-xs transition-colors"
                      >
                        <span className="material-symbols-outlined text-[18px] text-[#6258E8]">
                          play_circle
                        </span>
                        Test Booking Flow
                      </button>

                      <button
                        type="button"
                        onClick={() => router.push('/dashboard')}
                        className="w-full sm:w-auto px-4 py-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold text-center transition-colors"
                      >
                        Save & Go to Dashboard
                      </button>

                      <button
                        type="button"
                        onClick={() => router.push('/dashboard')}
                        className="w-full sm:flex-1 py-2.5 px-5 rounded-lg bg-[#6258E8] hover:bg-[#5247d8] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all"
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
            <footer className="p-5 lg:p-6 border-t border-slate-200 bg-white flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={handleBack}
                disabled={currentStep === 1}
                className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:text-[#111827] hover:bg-slate-50 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                Back
              </button>

              <div className="hidden sm:flex items-center gap-1.5 text-slate-500 text-xs font-medium">
                <span className="material-symbols-outlined text-[18px] text-[#10B981]">
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
                    className="text-slate-500 hover:text-[#111827] text-xs font-semibold px-2 py-1"
                  >
                    Skip
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleContinue}
                  className="px-5 py-2 rounded-lg bg-[#6258E8] hover:bg-[#5247d8] text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <span>{currentStep === 6 ? 'Activate Workspace' : 'Continue'}</span>
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
              </div>
            </footer>
          </section>
        </div>
      </main>

      {/* Test Booking Simulation Modal */}
      {testModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-xl border border-slate-200 shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#6258E8] flex items-center justify-center text-white">
                  <span className="material-symbols-outlined text-[18px]">science</span>
                </div>
                <div>
                  <h3 className="font-bold text-[#111827] text-sm">Test Booking Preview</h3>
                  <p className="text-xs text-slate-500">Sandbox Mode • No live charges</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTestModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Service:</span>
                <span className="font-semibold text-[#111827]">
                  {state.services[0]?.name || 'Classic Haircut'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Assigned Staff:</span>
                <span className="font-semibold text-[#111827]">
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
                <span className="font-semibold text-[#10B981]">
                  ₦{state.depositAmount.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-[#6258E8]/5 border border-[#6258E8]/15 text-[11px] text-slate-600">
              🔒 <strong>Invariant Verification</strong>: The slot will be tentatively held for
              exactly 15 minutes. Confirmation only occurs when Kora transaction status returns{' '}
              <code>success</code>.
            </div>

            <button
              type="button"
              onClick={() => setTestModalOpen(false)}
              className="w-full py-2 rounded-lg bg-[#6258E8] text-white font-semibold text-xs shadow-sm hover:bg-[#5247d8] transition-colors"
            >
              Close Test Preview
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="w-full py-4 text-center text-xs text-slate-400">
        © 2026 Switchboard Technologies Inc. All rights reserved.
      </footer>
    </div>
  );
}
