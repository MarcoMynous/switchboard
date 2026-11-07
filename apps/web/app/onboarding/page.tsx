'use client';

import Link from 'next/link';
import { useState } from 'react';

type Vertical = 'barber' | 'auto' | 'property' | 'clinic';

interface ServiceItem {
  id: string;
  name: string;
  duration: number; // in mins
  price: number; // in Naira
  depositRequired: boolean;
  depositAmount: number;
}

const VERTICAL_PRESETS: Record<
  Vertical,
  { label: string; icon: string; services: Omit<ServiceItem, 'id'>[] }
> = {
  barber: {
    label: 'Salon & Barber',
    icon: 'content_cut',
    services: [
      {
        name: 'Classic Fade & Beard Sculpt',
        duration: 45,
        price: 5000,
        depositRequired: true,
        depositAmount: 1500,
      },
      {
        name: 'Standard Haircut',
        duration: 30,
        price: 3500,
        depositRequired: false,
        depositAmount: 0,
      },
      {
        name: 'VIP Dreadlocks Retwist & Wash',
        duration: 90,
        price: 15000,
        depositRequired: true,
        depositAmount: 5000,
      },
    ],
  },
  auto: {
    label: 'Auto Service & Detailing',
    icon: 'directions_car',
    services: [
      {
        name: 'Full Engine Diagnostic',
        duration: 60,
        price: 10000,
        depositRequired: true,
        depositAmount: 3000,
      },
      {
        name: 'Executive Detailing & Ceramic Wash',
        duration: 120,
        price: 25000,
        depositRequired: true,
        depositAmount: 8000,
      },
      {
        name: 'Oil & Filter Change',
        duration: 45,
        price: 12000,
        depositRequired: false,
        depositAmount: 0,
      },
    ],
  },
  property: {
    label: 'Property & Real Estate',
    icon: 'apartment',
    services: [
      {
        name: 'Guided 3-Bedroom Villa Inspection',
        duration: 45,
        price: 0,
        depositRequired: true,
        depositAmount: 2000,
      },
      {
        name: 'Commercial Office Space Walkthrough',
        duration: 60,
        price: 0,
        depositRequired: false,
        depositAmount: 0,
      },
    ],
  },
  clinic: {
    label: 'Specialist Clinic',
    icon: 'medical_services',
    services: [
      {
        name: 'General Dental Consultation & Scaling',
        duration: 45,
        price: 15000,
        depositRequired: true,
        depositAmount: 5000,
      },
      {
        name: 'Physiotherapy Assessment Session',
        duration: 60,
        price: 20000,
        depositRequired: true,
        depositAmount: 5000,
      },
    ],
  },
};

export default function OnboardingPage() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [businessName, setBusinessName] = useState('Fade Republic');
  const [slug, setSlug] = useState('fade-republic');
  const [vertical, setVertical] = useState<Vertical>('barber');
  const [services, setServices] = useState<ServiceItem[]>([
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
      depositRequired: false,
      depositAmount: 0,
    },
    {
      id: '3',
      name: 'VIP Dreadlocks Retwist',
      duration: 90,
      price: 15000,
      depositRequired: true,
      depositAmount: 5000,
    },
  ]);
  const [copied, setCopied] = useState(false);

  const handleNameChange = (name: string) => {
    setBusinessName(name);
    const generatedSlug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    setSlug(generatedSlug || 'my-workspace');
  };

  const handleVerticalSelect = (v: Vertical) => {
    setVertical(v);
    const preset = VERTICAL_PRESETS[v];
    setServices(
      preset.services.map((s, idx) => ({
        ...s,
        id: String(idx + 1),
      })),
    );
  };

  const handleCopyLink = () => {
    const link = `https://switchboard.ng/b/${slug}`;
    void navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen w-full bg-background font-body-md text-body-md text-on-surface antialiased flex flex-col justify-between p-4 sm:p-6 lg:p-10 selection:bg-primary-container selection:text-white">
      {/* Top Navbar */}
      <header className="max-w-4xl w-full mx-auto flex items-center justify-between pb-6 border-b border-border/60">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-midnight-hero text-surface flex items-center justify-center shadow-md">
            <span className="material-symbols-outlined text-[18px]">hub</span>
          </div>
          <span className="font-headline-sm text-headline-sm text-text-primary font-semibold tracking-tight">
            Switchboard
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-label-sm text-label-sm text-text-secondary">Setup Wizard</span>
          <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-metric-sm text-metric-sm font-medium">
            Step {step} of 4
          </span>
        </div>
      </header>

      {/* Main Wizard Form Container */}
      <main className="max-w-2xl w-full mx-auto my-8 bg-surface rounded-2xl shadow-xl border border-border/80 p-6 sm:p-10 flex flex-col relative overflow-hidden">
        {/* Subtle illumination */}
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-32 bg-primary/10 rounded-full blur-2xl pointer-events-none" />

        {/* STEP 1: Business Profile */}
        {step === 1 && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-200">
            <div>
              <h1 className="font-headline-md text-headline-md text-text-primary tracking-tight font-semibold">
                Set up your business workspace
              </h1>
              <p className="font-body-md text-body-md text-text-secondary mt-1">
                Your AI assistants and public booking page will be calibrated with these business
                details.
              </p>
            </div>

            {/* Business Name */}
            <div>
              <label
                htmlFor="biz-name"
                className="block font-label-md text-label-md text-text-primary mb-1.5 font-medium"
              >
                Business Name
              </label>
              <input
                id="biz-name"
                type="text"
                value={businessName}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. Fade Republic, Ota"
                className="w-full px-3.5 py-2.5 rounded-lg bg-surface text-text-primary placeholder:text-text-secondary/60 text-body-md font-body-md shadow-sm border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
              />
            </div>

            {/* Public Link Preview */}
            <div>
              <label
                htmlFor="biz-slug"
                className="block font-label-md text-label-md text-text-primary mb-1.5 font-medium"
              >
                Public Booking URL
              </label>
              <div className="flex items-center rounded-lg border border-border bg-surface-container-low px-3.5 py-2 shadow-sm">
                <span className="font-metric-sm text-metric-sm text-text-secondary select-none">
                  switchboard.ng/b/
                </span>
                <input
                  id="biz-slug"
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="w-full bg-transparent font-metric-sm text-metric-sm text-text-primary font-medium outline-none ml-0.5"
                />
              </div>
            </div>

            {/* Vertical Picker */}
            <div>
              <span className="block font-label-md text-label-md text-text-primary mb-2 font-medium">
                Business Category
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(Object.keys(VERTICAL_PRESETS) as Vertical[]).map((vKey) => {
                  const item = VERTICAL_PRESETS[vKey];
                  const isSelected = vertical === vKey;
                  return (
                    <button
                      key={vKey}
                      type="button"
                      onClick={() => handleVerticalSelect(vKey)}
                      className={`p-3.5 rounded-xl border text-left flex items-center gap-3 transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/5 shadow-sm text-text-primary ring-1 ring-primary'
                          : 'border-border/80 bg-surface hover:bg-surface-container-low text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-primary text-on-primary'
                            : 'bg-surface-container-high text-text-secondary'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                      </div>
                      <div>
                        <p className="font-label-md text-label-md font-semibold text-text-primary">
                          {item.label}
                        </p>
                        <p className="font-body-sm text-[12px] text-text-secondary">
                          Auto-loads presets
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setStep(2)}
              className="mt-2 w-full h-11 px-4 rounded-lg bg-primary text-on-primary font-label-md text-label-md font-semibold flex items-center justify-center gap-2 hover:bg-primary-container transition-all active:scale-[0.99] shadow-sm"
            >
              <span>Continue to Services</span>
              <span className="material-symbols-outlined text-base">arrow_forward</span>
            </button>
          </div>
        )}

        {/* STEP 2: Services & Pricing */}
        {step === 2 && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-200">
            <div>
              <h1 className="font-headline-md text-headline-md text-text-primary tracking-tight font-semibold">
                Configure your service menu
              </h1>
              <p className="font-body-md text-body-md text-text-secondary mt-1">
                Set duration, pricing, and Kora no-show deposit rules for each offering.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {services.map((svc) => (
                <div
                  key={svc.id}
                  className="p-4 rounded-xl border border-border/80 bg-surface-container-lowest shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex-1">
                    <p className="font-label-md text-label-md font-semibold text-text-primary">
                      {svc.name}
                    </p>
                    <p className="font-body-sm text-[12px] text-text-secondary mt-0.5">
                      {svc.duration} mins • ₦{svc.price.toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {svc.depositRequired ? (
                      <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary font-metric-sm text-[11px] font-medium border border-primary/20">
                        ₦{svc.depositAmount.toLocaleString()} Kora Deposit
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full bg-surface-container text-text-secondary font-metric-sm text-[11px]">
                        No Deposit
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-1/3 h-11 px-4 rounded-lg bg-surface border border-border text-text-secondary hover:text-text-primary font-label-md text-label-md font-medium transition-all"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="w-2/3 h-11 px-4 rounded-lg bg-primary text-on-primary font-label-md text-label-md font-semibold flex items-center justify-center gap-2 hover:bg-primary-container transition-all active:scale-[0.99] shadow-sm"
              >
                <span>Continue to Staff</span>
                <span className="material-symbols-outlined text-base">arrow_forward</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Staff & Schedule */}
        {step === 3 && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-200">
            <div>
              <h1 className="font-headline-md text-headline-md text-text-primary tracking-tight font-semibold">
                Staff &amp; Schedule
              </h1>
              <p className="font-body-md text-body-md text-text-secondary mt-1">
                Postgres exclusion constraints ensure no two appointments ever double-book a staff
                member.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-border/80 bg-surface-container-low flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-bold">
                  FR
                </div>
                <div>
                  <p className="font-label-md text-label-md font-semibold text-text-primary">
                    Lead Professional (You)
                  </p>
                  <p className="font-body-sm text-[12px] text-text-secondary">
                    Monday – Saturday • 9:00 AM – 7:00 PM
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-success/15 text-success font-metric-sm text-[11px] font-medium border border-success/20">
                Active
              </span>
            </div>

            <div className="rounded-xl border border-dashed border-border p-4 text-center text-text-secondary font-body-sm text-body-sm">
              <span className="material-symbols-outlined text-2xl text-text-secondary mb-1">
                group_add
              </span>
              <p>Additional staff members can be invited from your admin settings anytime.</p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="w-1/3 h-11 px-4 rounded-lg bg-surface border border-border text-text-secondary hover:text-text-primary font-label-md text-label-md font-medium transition-all"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep(4)}
                className="w-2/3 h-11 px-4 rounded-lg bg-primary text-on-primary font-label-md text-label-md font-semibold flex items-center justify-center gap-2 hover:bg-primary-container transition-all active:scale-[0.99] shadow-sm"
              >
                <span>Complete Setup</span>
                <span className="material-symbols-outlined text-base">check</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Live Booking Link Ready */}
        {step === 4 && (
          <div className="flex flex-col items-center text-center gap-6 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-2xl bg-success/15 border border-success/30 text-success flex items-center justify-center shadow-sm">
              <span className="material-symbols-outlined text-3xl">verified</span>
            </div>

            <div>
              <h1 className="font-headline-md text-headline-md text-text-primary tracking-tight font-semibold">
                Your booking engine is live!
              </h1>
              <p className="font-body-md text-body-md text-text-secondary mt-1 max-w-sm">
                Customers can now book appointments and pay deposits through your verified public
                link.
              </p>
            </div>

            {/* Generated Link Box */}
            <div className="w-full bg-surface-container-low rounded-xl p-4 flex items-center justify-between border border-border/80">
              <div className="flex items-center gap-2 text-left truncate mr-2">
                <span className="material-symbols-outlined text-text-secondary text-base">
                  link
                </span>
                <span className="font-metric-md text-metric-md text-text-primary font-medium truncate">
                  switchboard.ng/b/{slug}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyLink}
                className="px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-container-high border border-border text-text-primary font-label-sm text-label-sm font-semibold transition-all shrink-0 flex items-center gap-1.5 shadow-sm"
              >
                <span className="material-symbols-outlined text-[16px]">
                  {copied ? 'check' : 'content_copy'}
                </span>
                <span>{copied ? 'Copied!' : 'Copy Link'}</span>
              </button>
            </div>

            {/* Navigation Options */}
            <div className="w-full flex flex-col sm:flex-row gap-3 pt-2">
              <Link
                href={`/b/${slug}`}
                className="flex-1 h-11 px-4 rounded-lg bg-primary text-on-primary font-label-md text-label-md font-semibold flex items-center justify-center gap-2 hover:bg-primary-container transition-all active:scale-[0.99] shadow-sm"
              >
                <span>View Customer Booking Page</span>
                <span className="material-symbols-outlined text-base">arrow_forward</span>
              </Link>
              <Link
                href="/"
                className="h-11 px-4 rounded-lg bg-surface border border-border text-text-primary hover:bg-surface-container-low font-label-md text-label-md font-semibold flex items-center justify-center transition-all shadow-sm"
              >
                <span>Home</span>
              </Link>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center font-label-sm text-label-sm text-text-secondary">
        Switchboard Autonomous Booking Operations • Verified Platform
      </footer>
    </div>
  );
}
