'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppIcon } from '@/components/AppIcon';
import { SwitchboardIconSvg } from '@/components/SwitchboardLogo';

interface ServiceItem {
  id: string;
  name: string;
  durationMinutes: number;
  priceKobo: number;
  depositKobo: number;
}

interface StaffItem {
  id: string;
  name: string;
  role: string;
}

const DEFAULT_SERVICES: ServiceItem[] = [
  {
    id: 'svc_1',
    name: 'Skin Fade + Beard Trim',
    durationMinutes: 45,
    priceKobo: 500000,
    depositKobo: 150000,
  },
  {
    id: 'svc_2',
    name: 'Regular Low Cut',
    durationMinutes: 30,
    priceKobo: 300000,
    depositKobo: 100000,
  },
  {
    id: 'svc_3',
    name: 'Dreadlocks Retwist & Wash',
    durationMinutes: 90,
    priceKobo: 1000000,
    depositKobo: 300000,
  },
];

const DEFAULT_STAFF: StaffItem[] = [
  { id: 'stf_1', name: 'Tunde', role: 'Senior Barber' },
  { id: 'stf_2', name: 'Chidi', role: 'Barber & Stylist' },
];

const TIME_SLOTS = ['09:30 WAT', '10:30 WAT', '12:00 WAT', '14:00 WAT', '15:30 WAT', '17:00 WAT'];

function formatNairaFromKobo(kobo: number): string {
  return `₦${Math.round(kobo / 100).toLocaleString('en-NG')}`;
}

export default function PublicBookingPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? 'fade-republic';

  const [businessName, setBusinessName] = useState('Fade Republic');
  const [address, setAddress] = useState('KM 10 Idiroko Road, Ota, Ogun State');
  const [servicesList, setServicesList] = useState<ServiceItem[]>(DEFAULT_SERVICES);
  const [staffList, setStaffList] = useState<StaffItem[]>(DEFAULT_STAFF);
  const [selectedServiceId, setSelectedServiceId] = useState<string>('svc_1');
  const [selectedStaffId, setSelectedStaffId] = useState<string>('stf_1');
  const [selectedSlot, setSelectedSlot] = useState<string>('14:00 WAT');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [holdCreated, setHoldCreated] = useState(false);
  const [reference, setReference] = useState('sb_dep_01JFADEREP98K2');

  useEffect(() => {
    try {
      const raw =
        localStorage.getItem('switchboard_onboarding_draft') ||
        localStorage.getItem('switchboard_onboarding_draft_v3');
      if (raw) {
        const parsed = JSON.parse(raw) as {
          businessName?: string;
          location?: string;
          address?: string;
        };
        if (parsed.businessName) setBusinessName(parsed.businessName);
        if (parsed.location || parsed.address) setAddress(parsed.location || parsed.address || '');
      }
    } catch {
      // Ignore storage error
    }

    fetch(`/api/workspace?slug=${encodeURIComponent(slug)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data?.ok || !data.business) return;
        setBusinessName(data.business.name || 'Fade Republic');
        if (data.business.location) setAddress(data.business.location);
        if (Array.isArray(data.services) && data.services.length > 0) {
          const mappedServices: ServiceItem[] = data.services.map(
            (s: {
              id: string;
              name: string;
              durationMin?: number;
              duration?: number;
              priceKobo?: number;
              price?: number;
              depositValue?: number;
              depositAmount?: number;
              depositRequired?: boolean;
            }) => ({
              id: s.id,
              name: s.name,
              durationMinutes: s.durationMin ?? s.duration ?? 45,
              priceKobo: s.priceKobo ?? Math.round((s.price ?? 5000) * 100),
              depositKobo:
                s.depositRequired === false
                  ? 0
                  : (s.depositValue ?? Math.round((s.depositAmount ?? 1500) * 100)),
            }),
          );
          setServicesList(mappedServices);
          if (mappedServices[0]) setSelectedServiceId(mappedServices[0].id);
        }
        if (Array.isArray(data.staff) && data.staff.length > 0) {
          setStaffList(data.staff);
          if (data.staff[0]) setSelectedStaffId(data.staff[0].id);
        }
      })
      .catch(() => {
        // Keep defaults
      });
  }, [slug]);

  const selectedService =
    servicesList.find((s) => s.id === selectedServiceId) ?? servicesList[0] ?? DEFAULT_SERVICES[0];
  const selectedStaff =
    staffList.find((s) => s.id === selectedStaffId) ?? staffList[0] ?? DEFAULT_STAFF[0];

  const handleHoldSlot = (e: React.FormEvent) => {
    e.preventDefault();
    setReference(`sb_dep_${Math.random().toString(36).substring(2, 10).toUpperCase()}`);
    setHoldCreated(true);
  };

  return (
    <div className="min-h-screen bg-[#f8f9fc] text-[#111827] flex flex-col justify-between">
      <header className="w-full border-b border-[#E5E7EB] bg-white px-4 sm:px-6 py-4">
        <div className="max-w-[960px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <SwitchboardIconSvg className="w-9 h-9" />
            <div>
              <span className="font-semibold text-[16px] text-[#111827] tracking-tight block leading-none">
                {businessName}
              </span>
              <span className="font-mono text-[11px] text-[#64748B]">
                /b/{slug} · Africa/Lagos (WAT)
              </span>
            </div>
          </div>

          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5E7EB] text-[12px] font-medium text-[#111827] hover:bg-[#f8f9fc] transition-colors"
          >
            <AppIcon name="arrow_back" className="text-[14px]" />
            <span>Back to Dashboard</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 w-full max-w-[960px] mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-xs space-y-6">
            <div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono uppercase tracking-wider bg-[#EEF2FF] text-[#4F46E5] font-semibold">
                LIVE AVAILABILITY · EXCLUDE USING GIST
              </span>
              <h1 className="text-[24px] font-semibold text-[#111827] tracking-tight mt-2">
                Book an appointment at {businessName}
              </h1>
              <p className="text-[13px] text-[#64748B] mt-0.5">{address}</p>
            </div>

            <div>
              <p className="text-[12px] font-semibold uppercase tracking-wider text-[#64748B] mb-2.5">
                1. Choose Service
              </p>
              <div className="space-y-2.5">
                {servicesList.map((svc) => {
                  const active = svc.id === selectedServiceId;
                  return (
                    <button
                      key={svc.id}
                      type="button"
                      onClick={() => {
                        setSelectedServiceId(svc.id);
                        setHoldCreated(false);
                      }}
                      className={`w-full text-left p-4 rounded-xl border transition-all flex items-center justify-between ${
                        active
                          ? 'border-[#4F46E5] bg-[#EEF2FF]/40 ring-2 ring-[#4F46E5]/10'
                          : 'border-[#E5E7EB] hover:border-[#CBD5E1]'
                      }`}
                    >
                      <div>
                        <p className="text-[14px] font-semibold text-[#111827]">{svc.name}</p>
                        <p className="text-[12px] text-[#64748B] font-mono mt-0.5">
                          {svc.durationMinutes} mins · Deposit:{' '}
                          <span className="text-[#10B981] font-semibold">
                            {formatNairaFromKobo(svc.depositKobo)}
                          </span>
                        </p>
                      </div>
                      <span className="font-mono text-[15px] font-semibold text-[#111827]">
                        {formatNairaFromKobo(svc.priceKobo)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-[12px] font-semibold uppercase tracking-wider text-[#64748B] mb-2.5">
                2. Select Staff Member
              </p>
              <div className="grid grid-cols-2 gap-3">
                {staffList.map((stf) => {
                  const active = stf.id === selectedStaffId;
                  return (
                    <button
                      key={stf.id}
                      type="button"
                      onClick={() => {
                        setSelectedStaffId(stf.id);
                        setHoldCreated(false);
                      }}
                      className={`p-3.5 rounded-xl border text-left transition-all ${
                        active
                          ? 'border-[#4F46E5] bg-[#EEF2FF]/40'
                          : 'border-[#E5E7EB] hover:border-[#CBD5E1]'
                      }`}
                    >
                      <p className="text-[14px] font-semibold text-[#111827]">{stf.name}</p>
                      <p className="text-[12px] text-[#64748B]">{stf.role}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-[12px] font-semibold uppercase tracking-wider text-[#64748B] mb-2.5">
                3. Pick Time Slot (Today · WAT)
              </p>
              <div className="grid grid-cols-3 gap-2.5">
                {TIME_SLOTS.map((slot) => {
                  const active = slot === selectedSlot;
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => {
                        setSelectedSlot(slot);
                        setHoldCreated(false);
                      }}
                      className={`py-2.5 px-3 rounded-lg font-mono text-[12px] font-medium border transition-all ${
                        active
                          ? 'bg-[#4F46E5] text-white border-[#4F46E5]'
                          : 'bg-white text-[#111827] border-[#E5E7EB] hover:border-[#CBD5E1]'
                      }`}
                    >
                      {slot}
                    </button>
                  );
                })}
              </div>
            </div>

            <form onSubmit={handleHoldSlot} className="space-y-4 pt-2 border-t border-[#E5E7EB]">
              <p className="text-[12px] font-semibold uppercase tracking-wider text-[#64748B]">
                4. Your WhatsApp Contact
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="cust-name"
                    className="block text-[12px] font-medium text-[#111827] mb-1"
                  >
                    Full Name
                  </label>
                  <input
                    id="cust-name"
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. Kunle Adebayo"
                    className="w-full h-10 px-3 rounded-lg border border-[#E5E7EB] text-[13px] focus:outline-none focus:border-[#4F46E5]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="cust-phone"
                    className="block text-[12px] font-medium text-[#111827] mb-1"
                  >
                    WhatsApp Number
                  </label>
                  <input
                    id="cust-phone"
                    type="tel"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="+234 803 555 0149"
                    className="w-full h-10 px-3 rounded-lg border border-[#E5E7EB] font-mono text-[13px] focus:outline-none focus:border-[#4F46E5]"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-3 rounded-lg bg-[#4F46E5] hover:bg-[#4338CA] text-white font-medium text-[14px] transition-colors cursor-pointer inline-flex items-center justify-center gap-2"
              >
                <span>Hold Slot for 15 Minutes & Proceed to Kora Deposit</span>
                <AppIcon name="arrow_forward" className="text-[16px]" />
              </button>
            </form>
          </div>

          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden shadow-xs">
              {holdCreated && (
                <div className="h-1.5 w-full bg-[#FEF3C7]">
                  <div className="h-full w-4/5 bg-[#D97706] transition-all" />
                </div>
              )}
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-[#64748B]">
                    BOOKING SUMMARY
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium ${
                      holdCreated ? 'bg-[#FEF3C7] text-[#92400E]' : 'bg-[#F3F4F6] text-[#64748B]'
                    }`}
                  >
                    {holdCreated ? 'HELD · 15:00' : 'DRAFT SELECTION'}
                  </span>
                </div>

                <div className="space-y-2 text-[13px] border-b border-[#E5E7EB] pb-4">
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">Service</span>
                    <span className="font-semibold text-[#111827]">{selectedService?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">Staff</span>
                    <span className="font-medium text-[#111827]">{selectedStaff?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">Time Slot</span>
                    <span className="font-mono font-medium text-[#111827]">
                      Today · {selectedSlot}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">Total Service Price</span>
                    <span className="font-mono font-medium text-[#111827]">
                      {formatNairaFromKobo(selectedService?.priceKobo ?? 500000)}
                    </span>
                  </div>
                </div>

                <div className="bg-[#f8f9fc] rounded-lg p-3.5 border border-[#E5E7EB] flex items-center justify-between">
                  <div>
                    <p className="text-[12px] font-semibold text-[#111827]">Kora Deposit Due Now</p>
                    <p className="text-[11px] text-[#64748B]">
                      Verified via Kora charge.success + re-query
                    </p>
                  </div>
                  <span className="font-mono text-[18px] font-bold text-[#10B981]">
                    {formatNairaFromKobo(selectedService?.depositKobo ?? 150000)}
                  </span>
                </div>

                {holdCreated && (
                  <div className="p-4 rounded-lg bg-[#FFFBEB] border border-[#FDE68A] space-y-2">
                    <p className="text-[12px] font-semibold text-[#92400E]">
                      Slot held for 15 minutes (Not yet confirmed)
                    </p>
                    <p className="text-[11px] text-[#78350F] leading-relaxed">
                      Reference: <span className="font-mono font-semibold">{reference}</span>. In
                      accordance with Switchboard Invariant I2 & I5, this slot only transitions to{' '}
                      <span className="font-mono font-semibold">confirmed</span> once Kora webhook
                      verification succeeds.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
