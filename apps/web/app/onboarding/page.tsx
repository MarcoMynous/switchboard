'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export type BusinessCategory = 'barber' | 'beauty' | 'auto' | 'property';

export interface ServiceItem {
  id: string;
  name: string;
  duration: number; // minutes
  price: number; // in Naira
  depositRequired: boolean;
  depositAmount: number; // in Naira
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

export interface OnboardingState {
  // Step 1: Business details
  businessName: string;
  category: BusinessCategory;
  phone: string;
  location: string;
  instagramOrWeb: string;

  // Step 2: Services & staff
  services: ServiceItem[];
  staff: StaffItem[];
  selfProvided: boolean;

  // Step 3: Working hours
  schedule: Record<string, DaySchedule>;
  advanceDays: number;

  // Step 4: Deposits & Kora
  depositRequired: boolean;
  depositAmount: number;
  koraStatus: 'ready' | 'pending';

  // Step 5: AI receptionist
  assistantName: string;
  greeting: string;
  tone: 'Friendly' | 'Professional' | 'Casual';

  // Step 6: Review & launch
  slug: string;
}

const CATEGORY_PRESETS: Record<
  BusinessCategory,
  { label: string; sub: string; icon: string; defaultServices: ServiceItem[] }
> = {
  barber: {
    label: 'Salon & Barbershop',
    sub: 'Barbers, stylists & grooming',
    icon: 'content_cut',
    defaultServices: [
      {
        id: '1',
        name: 'Classic Fade & Beard Sculpt',
        duration: 45,
        price: 5000,
        depositRequired: true,
        depositAmount: 1500,
      },
      {
        id: '2',
        name: 'Standard Haircut',
        duration: 30,
        price: 3500,
        depositRequired: true,
        depositAmount: 1000,
      },
      {
        id: '3',
        name: 'VIP Dreadlocks Retwist & Wash',
        duration: 90,
        price: 15000,
        depositRequired: true,
        depositAmount: 5000,
      },
    ],
  },
  beauty: {
    label: 'Beauty & Spa',
    sub: 'Lashes, nails, makeup & massage',
    icon: 'spa',
    defaultServices: [
      {
        id: '1',
        name: 'Gel Manicure & Pedicure',
        duration: 60,
        price: 12000,
        depositRequired: true,
        depositAmount: 3000,
      },
      {
        id: '2',
        name: 'Deep Tissue Massage (60m)',
        duration: 60,
        price: 20000,
        depositRequired: true,
        depositAmount: 5000,
      },
      {
        id: '3',
        name: 'Hydrating Glow Facial',
        duration: 75,
        price: 18000,
        depositRequired: true,
        depositAmount: 5000,
      },
    ],
  },
  auto: {
    label: 'Auto Services',
    sub: 'Diagnostics, detailing & mechanics',
    icon: 'directions_car',
    defaultServices: [
      {
        id: '1',
        name: 'Full Engine Diagnostic Scan',
        duration: 45,
        price: 10000,
        depositRequired: true,
        depositAmount: 3000,
      },
      {
        id: '2',
        name: 'Executive Detailing & Wash',
        duration: 120,
        price: 25000,
        depositRequired: true,
        depositAmount: 8000,
      },
    ],
  },
  property: {
    label: 'Property & Viewings',
    sub: 'Guided walkthroughs & inspections',
    icon: 'apartment',
    defaultServices: [
      {
        id: '1',
        name: 'Guided Apartment Inspection',
        duration: 45,
        price: 5000,
        depositRequired: true,
        depositAmount: 2000,
      },
      {
        id: '2',
        name: 'Commercial Space Walkthrough',
        duration: 60,
        price: 8000,
        depositRequired: true,
        depositAmount: 3000,
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
  location: 'Ota, Ogun State',
  instagramOrWeb: 'https://instagram.com/faderepublic',
  services: [
    {
      id: '1',
      name: 'Classic Fade & Beard Sculpt',
      duration: 45,
      price: 5000,
      depositRequired: true,
      depositAmount: 1500,
    },
    {
      id: '2',
      name: 'Standard Haircut',
      duration: 30,
      price: 3500,
      depositRequired: true,
      depositAmount: 1000,
    },
    {
      id: '3',
      name: 'VIP Dreadlocks Retwist & Wash',
      duration: 90,
      price: 15000,
      depositRequired: true,
      depositAmount: 5000,
    },
  ],
  staff: [
    { id: '1', name: 'Tunde Adeyemi', role: 'Lead Barber' },
    { id: '2', name: 'Emeka Okafor', role: 'Fade Specialist' },
  ],
  selfProvided: false,
  schedule: DEFAULT_SCHEDULE,
  advanceDays: 14,
  depositRequired: true,
  depositAmount: 1500,
  koraStatus: 'ready',
  assistantName: 'Maya',
  greeting:
    "Hello! Welcome to Fade Republic. I'm Maya, your AI booking assistant. Would you like to check available slots for today or tomorrow?",
  tone: 'Friendly',
  slug: 'fade-republic',
};

const STEPS = [
  { id: 1, label: 'Your Business', desc: 'Shop name & WhatsApp contact' },
  { id: 2, label: 'Services & Staff', desc: 'Prices in ₦ & team members' },
  { id: 3, label: 'Working Hours', desc: 'Opening days & times' },
  { id: 4, label: 'No-Show Deposits', desc: '15-min hold & Kora deposits' },
  { id: 5, label: 'AI Assistant', desc: 'Welcome greeting & tone' },
  { id: 6, label: 'Review & Launch', desc: 'Your live booking link' },
] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [state, setState] = useState<OnboardingState>(INITIAL_STATE);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Load from local storage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('switchboard_onboarding_draft');
      if (saved) {
        const parsed = JSON.parse(saved);
        setState((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      // ignore
    }
  }, []);

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

  const handleCategoryChange = (category: BusinessCategory) => {
    const meta = CATEGORY_PRESETS[category];
    updateState({
      category,
      services: meta.defaultServices,
    });
  };

  const validateStep = (step: number): boolean => {
    const stepErrors: Record<string, string> = {};
    if (step === 1) {
      if (!state.businessName.trim()) {
        stepErrors.businessName = 'Please enter your business or shop name';
      }
      if (!state.phone.trim()) {
        stepErrors.phone = 'Please enter your booking phone number';
      }
    } else if (step === 2) {
      if (state.services.length === 0) {
        stepErrors.services = 'Please list at least one service customers can book.';
      }
    }
    setErrors(stepErrors);
    return Object.keys(stepErrors).length === 0;
  };

  const handleContinue = () => {
    if (!validateStep(currentStep)) return;
    if (currentStep < 6) {
      setCurrentStep((prev) => prev + 1);
    } else {
      router.push('/dashboard');
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const bookingUrl = `https://switchboard.ng/b/${state.slug}`;

  return (
    <div className="min-h-screen bg-[#F7F8FB] font-sans text-[#111827] antialiased flex flex-col justify-between selection:bg-[#6258E8] selection:text-white">
      {/* Top Header */}
      <header className="w-full py-4 px-6 border-b border-slate-200/60 bg-white/70 backdrop-blur-md">
        <div className="max-w-[1140px] mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-lg bg-[#6258E8] flex items-center justify-center text-white shadow-sm transition-transform group-hover:scale-105">
              <span className="material-symbols-outlined text-[22px]">hub</span>
            </div>
            <span className="text-xl font-bold tracking-tight text-[#111827]">Switchboard</span>
          </Link>

          <div className="flex items-center gap-3">
            <span className="text-xs uppercase tracking-wider text-slate-500 font-mono font-semibold hidden sm:inline-block">
              Setup Wizard
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-[#dbe2f8] text-[#3f4758] text-xs font-mono font-semibold">
              v2.4
            </span>
          </div>
        </div>
      </header>

      {/* Main Single-Page Container (No Scrolling) */}
      <main className="w-full flex-1 flex items-center justify-center px-4 sm:px-6 py-4 lg:py-6">
        <div className="w-full max-w-[1140px] bg-white rounded-2xl border border-slate-200 shadow-[0_2px_8px_0_rgba(16,24,39,0.06)] overflow-hidden flex flex-col lg:flex-row min-h-[580px]">
          {/* Left Persistent Sidebar (35%) */}
          <aside className="w-full lg:w-[34%] bg-[#f2f3f6] p-6 lg:p-7 border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col justify-between">
            <div className="space-y-6">
              <div>
                <span className="text-xs uppercase tracking-wider text-[#6258E8] font-bold block mb-1">
                  Onboarding
                </span>
                <h1 className="text-2xl font-bold text-[#111827] tracking-tight">Get Started</h1>
                <p className="text-sm text-slate-600 mt-1">
                  Set up your business booking flow in 6 easy steps.
                </p>
              </div>

              {/* Vertical Stepper with continuous line */}
              <nav aria-label="Steps" className="relative flex flex-col gap-4 py-1">
                <div className="absolute left-[17px] top-3 bottom-3 w-[2px] bg-slate-200 z-0" />

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
                      className="group relative z-10 flex items-start gap-3.5 text-left transition-all"
                    >
                      <span
                        className={`w-9 h-9 rounded-full text-sm font-mono font-bold flex items-center justify-center shrink-0 transition-all ${
                          isActive
                            ? 'bg-[#6258E8] text-white shadow-md ring-4 ring-[#6258E8]/20'
                            : isDone
                              ? 'bg-[#10B981] text-white'
                              : 'border-2 border-slate-300 bg-white text-slate-500 group-hover:border-[#6258E8]'
                        }`}
                      >
                        {isDone ? (
                          <span className="material-symbols-outlined text-[18px]">check</span>
                        ) : (
                          `0${step.id}`
                        )}
                      </span>

                      <div className="pt-0.5">
                        <div
                          className={`text-sm font-semibold transition-colors ${
                            isActive ? 'text-[#6258E8] font-bold' : 'text-slate-800'
                          }`}
                        >
                          {step.label}
                        </div>
                        <div className="text-xs text-slate-500">{step.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Sidebar Engine Status */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
              <span className="font-medium">Switchboard Engine</span>
              <span className="text-xs font-mono font-bold text-[#10B981] flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] inline-block animate-pulse" />
                Live
              </span>
            </div>
          </aside>

          {/* Right Panel (66%) - Compact & Never Scrollable on desktop */}
          <section className="w-full lg:w-[66%] flex flex-col justify-between bg-white">
            {/* Form Content Area */}
            <div className="p-6 lg:p-7 flex-1 flex flex-col justify-center">
              <div key={currentStep} className="step-animated w-full space-y-4">
                {/* Step Header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <span className="text-xs uppercase tracking-wider text-[#6258E8] font-bold block">
                      Step 0{currentStep} of 06
                    </span>
                    <h2 className="text-xl sm:text-2xl font-bold text-[#111827] tracking-tight mt-0.5">
                      {currentStep === 1 && 'Tell us about your business'}
                      {currentStep === 2 && 'What services do you offer?'}
                      {currentStep === 3 && 'When are you open for bookings?'}
                      {currentStep === 4 && 'Stop no-shows with deposits'}
                      {currentStep === 5 && 'Meet your AI booking assistant'}
                      {currentStep === 6 && 'Your booking link is ready!'}
                    </h2>
                  </div>

                  <div className="flex items-center gap-1.5 bg-[#f2f3f6] px-3 py-1 rounded-full border border-slate-200/50">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        saveStatus === 'saved' ? 'bg-[#10B981]' : 'bg-[#6258E8] animate-pulse'
                      }`}
                    />
                    <span className="text-xs font-medium text-slate-600">
                      {saveStatus === 'saved' ? 'Draft Saved' : 'Saving...'}
                    </span>
                  </div>
                </div>

                {/* STEP 1: Your Business */}
                {currentStep === 1 && (
                  <div className="space-y-4">
                    {/* Business Name */}
                    <div className="space-y-1">
                      <label
                        htmlFor="biz-name"
                        className="text-sm font-semibold text-[#111827] block"
                      >
                        Business or Shop Name <span className="text-[#ba1a1a]">*</span>
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <span className="material-symbols-outlined text-[20px]">storefront</span>
                        </div>
                        <input
                          id="biz-name"
                          type="text"
                          value={state.businessName}
                          onChange={(e) => updateState({ businessName: e.target.value })}
                          placeholder="e.g. Fade Republic, Ota"
                          className="w-full pl-10 pr-4 py-2.5 bg-white text-[#111827] text-sm font-medium rounded-lg border border-slate-200 focus:ring-2 focus:ring-[#6258E8] outline-none shadow-xs"
                        />
                      </div>
                      {errors.businessName && (
                        <p className="text-xs text-[#ba1a1a] font-medium">{errors.businessName}</p>
                      )}
                    </div>

                    {/* Category Selection */}
                    <div className="space-y-1.5">
                      <span className="text-sm font-semibold text-[#111827] block">
                        Category <span className="text-[#ba1a1a]">*</span>
                      </span>
                      <div className="grid grid-cols-2 gap-2.5">
                        {(Object.keys(CATEGORY_PRESETS) as BusinessCategory[]).map((catKey) => {
                          const meta = CATEGORY_PRESETS[catKey];
                          const isSelected = state.category === catKey;

                          return (
                            <button
                              key={catKey}
                              type="button"
                              onClick={() => handleCategoryChange(catKey)}
                              className={`p-3 rounded-lg border text-left flex items-center gap-3 transition-all relative ${
                                isSelected
                                  ? 'border-[#6258E8] ring-2 ring-[#6258E8]/20 bg-[#6258E8]/5'
                                  : 'border-slate-200 bg-white hover:bg-slate-50'
                              }`}
                            >
                              <div
                                className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${
                                  isSelected
                                    ? 'bg-[#6258E8] text-white'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                <span className="material-symbols-outlined text-[18px]">
                                  {meta.icon}
                                </span>
                              </div>
                              <div className="flex-1 min-w-0 pr-4">
                                <div className="text-sm font-semibold text-[#111827] truncate">
                                  {meta.label}
                                </div>
                                <div className="text-xs text-slate-500 truncate">{meta.sub}</div>
                              </div>
                              {isSelected && (
                                <span className="material-symbols-outlined text-[#6258E8] text-[18px] absolute top-2.5 right-2.5">
                                  check_circle
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* WhatsApp & Location */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label
                          htmlFor="biz-phone"
                          className="text-sm font-semibold text-[#111827] block"
                        >
                          WhatsApp / Booking Phone <span className="text-[#ba1a1a]">*</span>
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <span className="material-symbols-outlined text-[18px]">phone</span>
                          </div>
                          <input
                            id="biz-phone"
                            type="tel"
                            value={state.phone}
                            onChange={(e) => updateState({ phone: e.target.value })}
                            placeholder="+234 803 123 4567"
                            className="w-full pl-9 pr-3 py-2 bg-white text-[#111827] text-sm font-mono rounded-lg border border-slate-200 focus:ring-2 focus:ring-[#6258E8] outline-none"
                          />
                        </div>
                        {errors.phone && <p className="text-xs text-[#ba1a1a]">{errors.phone}</p>}
                      </div>

                      <div className="space-y-1">
                        <label
                          htmlFor="biz-location"
                          className="text-sm font-semibold text-[#111827] block"
                        >
                          Shop Location
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <span className="material-symbols-outlined text-[18px]">
                              location_on
                            </span>
                          </div>
                          <input
                            id="biz-location"
                            type="text"
                            value={state.location}
                            onChange={(e) => updateState({ location: e.target.value })}
                            placeholder="e.g. Ota, Ogun State or Lekki, Lagos"
                            className="w-full pl-9 pr-3 py-2 bg-white text-[#111827] text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-[#6258E8] outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Instagram or Website */}
                    <div className="space-y-1">
                      <label
                        htmlFor="biz-ig"
                        className="text-xs font-semibold text-slate-600 block"
                      >
                        Instagram or Website (Optional)
                      </label>
                      <input
                        id="biz-ig"
                        type="text"
                        value={state.instagramOrWeb}
                        onChange={(e) => updateState({ instagramOrWeb: e.target.value })}
                        placeholder="e.g. instagram.com/faderepublic"
                        className="w-full px-3 py-1.5 bg-white text-[#111827] text-xs rounded-lg border border-slate-200 focus:ring-1 focus:ring-[#6258E8] outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* STEP 2: Services & Staff */}
                {currentStep === 2 && (
                  <div className="space-y-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-[#111827]">
                        Bookable Services & Pricing (₦)
                      </span>
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
                                name: 'New Service',
                                duration: 30,
                                price: 4000,
                                depositRequired: true,
                                depositAmount: 1000,
                              },
                            ],
                          }));
                        }}
                        className="text-xs font-bold text-[#6258E8] hover:underline flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[16px]">add</span> Add
                        Service
                      </button>
                    </div>

                    {/* 3 Services Cards in clean rows */}
                    <div className="space-y-2">
                      {state.services.slice(0, 3).map((svc, idx) => (
                        <div
                          key={svc.id}
                          className="p-2.5 rounded-lg border border-slate-200 bg-white flex items-center gap-3 shadow-xs"
                        >
                          <div className="flex-1">
                            <input
                              type="text"
                              value={svc.name}
                              onChange={(e) => {
                                const updated = [...state.services];
                                if (updated[idx]) {
                                  updated[idx] = { ...updated[idx], name: e.target.value };
                                  updateState({ services: updated });
                                }
                              }}
                              className="w-full text-sm font-semibold text-[#111827] border-0 outline-none p-0 focus:text-[#6258E8]"
                            />
                          </div>

                          <div className="w-24">
                            <select
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
                              className="w-full text-xs font-medium text-slate-700 bg-slate-50 py-1 px-1.5 rounded border border-slate-200 outline-none"
                            >
                              <option value={15}>15 mins</option>
                              <option value={30}>30 mins</option>
                              <option value={45}>45 mins</option>
                              <option value={60}>60 mins</option>
                              <option value={90}>90 mins</option>
                            </select>
                          </div>

                          <div className="w-28 flex items-center gap-1 bg-slate-50 py-1 px-2 rounded border border-slate-200">
                            <span className="text-xs font-bold text-slate-500">₦</span>
                            <input
                              type="number"
                              step={500}
                              value={svc.price}
                              onChange={(e) => {
                                const updated = [...state.services];
                                if (updated[idx]) {
                                  updated[idx] = { ...updated[idx], price: Number(e.target.value) };
                                  updateState({ services: updated });
                                }
                              }}
                              className="w-full text-xs font-bold text-[#111827] bg-transparent outline-none p-0"
                            />
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
                            className="text-slate-400 hover:text-red-500 p-1"
                          >
                            <span className="material-symbols-outlined text-[16px]">close</span>
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Staff Row */}
                    <div className="pt-2 border-t border-slate-100 space-y-1.5">
                      <span className="text-xs font-semibold text-[#111827] block">
                        Who provides the appointments?
                      </span>

                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={state.selfProvided}
                            onChange={(e) => updateState({ selfProvided: e.target.checked })}
                            className="w-4 h-4 text-[#6258E8] rounded border-slate-300 focus:ring-[#6258E8]"
                          />
                          <span className="text-xs font-medium text-slate-700">
                            I provide all services myself (Solo operator)
                          </span>
                        </label>
                      </div>

                      {!state.selfProvided && (
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          {state.staff.map((s) => (
                            <div
                              key={s.id}
                              className="p-2 rounded bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                            >
                              <div className="font-semibold text-[#111827]">{s.name}</div>
                              <span className="text-[11px] text-slate-500 font-mono">{s.role}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* STEP 3: Working Hours */}
                {currentStep === 3 && (
                  <div className="space-y-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-[#111827]">
                        Weekly Opening Schedule
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          updateState((prev) => {
                            const updated = { ...prev.schedule };
                            [
                              'Monday',
                              'Tuesday',
                              'Wednesday',
                              'Thursday',
                              'Friday',
                              'Saturday',
                            ].forEach((d) => {
                              updated[d] = { open: true, openTime: '09:00', closeTime: '20:00' };
                            });
                            updated.Sunday = { open: false, openTime: '12:00', closeTime: '18:00' };
                            return { ...prev, schedule: updated };
                          });
                        }}
                        className="text-xs font-bold text-[#6258E8] hover:underline"
                      >
                        Set Mon–Sat (9am – 8pm)
                      </button>
                    </div>

                    <div className="space-y-1 rounded-lg border border-slate-200 divide-y divide-slate-100 overflow-hidden bg-white">
                      {[
                        'Monday',
                        'Tuesday',
                        'Wednesday',
                        'Thursday',
                        'Friday',
                        'Saturday',
                        'Sunday',
                      ].map((day) => {
                        const sched = state.schedule[day] || {
                          open: true,
                          openTime: '09:00',
                          closeTime: '19:00',
                        };
                        return (
                          <div
                            key={day}
                            className="px-3 py-1.5 flex items-center justify-between text-xs"
                          >
                            <label className="flex items-center gap-2.5 w-28 cursor-pointer">
                              <input
                                type="checkbox"
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
                                className="w-3.5 h-3.5 text-[#6258E8] rounded border-slate-300"
                              />
                              <span
                                className={`font-semibold ${sched.open ? 'text-[#111827]' : 'text-slate-400'}`}
                              >
                                {day}
                              </span>
                            </label>

                            {sched.open ? (
                              <div className="flex items-center gap-2">
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
                                  className="px-2 py-0.5 rounded border border-slate-200 text-xs font-mono text-[#111827]"
                                />
                                <span className="text-slate-400">to</span>
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
                                  className="px-2 py-0.5 rounded border border-slate-200 text-xs font-mono text-[#111827]"
                                />
                              </div>
                            ) : (
                              <span className="text-[11px] font-mono text-slate-400 uppercase bg-slate-100 px-2 py-0.5 rounded">
                                Closed
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      <span>Customers can book up to 14 days in advance</span>
                      <span className="font-semibold text-[#10B981] flex items-center gap-1">
                        <span className="material-symbols-outlined text-[16px]">check</span>{' '}
                        Same-day bookings on
                      </span>
                    </div>
                  </div>
                )}

                {/* STEP 4: No-Show Deposits */}
                {currentStep === 4 && (
                  <div className="space-y-3.5">
                    {/* Toggle card */}
                    <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between">
                      <div>
                        <span className="text-sm font-bold text-[#111827] block">
                          Require Booking Deposit
                        </span>
                        <p className="text-xs text-slate-500">
                          Stops no-shows by collecting a small deposit via Kora before confirming.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => updateState({ depositRequired: !state.depositRequired })}
                        className={`w-11 h-6 rounded-full transition-colors relative ${
                          state.depositRequired ? 'bg-[#6258E8]' : 'bg-slate-300'
                        }`}
                      >
                        <span
                          className={`w-5 h-5 rounded-full bg-white block transition-transform absolute top-0.5 shadow-sm ${
                            state.depositRequired ? 'translate-x-5' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                    </div>

                    {state.depositRequired && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label
                            htmlFor="deposit-amount"
                            className="text-xs font-semibold text-[#111827] block"
                          >
                            Deposit Amount (₦)
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">
                              ₦
                            </span>
                            <input
                              id="deposit-amount"
                              type="number"
                              step={500}
                              value={state.depositAmount}
                              onChange={(e) =>
                                updateState({ depositAmount: Number(e.target.value) })
                              }
                              className="w-full pl-7 pr-3 py-1.5 text-sm font-bold text-[#111827] rounded-lg border border-slate-200 focus:ring-2 focus:ring-[#6258E8] outline-none"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <span className="text-xs font-semibold text-[#111827] block">
                            Hold Window
                          </span>
                          <div className="py-1.5 px-3 rounded-lg bg-slate-100 border border-slate-200 text-xs font-mono font-semibold text-[#111827] flex items-center justify-between">
                            <span>15 Minutes</span>
                            <span className="material-symbols-outlined text-[16px] text-slate-400">
                              lock
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Direct 15-min explanation callout */}
                    <div className="p-3 rounded-lg bg-[#6258E8]/5 border border-[#6258E8]/20 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[#6258E8]">
                        <span className="material-symbols-outlined text-[18px]">security</span>
                        <span>How the 15-Minute Deposit Guarantee Works</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        When a customer picks a slot, Switchboard puts a{' '}
                        <strong>15-minute hold</strong> on the calendar. They receive a Kora payment
                        link. The moment payment clears, the appointment is confirmed. If they
                        abandon payment, the slot unlocks automatically for walk-ins.
                      </p>
                    </div>

                    {/* Kora Badge */}
                    <div className="p-2.5 rounded-lg border border-slate-200 bg-white flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[#10B981] text-[18px]">
                          verified
                        </span>
                        <span className="font-semibold text-[#111827]">
                          Kora Payments Engine Ready
                        </span>
                      </div>
                      <span className="text-[#10B981] font-mono font-bold bg-[#10B981]/10 px-2 py-0.5 rounded">
                        Active
                      </span>
                    </div>
                  </div>
                )}

                {/* STEP 5: AI Assistant */}
                {currentStep === 5 && (
                  <div className="space-y-3.5">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
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
                          className="w-full px-3 py-1.5 text-sm font-semibold text-[#111827] rounded-lg border border-slate-200 focus:ring-2 focus:ring-[#6258E8] outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <span className="text-xs font-semibold text-[#111827] block">
                          Conversation Tone
                        </span>
                        <div className="grid grid-cols-3 gap-1.5">
                          {(['Friendly', 'Professional', 'Casual'] as const).map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => updateState({ tone: t })}
                              className={`py-1.5 text-xs font-semibold rounded border transition-all ${
                                state.tone === t
                                  ? 'border-[#6258E8] bg-[#6258E8]/10 text-[#6258E8]'
                                  : 'border-slate-200 bg-white text-slate-600'
                              }`}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label
                        htmlFor="ai-greeting"
                        className="text-xs font-semibold text-[#111827] block"
                      >
                        Welcome Message to Customers
                      </label>
                      <textarea
                        id="ai-greeting"
                        rows={3}
                        value={state.greeting}
                        onChange={(e) => updateState({ greeting: e.target.value })}
                        className="w-full px-3 py-2 text-xs text-[#111827] rounded-lg border border-slate-200 focus:ring-2 focus:ring-[#6258E8] outline-none leading-relaxed"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 pt-1">
                      <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
                        <span className="font-semibold text-[#111827]">Web Booking Chat</span>
                        <span className="text-[#10B981] font-bold">Enabled</span>
                      </div>
                      <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
                        <span className="font-semibold text-[#111827]">WhatsApp Business</span>
                        <span className="text-slate-500 font-medium">Ready in Dashboard</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 6: Review & Launch */}
                {currentStep === 6 && (
                  <div className="space-y-4">
                    {/* Live link card */}
                    <div className="p-4 rounded-xl border-2 border-[#6258E8]/30 bg-[#6258E8]/5 space-y-2">
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
                          className="text-xs font-bold text-[#6258E8] bg-white px-2.5 py-1 rounded border border-[#6258E8]/30 hover:bg-[#6258E8]/10 transition-colors flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[14px]">
                            content_copy
                          </span>
                          {copiedLink ? 'Copied!' : 'Copy Link'}
                        </button>
                      </div>
                      <div className="text-base font-mono font-bold text-[#111827] break-all">
                        {bookingUrl}
                      </div>
                    </div>

                    {/* Quick Recap Grid */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                        <span className="text-slate-500 block text-[11px]">Business</span>
                        <span className="font-bold text-[#111827]">{state.businessName}</span>
                        <span className="text-slate-500 block">{state.location}</span>
                      </div>

                      <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                        <span className="text-slate-500 block text-[11px]">Services & Deposit</span>
                        <span className="font-bold text-[#111827]">
                          {state.services.length} services
                        </span>
                        <span className="text-[#10B981] font-semibold block">
                          ₦{state.depositAmount.toLocaleString()} Kora Deposit
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-2 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setTestModalOpen(true)}
                        className="px-4 py-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1.5 transition-colors shadow-xs"
                      >
                        <span className="material-symbols-outlined text-[16px] text-[#6258E8]">
                          science
                        </span>
                        Test Booking Preview
                      </button>

                      <button
                        type="button"
                        onClick={() => router.push('/dashboard')}
                        className="flex-1 py-2.5 px-5 rounded-lg bg-[#6258E8] hover:bg-[#5247d8] text-white text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
                      >
                        <span className="material-symbols-outlined text-[18px]">rocket_launch</span>
                        Launch & Go to Dashboard
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Persistent Bottom Footer */}
            <footer className="p-4 lg:p-5 border-t border-slate-200 bg-white flex items-center justify-between">
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
                    onClick={() => setCurrentStep((prev) => prev + 1)}
                    className="text-slate-500 hover:text-[#111827] text-xs font-semibold px-2 py-1"
                  >
                    Skip
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleContinue}
                  className="px-5 py-2.5 rounded-lg bg-[#6258E8] hover:bg-[#5247d8] text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <span>{currentStep === 6 ? 'Launch & Go to Dashboard' : 'Continue'}</span>
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
          <div className="w-full max-w-md bg-white rounded-xl border border-slate-200 shadow-2xl p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#6258E8] flex items-center justify-center text-white">
                  <span className="material-symbols-outlined text-[18px]">science</span>
                </div>
                <div>
                  <h3 className="font-bold text-[#111827] text-sm">Safe Test Booking Preview</h3>
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
                <span className="font-semibold text-[#111827]">{state.services[0]?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Slot Hold Timer:</span>
                <span className="font-mono font-bold text-[#6258E8]">15:00 (Hold active)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Required Deposit:</span>
                <span className="font-semibold text-[#10B981]">
                  ₦{state.depositAmount.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-[#6258E8]/5 border border-[#6258E8]/15 text-[11px] text-slate-600">
              🔒 <strong>Switchboard Rule</strong>: Slot is reserved for 15 minutes. It confirms
              only when Kora verifies payment. If unpaid, it unlocks automatically.
            </div>

            <button
              type="button"
              onClick={() => setTestModalOpen(false)}
              className="w-full py-2 rounded-lg bg-[#6258E8] text-white font-semibold text-xs shadow-sm hover:bg-[#5247d8] transition-colors"
            >
              Close Preview
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="w-full py-3 text-center text-xs text-slate-400">
        © 2026 Switchboard Technologies Inc. All rights reserved.
      </footer>
    </div>
  );
}
