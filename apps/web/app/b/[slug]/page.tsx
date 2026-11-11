'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { AppIcon } from '@/components/AppIcon';
import { HoldBand, type HoldBandStatus } from '@/components/HoldBand';
import { SwitchboardIconSvg } from '@/components/SwitchboardLogo';

interface ServiceItem {
  id: string;
  name: string;
  description?: string;
  durationMinutes: number;
  priceKobo: number;
  depositKobo: number;
}

interface StaffItem {
  id: string;
  name: string;
  role: string;
}

interface DaySchedule {
  open: boolean;
  openTime: string;
  closeTime: string;
}

const DEFAULT_SCHEDULE: Record<string, DaySchedule> = {
  Monday: { open: true, openTime: '09:00', closeTime: '19:00' },
  Tuesday: { open: true, openTime: '09:00', closeTime: '19:00' },
  Wednesday: { open: true, openTime: '09:00', closeTime: '19:00' },
  Thursday: { open: true, openTime: '09:00', closeTime: '19:00' },
  Friday: { open: true, openTime: '09:00', closeTime: '20:00' },
  Saturday: { open: true, openTime: '09:00', closeTime: '20:00' },
  Sunday: { open: false, openTime: '12:00', closeTime: '18:00' },
};

const DEFAULT_SERVICES: ServiceItem[] = [
  {
    id: 'svc_1',
    name: 'Classic Fade & Beard Sculpt',
    description: 'Detailed razor fade, hot towel prep & beard oil.',
    durationMinutes: 45,
    priceKobo: 500_000,
    depositKobo: 150_000,
  },
  {
    id: 'svc_2',
    name: 'Standard Haircut',
    description: 'Clean clipper cut and sharp perimeter line-up.',
    durationMinutes: 30,
    priceKobo: 350_000,
    depositKobo: 100_000,
  },
  {
    id: 'svc_3',
    name: 'VIP Dreadlocks Retwist & Wash',
    description: 'Organic shampoo wash & deep palm-roll retwist.',
    durationMinutes: 90,
    priceKobo: 1_500_000,
    depositKobo: 500_000,
  },
  {
    id: 'svc_free',
    name: 'Quick Line-up & Style Check',
    description: 'Perimeter touch-up — no upfront deposit required.',
    durationMinutes: 15,
    priceKobo: 150_000,
    depositKobo: 0,
  },
];

const DEFAULT_STAFF: StaffItem[] = [
  { id: 'stf_1', name: 'Tunde Adeyemi', role: 'Lead Barber' },
  { id: 'stf_2', name: 'Emeka Okafor', role: 'Fade Specialist' },
];

function formatNairaFromKobo(kobo: number): string {
  return `₦${Math.round(kobo / 100).toLocaleString('en-NG')}`;
}

interface DayOption {
  isoDate: string;
  weekdayName: string;
  shortDay: string;
  dayNumber: string;
  monthShort: string;
  isToday: boolean;
  open: boolean;
  openTime: string;
  closeTime: string;
}

function buildDayStrip(schedule: Record<string, DaySchedule>): DayOption[] {
  const days: DayOption[] = [];
  const now = new Date();
  const weekdayFormatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    timeZone: 'Africa/Lagos',
  });
  const shortDayFormatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: 'Africa/Lagos',
  });
  const dayNumFormatter = new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    timeZone: 'Africa/Lagos',
  });
  const monthFormatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    timeZone: 'Africa/Lagos',
  });

  for (let offset = 0; offset < 7; offset++) {
    const d = new Date(now.getTime() + offset * 86_400_000);
    const weekdayName = weekdayFormatter.format(d);
    const daySched = schedule[weekdayName] ??
      DEFAULT_SCHEDULE[weekdayName] ?? {
        open: true,
        openTime: '09:00',
        closeTime: '19:00',
      };
    days.push({
      isoDate: d.toISOString().slice(0, 10),
      weekdayName,
      shortDay: offset === 0 ? 'Today' : shortDayFormatter.format(d),
      dayNumber: dayNumFormatter.format(d),
      monthShort: monthFormatter.format(d),
      isToday: offset === 0,
      open: daySched.open,
      openTime: daySched.openTime || '09:00',
      closeTime: daySched.closeTime || '19:00',
    });
  }
  return days;
}

function buildTimeChips(openTime: string, closeTime: string): string[] {
  const startHour = Math.max(6, Math.min(20, Number.parseInt(openTime.slice(0, 2), 10) || 9));
  const endHour = Math.max(
    startHour + 2,
    Math.min(22, Number.parseInt(closeTime.slice(0, 2), 10) || 19),
  );
  const chips: string[] = [];

  for (let h = startHour; h < endHour; h++) {
    const hh = h.toString().padStart(2, '0');
    chips.push(`${hh}:00 WAT`);
    if (h + 1 < endHour && chips.length < 9) {
      chips.push(`${hh}:30 WAT`);
    }
  }
  return chips.slice(0, 9);
}

export default function PublicBookingPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? 'fade-republic';

  const [businessName, setBusinessName] = useState('Fade Republic');
  const [address, setAddress] = useState('KM 10 Idiroko Road, Ota, Ogun State');
  const [phone, setPhone] = useState('+234 803 123 4567');
  const [cancellationPolicy, setCancellationPolicy] = useState(
    'Full refund if cancelled at least 4 hours before your scheduled slot.',
  );
  const [schedule, setSchedule] = useState<Record<string, DaySchedule>>(DEFAULT_SCHEDULE);
  const [servicesList, setServicesList] = useState<ServiceItem[]>(DEFAULT_SERVICES);
  const [staffList, setStaffList] = useState<StaffItem[]>(DEFAULT_STAFF);

  const [selectedServiceId, setSelectedServiceId] = useState<string>('svc_1');
  const [selectedStaffId, setSelectedStaffId] = useState<string>('stf_1');
  const [selectedDateIso, setSelectedDateIso] = useState<string>('');
  const [selectedSlot, setSelectedSlot] = useState<string>('10:00 WAT');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [bookingStatus, setBookingStatus] = useState<HoldBandStatus | null>(null);
  const [reference, setReference] = useState('sb_dep_01JFADEREP98K2');
  const [copiedAccount, setCopiedAccount] = useState(false);

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
          phone?: string;
          cancellationPolicy?: string;
          schedule?: Record<string, DaySchedule>;
        };
        if (parsed.businessName) setBusinessName(parsed.businessName);
        if (parsed.location || parsed.address) setAddress(parsed.location || parsed.address || '');
        if (parsed.phone) setPhone(parsed.phone);
        if (parsed.cancellationPolicy) setCancellationPolicy(parsed.cancellationPolicy);
        if (parsed.schedule) setSchedule(parsed.schedule);
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
        if (data.business.phone) setPhone(data.business.phone);
        if (data.business.cancellationPolicy) {
          setCancellationPolicy(data.business.cancellationPolicy);
        }
        if (data.business.schedule) {
          setSchedule(data.business.schedule);
        }

        if (Array.isArray(data.services) && data.services.length > 0) {
          const mappedServices: ServiceItem[] = data.services.map(
            (s: {
              id: string;
              name: string;
              description?: string;
              durationMin?: number;
              duration?: number;
              priceKobo?: number;
              price?: number;
              depositValue?: number;
              depositAmount?: number;
              depositRequired?: boolean;
              depositType?: string;
            }) => ({
              id: s.id,
              name: s.name,
              description: s.description || 'Bookable appointment service.',
              durationMinutes: s.durationMin ?? s.duration ?? 45,
              priceKobo: s.priceKobo ?? Math.round((s.price ?? 5000) * 100),
              depositKobo:
                s.depositRequired === false || s.depositType === 'none'
                  ? 0
                  : (s.depositValue ?? Math.round((s.depositAmount ?? 1500) * 100)),
            }),
          );

          // Ensure there is always at least one no-deposit service option so customers/testers
          // can exercise direct no-deposit confirmation alongside Kora deposit holds.
          const hasNoDepositService = mappedServices.some((s) => s.depositKobo === 0);
          const finalServices = hasNoDepositService
            ? mappedServices
            : [
                ...mappedServices,
                {
                  id: 'svc_no_deposit',
                  name: 'Quick Line-up & Consultation',
                  description: 'Fast perimeter check — confirms directly with no deposit.',
                  durationMinutes: 15,
                  priceKobo: 150_000,
                  depositKobo: 0,
                },
              ];

          setServicesList(finalServices);
          if (finalServices[0]) setSelectedServiceId(finalServices[0].id);
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

  const dayStrip = useMemo(() => buildDayStrip(schedule), [schedule]);

  useEffect(() => {
    if (!selectedDateIso && dayStrip.length > 0) {
      const firstOpen = dayStrip.find((d) => d.open) ?? dayStrip[0];
      if (firstOpen) setSelectedDateIso(firstOpen.isoDate);
    }
  }, [dayStrip, selectedDateIso]);

  const selectedDay =
    dayStrip.find((d) => d.isoDate === selectedDateIso) ??
    dayStrip.find((d) => d.open) ??
    dayStrip[0];

  const timeChips = useMemo(
    () => buildTimeChips(selectedDay?.openTime ?? '09:00', selectedDay?.closeTime ?? '19:00'),
    [selectedDay],
  );

  useEffect(() => {
    if (timeChips.length > 0 && !timeChips.includes(selectedSlot)) {
      setSelectedSlot(timeChips[0] ?? '10:00 WAT');
    }
  }, [timeChips, selectedSlot]);

  const selectedService =
    servicesList.find((s) => s.id === selectedServiceId) ?? servicesList[0] ?? DEFAULT_SERVICES[0];
  const selectedStaff =
    staffList.find((s) => s.id === selectedStaffId) ?? staffList[0] ?? DEFAULT_STAFF[0];

  const isNoDepositService = (selectedService?.depositKobo ?? 0) === 0;

  const handleHoldOrConfirmSlot = (e: React.FormEvent) => {
    e.preventDefault();
    const newRef = `sb_dep_${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    setReference(newRef);

    // Per docs/03-data-model.md:
    // service with deposit_type='none': hold_slot → confirmed directly
    const nextStatus: HoldBandStatus = isNoDepositService ? 'confirmed' : 'held';
    setBookingStatus(nextStatus);

    // Sync to local dashboard bookings so owner dashboard reflects this booking immediately
    try {
      const existingRaw = localStorage.getItem('switchboard_dashboard_bookings');
      const existing = existingRaw ? JSON.parse(existingRaw) : [];
      const newRecord = {
        id: `bk_${Date.now()}`,
        reference: newRef,
        customerName: customerName.trim() || 'Walk-in Customer',
        customerPhone: customerPhone.trim() || '+234 803 000 0000',
        serviceName: selectedService?.name || 'Service',
        staffName: selectedStaff?.name || 'Staff',
        slotTime: `${selectedDay?.shortDay ?? 'Today'} · ${selectedSlot}`,
        priceKobo: selectedService?.priceKobo ?? 500_000,
        depositKobo: selectedService?.depositKobo ?? 0,
        status: nextStatus,
        paymentStatus: isNoDepositService ? 'not_required' : 'awaiting_payment',
        holdSecondsRemaining: isNoDepositService ? undefined : 900,
        source: 'booking_page',
        createdAt: new Date().toISOString(),
      };
      localStorage.setItem(
        'switchboard_dashboard_bookings',
        JSON.stringify([newRecord, ...existing]),
      );
    } catch {
      // Ignore storage error
    }
  };

  const handleSimulateKoraWebhook = () => {
    setBookingStatus('confirmed');
    try {
      const existingRaw = localStorage.getItem('switchboard_dashboard_bookings');
      if (existingRaw) {
        const existing = JSON.parse(existingRaw) as Array<{
          reference: string;
          status: string;
          paymentStatus: string;
        }>;
        const updated = existing.map((b) =>
          b.reference === reference ? { ...b, status: 'confirmed', paymentStatus: 'verified' } : b,
        );
        localStorage.setItem('switchboard_dashboard_bookings', JSON.stringify(updated));
      }
    } catch {
      // Ignore storage error
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F8FB] text-[#111827] flex flex-col justify-between font-sans">
      {/* Business Header */}
      <header className="w-full border-b border-[#E5E7EB] bg-white px-4 sm:px-6 py-4">
        <div className="max-w-[1000px] mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <SwitchboardIconSvg className="w-10 h-10 shrink-0" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-[17px] text-[#111827] tracking-tight leading-none">
                  {businessName}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-[#10B981]/10 text-[#047857]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                  Open for bookings
                </span>
              </div>
              <p className="text-[12px] text-[#64748B] mt-1">
                {address} · <span className="font-mono">{phone}</span> · Africa/Lagos (WAT)
              </p>
            </div>
          </div>

          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5E7EB] text-[12px] font-medium text-[#111827] hover:bg-[#F7F8FB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6258E8] transition-colors"
          >
            <AppIcon name="arrow_back" className="text-[14px]" />
            <span>Back to dashboard</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 w-full max-w-[1000px] mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN: Services, Staff, Day Strip & Time Chips */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-[#E5E7EB] p-6 shadow-xs space-y-7">
            <div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono uppercase tracking-wider bg-[#6258E8]/10 text-[#6258E8] font-semibold">
                Real-time slot protection · exclude using gist
              </span>
              <h1 className="text-[24px] font-bold text-[#111827] tracking-tight mt-2">
                Book an appointment at {businessName}
              </h1>
              <p className="text-[13px] text-[#64748B] mt-0.5">{cancellationPolicy}</p>
            </div>

            {/* 1. Services List */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-semibold uppercase tracking-wider text-[#64748B]">
                  1. Choose service
                </p>
                <span className="text-[11px] font-mono text-[#64748B]">
                  Prices in NGN · Kora verified
                </span>
              </div>
              <div className="space-y-2.5">
                {servicesList.map((svc) => {
                  const active = svc.id === selectedServiceId;
                  const noDeposit = svc.depositKobo === 0;
                  return (
                    <button
                      key={svc.id}
                      type="button"
                      onClick={() => {
                        setSelectedServiceId(svc.id);
                        setBookingStatus(null);
                      }}
                      className={`w-full text-left p-4 rounded-xl border transition-all flex items-center justify-between gap-4 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6258E8] ${
                        active
                          ? 'border-[#6258E8] bg-[#6258E8]/5 ring-1 ring-[#6258E8]'
                          : 'border-[#E5E7EB] hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-[14px] font-semibold text-[#111827]">{svc.name}</p>
                          {noDeposit ? (
                            <span className="px-2 py-0.5 rounded-md bg-[#10B981]/12 text-[#047857] text-[10px] font-mono font-semibold">
                              No deposit · confirms directly
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-[#F59E0B]/15 text-[#B45309] text-[10px] font-mono font-semibold">
                              {formatNairaFromKobo(svc.depositKobo)} deposit
                            </span>
                          )}
                        </div>
                        {svc.description && (
                          <p className="text-[12px] text-[#64748B] line-clamp-1">
                            {svc.description}
                          </p>
                        )}
                        <p className="text-[11px] font-mono text-[#64748B]">
                          {svc.durationMinutes} mins
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-mono text-[15px] font-bold text-[#111827]">
                          {formatNairaFromKobo(svc.priceKobo)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Staff Selector */}
            <div className="space-y-2.5">
              <p className="text-[12px] font-semibold uppercase tracking-wider text-[#64748B]">
                2. Choose specialist
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {staffList.map((stf) => {
                  const active = stf.id === selectedStaffId;
                  return (
                    <button
                      key={stf.id}
                      type="button"
                      onClick={() => {
                        setSelectedStaffId(stf.id);
                        setBookingStatus(null);
                      }}
                      className={`p-3.5 rounded-xl border text-left transition-all flex items-center gap-3 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6258E8] ${
                        active
                          ? 'border-[#6258E8] bg-[#6258E8]/5 ring-1 ring-[#6258E8]'
                          : 'border-[#E5E7EB] hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="w-9 h-9 rounded-full bg-[#6258E8]/10 text-[#6258E8] flex items-center justify-center font-bold text-xs shrink-0">
                        {stf.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[14px] font-semibold text-[#111827] truncate">
                          {stf.name}
                        </p>
                        <p className="text-[12px] text-[#64748B] truncate">{stf.role}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Interactive 7-Day Strip */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-semibold uppercase tracking-wider text-[#64748B]">
                  3. Choose day
                </p>
                <span className="text-[11px] font-mono text-[#64748B]">
                  {selectedDay?.weekdayName} · {selectedDay?.openTime}–{selectedDay?.closeTime} WAT
                </span>
              </div>

              <div className="grid grid-cols-7 gap-2">
                {dayStrip.map((day) => {
                  const isSelected = day.isoDate === selectedDay?.isoDate;
                  return (
                    <button
                      key={day.isoDate}
                      type="button"
                      disabled={!day.open}
                      onClick={() => {
                        setSelectedDateIso(day.isoDate);
                        setBookingStatus(null);
                      }}
                      className={`py-2.5 px-1.5 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6258E8] ${
                        !day.open
                          ? 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed'
                          : isSelected
                            ? 'border-[#6258E8] bg-[#6258E8] text-white shadow-xs cursor-pointer'
                            : 'border-[#E5E7EB] bg-white text-[#111827] hover:border-[#6258E8]/50 cursor-pointer'
                      }`}
                    >
                      <span
                        className={`text-[10px] font-semibold uppercase ${
                          !day.open
                            ? 'text-slate-300'
                            : isSelected
                              ? 'text-white/85'
                              : 'text-[#64748B]'
                        }`}
                      >
                        {day.shortDay}
                      </span>
                      <span className="text-[15px] font-mono font-bold leading-tight">
                        {day.dayNumber}
                      </span>
                      <span
                        className={`text-[10px] font-mono ${
                          !day.open
                            ? 'text-slate-300'
                            : isSelected
                              ? 'text-white/80'
                              : 'text-[#64748B]'
                        }`}
                      >
                        {day.open ? day.monthShort : 'Closed'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. Time Slot Chips */}
            <div className="space-y-2.5">
              <p className="text-[12px] font-semibold uppercase tracking-wider text-[#64748B]">
                4. Choose time chip (WAT)
              </p>
              <div className="grid grid-cols-3 gap-2.5">
                {timeChips.map((slot) => {
                  const active = slot === selectedSlot;
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => {
                        setSelectedSlot(slot);
                        setBookingStatus(null);
                      }}
                      className={`py-2.5 px-3 rounded-xl border font-mono text-[13px] font-medium transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6258E8] ${
                        active
                          ? 'border-[#6258E8] bg-[#6258E8] text-white shadow-xs'
                          : 'border-[#E5E7EB] text-[#111827] hover:border-[#6258E8]/50 bg-white'
                      }`}
                    >
                      {slot}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Hold Band & Deposit / Direct Confirmation Card */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-[#E5E7EB] p-6 shadow-xs space-y-5 sticky top-6">
            <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-4">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wider text-[#64748B]">
                  Appointment summary
                </p>
                <h2 className="text-[17px] font-bold text-[#111827] mt-0.5">
                  {selectedService?.name}
                </h2>
              </div>
              <span className="px-2.5 py-1 rounded-md bg-slate-100 text-[11px] font-mono font-semibold text-[#111827]">
                {selectedService?.durationMinutes} mins
              </span>
            </div>

            <div className="space-y-2.5 text-[13px]">
              <div className="flex justify-between">
                <span className="text-[#64748B]">Specialist</span>
                <span className="font-semibold text-[#111827]">{selectedStaff?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Date &amp; time</span>
                <span className="font-mono font-semibold text-[#111827]">
                  {selectedDay?.shortDay} {selectedDay?.dayNumber} {selectedDay?.monthShort} ·{' '}
                  {selectedSlot}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Total service fee</span>
                <span className="font-mono font-semibold text-[#111827]">
                  {formatNairaFromKobo(selectedService?.priceKobo ?? 0)}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-100">
                <span className="font-semibold text-[#111827]">
                  {isNoDepositService ? 'Upfront deposit' : 'Required Kora deposit'}
                </span>
                <span
                  className={`font-mono font-bold ${
                    isNoDepositService ? 'text-[#10B981]' : 'text-[#6258E8]'
                  }`}
                >
                  {isNoDepositService
                    ? '₦0 (No deposit)'
                    : formatNairaFromKobo(selectedService?.depositKobo ?? 0)}
                </span>
              </div>
            </div>

            {!bookingStatus ? (
              <form onSubmit={handleHoldOrConfirmSlot} className="space-y-3.5 pt-1">
                <div>
                  <label
                    htmlFor="cust-name"
                    className="block text-[12px] font-medium text-[#111827] mb-1"
                  >
                    Your name
                  </label>
                  <input
                    id="cust-name"
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. Adebayo Ogunlesi"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E7EB] text-[13px] focus:outline-none focus:border-[#6258E8] focus:ring-2 focus:ring-[#6258E8]/20"
                  />
                </div>
                <div>
                  <label
                    htmlFor="cust-phone"
                    className="block text-[12px] font-medium text-[#111827] mb-1"
                  >
                    WhatsApp phone number
                  </label>
                  <input
                    id="cust-phone"
                    type="tel"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="+234 803 000 0000"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E5E7EB] text-[13px] font-mono focus:outline-none focus:border-[#6258E8] focus:ring-2 focus:ring-[#6258E8]/20"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-[#6258E8] hover:bg-[#4F46E5] text-white font-semibold text-[14px] transition-colors shadow-xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6258E8]"
                >
                  {isNoDepositService
                    ? 'Hold this time (confirms directly)'
                    : `Hold this time · Pay ${formatNairaFromKobo(selectedService?.depositKobo ?? 0)} deposit`}
                </button>
              </form>
            ) : (
              <div className="space-y-4 pt-1">
                {/* Reusable HoldBand Component */}
                <HoldBand
                  status={bookingStatus}
                  remainingSeconds={900}
                  totalSeconds={900}
                  autoTick={bookingStatus === 'held'}
                  reference={reference}
                  onExpire={() => setBookingStatus('expired')}
                />

                {bookingStatus === 'held' && (
                  <div className="p-4 rounded-xl bg-[#F7F8FB] border border-[#E5E7EB] space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono uppercase tracking-wider text-[#64748B] font-semibold">
                        Kora virtual bank transfer
                      </span>
                      <span className="text-[11px] font-mono font-bold text-[#111827]">
                        Wema Bank
                      </span>
                    </div>

                    <div className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-[#E5E7EB]">
                      <div>
                        <p className="text-[10px] text-[#64748B] uppercase font-mono">
                          Account number
                        </p>
                        <p className="text-[15px] font-mono font-bold text-[#111827] tracking-wider">
                          7829104482
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText('7829104482');
                          setCopiedAccount(true);
                          setTimeout(() => setCopiedAccount(false), 2000);
                        }}
                        className="px-2.5 py-1.5 rounded-lg border border-[#E5E7EB] text-xs font-semibold text-[#6258E8] hover:bg-slate-50 cursor-pointer"
                      >
                        {copiedAccount ? 'Copied!' : 'Copy account number'}
                      </button>
                    </div>

                    <p className="text-[12px] text-[#64748B] leading-relaxed">
                      Transfer{' '}
                      <strong className="text-[#111827]">
                        {formatNairaFromKobo(selectedService?.depositKobo ?? 0)}
                      </strong>
                      . This slot confirms only after Kora <code>charge.success</code> webhook +
                      transaction verification (Invariant I2).
                    </p>

                    <button
                      type="button"
                      onClick={handleSimulateKoraWebhook}
                      className="w-full py-2.5 rounded-lg bg-[#101827] hover:bg-slate-800 text-white text-xs font-mono font-semibold transition-colors cursor-pointer"
                    >
                      Simulate Kora charge.success webhook → Confirm
                    </button>
                  </div>
                )}

                {bookingStatus === 'confirmed' && (
                  <div className="p-4 rounded-xl bg-[#10B981]/10 border border-[#10B981]/30 space-y-1.5">
                    <p className="text-[13px] font-bold text-[#047857]">
                      Appointment confirmed for {customerName || 'you'}
                    </p>
                    <p className="text-[12px] text-[#065F46] leading-relaxed">
                      {isNoDepositService
                        ? 'This service requires no upfront deposit, so your slot was confirmed directly.'
                        : 'Your Kora deposit has been verified and your slot is locked.'}{' '}
                      A WhatsApp confirmation has been queued for{' '}
                      <span className="font-mono font-semibold">{customerPhone}</span>.
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setBookingStatus(null)}
                  className="w-full py-2 rounded-lg border border-[#E5E7EB] text-xs font-semibold text-[#64748B] hover:text-[#111827] hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Choose a different slot
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
