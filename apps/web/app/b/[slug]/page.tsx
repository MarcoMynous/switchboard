'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { AppIcon } from '@/components/AppIcon';
import {
  computeKoraFeeKobo,
  DepositCard,
  type DepositCardStatus,
  formatNairaFromKobo,
} from '@/components/DepositCard';
import { SwitchboardIconSvg } from '@/components/SwitchboardLogo';

type ServiceDepositRule = 'fixed' | 'percent' | 'none' | 'full';

interface ServiceItem {
  id: string;
  name: string;
  description?: string;
  durationMinutes: number;
  priceKobo: number;
  depositType: ServiceDepositRule;
  /** Kobo when depositType='fixed', percentage (0-100) when 'percent', priceKobo when 'full', 0 when 'none' */
  depositValue: number;
  freeCancelHours: number;
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
    depositType: 'fixed',
    depositValue: 150_000,
    freeCancelHours: 4,
  },
  {
    id: 'svc_2',
    name: 'Standard Haircut',
    description: 'Clean clipper cut and sharp perimeter line-up.',
    durationMinutes: 30,
    priceKobo: 350_000,
    depositType: 'percent',
    depositValue: 30,
    freeCancelHours: 4,
  },
  {
    id: 'svc_3',
    name: 'VIP Dreadlocks Retwist & Wash',
    description: 'Organic shampoo wash & deep palm-roll retwist.',
    durationMinutes: 90,
    priceKobo: 1_500_000,
    depositType: 'fixed',
    depositValue: 500_000,
    freeCancelHours: 12,
  },
  {
    id: 'svc_free',
    name: 'Quick Line-up & Style Check',
    description: 'Perimeter touch-up — no upfront deposit required.',
    durationMinutes: 15,
    priceKobo: 150_000,
    depositType: 'none',
    depositValue: 0,
    freeCancelHours: 4,
  },
];

const DEFAULT_STAFF: StaffItem[] = [
  { id: 'stf_1', name: 'Tunde Adeyemi', role: 'Lead Barber' },
  { id: 'stf_2', name: 'Emeka Okafor', role: 'Fade Specialist' },
];

function resolveServiceDepositKobo(service: ServiceItem): number {
  if (service.depositType === 'none') return 0;
  if (service.depositType === 'full') return service.priceKobo;
  if (service.depositType === 'percent') {
    const pct = Math.max(0, Math.min(100, service.depositValue));
    return Math.round((service.priceKobo * pct) / 100);
  }
  return Math.max(0, service.depositValue);
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
  const [merchantBearsCost, setMerchantBearsCost] = useState(false);
  const [defaultFreeCancelHours, setDefaultFreeCancelHours] = useState(4);
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
  const [bookingStatus, setBookingStatus] = useState<DepositCardStatus | null>(null);
  const [reference, setReference] = useState('sb_dep_01JFADEREP98K2');
  const [amountPaidKobo, setAmountPaidKobo] = useState(0);

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
          merchantBearsCost?: boolean;
          freeCancelHours?: number;
        };
        if (parsed.businessName) setBusinessName(parsed.businessName);
        if (parsed.location || parsed.address) setAddress(parsed.location || parsed.address || '');
        if (parsed.phone) setPhone(parsed.phone);
        if (parsed.cancellationPolicy) setCancellationPolicy(parsed.cancellationPolicy);
        if (parsed.schedule) setSchedule(parsed.schedule);
        if (typeof parsed.merchantBearsCost === 'boolean') {
          setMerchantBearsCost(parsed.merchantBearsCost);
        }
        if (typeof parsed.freeCancelHours === 'number') {
          setDefaultFreeCancelHours(parsed.freeCancelHours);
        }
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
        if (typeof data.business.merchantBearsCost === 'boolean') {
          setMerchantBearsCost(data.business.merchantBearsCost);
        }
        if (typeof data.business.freeCancelHours === 'number') {
          setDefaultFreeCancelHours(data.business.freeCancelHours);
        }
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
              depositType?: ServiceDepositRule;
              freeCancelHours?: number;
            }) => {
              const priceKobo = s.priceKobo ?? Math.round((s.price ?? 5000) * 100);
              const depositType: ServiceDepositRule =
                s.depositRequired === false || s.depositType === 'none'
                  ? 'none'
                  : s.depositType && ['fixed', 'percent', 'full', 'none'].includes(s.depositType)
                    ? s.depositType
                    : 'fixed';
              const depositValue =
                depositType === 'none'
                  ? 0
                  : depositType === 'full'
                    ? priceKobo
                    : (s.depositValue ?? Math.round((s.depositAmount ?? 1500) * 100));

              return {
                id: s.id,
                name: s.name,
                description: s.description || 'Bookable appointment service.',
                durationMinutes: s.durationMin ?? s.duration ?? 45,
                priceKobo,
                depositType,
                depositValue,
                freeCancelHours: s.freeCancelHours ?? data.business.freeCancelHours ?? 4,
              };
            },
          );

          const hasNoDepositService = mappedServices.some((s) => s.depositType === 'none');
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
                  depositType: 'none' as const,
                  depositValue: 0,
                  freeCancelHours: data.business.freeCancelHours ?? 4,
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

  const baseDepositKobo = selectedService ? resolveServiceDepositKobo(selectedService) : 0;
  const isNoDepositService = baseDepositKobo === 0;
  const koraFeeKobo =
    isNoDepositService || merchantBearsCost ? 0 : computeKoraFeeKobo(baseDepositKobo);
  const amountExpectedKobo = baseDepositKobo + koraFeeKobo;
  const serviceFreeCancelHours = selectedService?.freeCancelHours ?? defaultFreeCancelHours;

  const syncDashboardBooking = (
    ref: string,
    nextStatus: DepositCardStatus,
    expectedKobo: number,
  ) => {
    try {
      const existingRaw = localStorage.getItem('switchboard_dashboard_bookings');
      const existing = existingRaw
        ? (JSON.parse(existingRaw) as Array<{
            id: string;
            reference: string;
            status: string;
            paymentStatus: string;
          }>)
        : [];
      const found = existing.some((b) => b.reference === ref);
      const paymentStatus =
        expectedKobo === 0
          ? 'not_required'
          : nextStatus === 'confirmed'
            ? 'verified'
            : nextStatus === 'pending_verification'
              ? 'pending_verification'
              : 'awaiting_payment';

      const dashboardStatus =
        nextStatus === 'underpaid' || nextStatus === 'pending_verification' ? 'held' : nextStatus;

      if (found) {
        const updated = existing.map((b) =>
          b.reference === ref ? { ...b, status: dashboardStatus, paymentStatus } : b,
        );
        localStorage.setItem('switchboard_dashboard_bookings', JSON.stringify(updated));
      } else {
        const newRecord = {
          id: `bk_${Date.now()}`,
          reference: ref,
          customerName: customerName.trim() || 'Walk-in Customer',
          customerPhone: customerPhone.trim() || '+234 803 000 0000',
          serviceName: selectedService?.name || 'Service',
          staffName: selectedStaff?.name || 'Staff',
          slotTime: `${selectedDay?.shortDay ?? 'Today'} · ${selectedSlot}`,
          priceKobo: selectedService?.priceKobo ?? 500_000,
          depositKobo: expectedKobo,
          status: dashboardStatus,
          paymentStatus,
          holdSecondsRemaining: isNoDepositService ? undefined : 900,
          source: 'booking_page',
          createdAt: new Date().toISOString(),
        };
        localStorage.setItem(
          'switchboard_dashboard_bookings',
          JSON.stringify([newRecord, ...existing]),
        );
      }
    } catch {
      // Ignore storage error
    }
  };

  const handleHoldOrConfirmSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    const newRef = `sb_dep_${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    setReference(newRef);
    setAmountPaidKobo(0);

    const nextStatus: DepositCardStatus = isNoDepositService ? 'confirmed' : 'held';
    setBookingStatus(nextStatus);
    syncDashboardBooking(newRef, nextStatus, amountExpectedKobo);

    try {
      await fetch('/api/booking-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reference: newRef,
          status: nextStatus,
          amountExpectedKobo,
          amountPaidKobo: isNoDepositService ? 0 : 0,
          bankName: 'Wema Bank',
          accountNumber: '7829104482',
          accountName: `${businessName} via Switchboard`,
          ttlSeconds: 900,
        }),
      });
    } catch {
      // Offline fallback works with local state
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
              <p className="text-[12px] text-text-secondary mt-1">
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
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono uppercase tracking-wider bg-[#6258E8]/10 text-[#5247D8] font-semibold">
                Real-time slot protection · exclude using gist
              </span>
              <h1 className="text-[24px] font-bold text-[#111827] tracking-tight mt-2">
                Book an appointment at {businessName}
              </h1>
              <p className="text-[13px] text-text-secondary mt-0.5">{cancellationPolicy}</p>
            </div>

            {/* 1. Services List */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-semibold uppercase tracking-wider text-text-secondary">
                  1. Choose service
                </p>
                <span className="text-[11px] font-mono text-text-secondary">
                  Prices in NGN · Kora verified
                </span>
              </div>
              <div className="space-y-2.5">
                {servicesList.map((svc) => {
                  const active = svc.id === selectedServiceId;
                  const svcDepositKobo = resolveServiceDepositKobo(svc);
                  const noDeposit = svcDepositKobo === 0;
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
                            <span className="px-2 py-0.5 rounded-md bg-[#F59E0B]/15 text-[#92400E] text-[10px] font-mono font-semibold">
                              {svc.depositType === 'percent'
                                ? `${svc.depositValue}% deposit (${formatNairaFromKobo(svcDepositKobo)})`
                                : svc.depositType === 'full'
                                  ? `Full upfront (${formatNairaFromKobo(svcDepositKobo)})`
                                  : `${formatNairaFromKobo(svcDepositKobo)} deposit`}
                            </span>
                          )}
                        </div>
                        {svc.description && (
                          <p className="text-[12px] text-text-secondary line-clamp-1">
                            {svc.description}
                          </p>
                        )}
                        <p className="text-[11px] font-mono text-text-secondary">
                          {svc.durationMinutes} mins · Free cancel {svc.freeCancelHours}h before
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
              <p className="text-[12px] font-semibold uppercase tracking-wider text-text-secondary">
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
                      <div className="w-9 h-9 rounded-full bg-[#6258E8]/10 text-[#5247D8] flex items-center justify-center font-bold text-xs shrink-0">
                        {stf.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[14px] font-semibold text-[#111827] truncate">
                          {stf.name}
                        </p>
                        <p className="text-[12px] text-text-secondary truncate">{stf.role}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Interactive 7-Day Strip */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-semibold uppercase tracking-wider text-text-secondary">
                  3. Choose day
                </p>
                <span className="text-[11px] font-mono text-text-secondary">
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
                              ? 'text-white/95'
                              : 'text-text-secondary'
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
                              ? 'text-white/95'
                              : 'text-text-secondary'
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
              <p className="text-[12px] font-semibold uppercase tracking-wider text-text-secondary">
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

          {/* RIGHT COLUMN: Hold Band & Kora DepositCard / Direct Confirmation */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-[#E5E7EB] p-6 shadow-xs space-y-5 sticky top-6">
            <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-4">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wider text-text-secondary">
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
                <span className="text-text-secondary">Specialist</span>
                <span className="font-semibold text-[#111827]">{selectedStaff?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Date &amp; time</span>
                <span className="font-mono font-semibold text-[#111827]">
                  {selectedDay?.shortDay} {selectedDay?.dayNumber} {selectedDay?.monthShort} ·{' '}
                  {selectedSlot}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Total service fee</span>
                <span className="font-mono font-semibold text-[#111827]">
                  {formatNairaFromKobo(selectedService?.priceKobo ?? 0)}
                </span>
              </div>

              {!isNoDepositService && koraFeeKobo > 0 && (
                <div className="flex justify-between text-[12px]">
                  <span className="text-text-secondary">Kora processing fee</span>
                  <span className="font-mono text-[#111827]">
                    {formatNairaFromKobo(koraFeeKobo)}
                  </span>
                </div>
              )}

              <div className="flex justify-between pt-2 border-t border-slate-100">
                <span className="font-semibold text-[#111827]">
                  {isNoDepositService ? 'Upfront deposit' : 'Exact amount to transfer'}
                </span>
                <span
                  className={`font-mono font-bold ${
                    isNoDepositService ? 'text-[#10B981]' : 'text-[#5247D8]'
                  }`}
                >
                  {isNoDepositService ? '₦0 (No deposit)' : formatNairaFromKobo(amountExpectedKobo)}
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
                    : `Hold this time · Pay ${formatNairaFromKobo(amountExpectedKobo)} deposit`}
                </button>
              </form>
            ) : (
              <div className="space-y-4 pt-1">
                <DepositCard
                  reference={reference}
                  businessName={businessName}
                  customerName={customerName}
                  customerPhone={customerPhone}
                  baseDepositKobo={baseDepositKobo}
                  koraFeeKobo={koraFeeKobo}
                  amountExpectedKobo={amountExpectedKobo}
                  amountPaidKobo={amountPaidKobo}
                  merchantBearsCost={merchantBearsCost}
                  initialStatus={bookingStatus}
                  remainingSeconds={900}
                  freeCancelHours={serviceFreeCancelHours}
                  pollIntervalMs={3000}
                  enablePolling={!isNoDepositService}
                  onStatusChange={(next, paid) => {
                    setBookingStatus(next);
                    if (typeof paid === 'number') setAmountPaidKobo(paid);
                    syncDashboardBooking(reference, next, amountExpectedKobo);
                  }}
                  onPickDifferentSlot={() => setBookingStatus(null)}
                />

                <button
                  type="button"
                  onClick={() => setBookingStatus(null)}
                  className="w-full py-2 rounded-lg border border-[#E5E7EB] text-xs font-semibold text-text-secondary hover:text-[#111827] hover:bg-slate-50 transition-colors cursor-pointer"
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
