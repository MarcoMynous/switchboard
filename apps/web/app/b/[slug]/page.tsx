'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatNairaFromKobo } from '@/components/DepositCard';
import { SwitchboardIconSvg } from '@/components/SwitchboardLogo';

type ServiceDepositRule = 'fixed' | 'percent' | 'none' | 'full';

interface PublicBusiness {
  id: string;
  name: string;
  slug: string;
  location: string | null;
  phone: string | null;
  timezone: string;
  advanceDays: number;
  allowSameDay: boolean;
  cancellationPolicy: string | null;
  interledgerPaymentEnabled?: boolean;
  interledgerEnvironment?: 'testnet' | 'production';
  interledgerWalletAddress?: string | null;
}

interface ServiceItem {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  durationMin: number;
  priceKobo: number;
  depositType: ServiceDepositRule;
  depositValue: number;
}

interface StaffItem {
  id: string;
  name: string;
  roleTitle: string;
  serviceIds: string[];
}

interface ApiSlotOption {
  startsAt: string;
  endsAt: string;
  staffIds: string[];
  label: string;
  hourLocal: number;
}

interface CalendarDay {
  isoDate: string;
  dayNumber: number;
  isToday: boolean;
  disabled: boolean;
}

interface MonthCalendar {
  monthLabel: string;
  cells: Array<{ key: string; day: CalendarDay | null }>;
  canPrevMonth: boolean;
  canNextMonth: boolean;
}

function resolveServiceDepositKobo(service: ServiceItem): number {
  if (service.depositType === 'none') return 0;
  if (service.depositType === 'full') return service.priceKobo;
  if (service.depositType === 'percent') {
    const pct = Math.max(0, Math.min(100, service.depositValue));
    return Math.round((service.priceKobo * pct) / 100);
  }
  return Math.max(0, service.depositValue);
}

function formatSlotTime(
  isoUtc: string,
  timezone = 'Africa/Lagos',
): { label: string; hour: number } {
  try {
    const d = new Date(isoUtc);
    const label = new Intl.DateTimeFormat('en-NG', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: timezone,
    }).format(d);
    const hour = Number(label.split(':')[0] ?? 12);
    return { label, hour };
  } catch {
    return { label: isoUtc.slice(11, 16), hour: 12 };
  }
}

function getLocalIsoDate(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function buildMonthCalendar(
  monthOffset: number,
  timezone: string,
  advanceDays: number,
  allowSameDay: boolean,
): MonthCalendar {
  const todayIso = getLocalIsoDate(new Date(), timezone);
  const [todayYStr, todayMStr, todayDStr] = todayIso.split('-');
  const todayY = Number(todayYStr);
  const todayM = Number(todayMStr);
  const todayD = Number(todayDStr);
  const todayUtcMs = Date.UTC(todayY, todayM - 1, todayD);

  const firstOfTarget = new Date(Date.UTC(todayY, todayM - 1 + monthOffset, 1, 12, 0, 0));
  const year = firstOfTarget.getUTCFullYear();
  const monthIdx = firstOfTarget.getUTCMonth();
  const daysInMonth = new Date(Date.UTC(year, monthIdx + 1, 0, 12, 0, 0)).getUTCDate();
  const leadingEmpty = (firstOfTarget.getUTCDay() + 6) % 7; // Monday = 0

  const monthLabel = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(firstOfTarget);

  const cells: Array<{ key: string; day: CalendarDay | null }> = [];
  for (let i = 0; i < leadingEmpty; i++) {
    cells.push({ key: `pad-${year}-${monthIdx}-${i}`, day: null });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const isoDate = `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const cellUtcMs = Date.UTC(year, monthIdx, day);
    const diffDays = Math.round((cellUtcMs - todayUtcMs) / 86_400_000);
    const isToday = diffDays === 0;
    const disabled = diffDays < 0 || diffDays > advanceDays || (diffDays === 0 && !allowSameDay);
    cells.push({
      key: isoDate,
      day: {
        isoDate,
        dayNumber: day,
        isToday,
        disabled,
      },
    });
  }

  const nextMonthStartMs = Date.UTC(year, monthIdx + 1, 1);
  const nextMonthDiffDays = Math.round((nextMonthStartMs - todayUtcMs) / 86_400_000);

  return {
    monthLabel,
    cells,
    canPrevMonth: monthOffset > 0,
    canNextMonth: nextMonthDiffDays <= advanceDays,
  };
}

export default function PublicBookingPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? 'fade-republic';
  const router = useRouter();

  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [business, setBusiness] = useState<PublicBusiness | null>(null);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [staffList, setStaffList] = useState<StaffItem[]>([]);

  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [selectedStaffId, setSelectedStaffId] = useState<string>('any');
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDateIso, setSelectedDateIso] = useState<string>('');
  const [slots, setSlots] = useState<ApiSlotOption[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsAnnouncement, setSlotsAnnouncement] = useState('');
  const [selectedSlotStartsAt, setSelectedSlotStartsAt] = useState<string>('');

  const [fullName, setFullName] = useState('');
  const [countryCode, setCountryCode] = useState('+234');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');

  const [formError, setFormError] = useState<string | null>(null);
  const [alternatives, setAlternatives] = useState<ApiSlotOption[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() =>
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `hold_${Date.now()}`,
  );

  const rotateIdempotencyKey = useCallback(() => {
    setIdempotencyKey(
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `hold_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    );
  }, []);

  // 1. Load authoritative business catalog from backend
  useEffect(() => {
    let cancelled = false;
    setLoadingCatalog(true);
    setCatalogError(null);

    fetch(`/api/public/${encodeURIComponent(slug)}`, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(
            res.status === 404
              ? 'Business booking page not found.'
              : 'Unable to load booking catalog.',
          );
        }
        return (await res.json()) as {
          business: PublicBusiness;
          services: ServiceItem[];
          staff: StaffItem[];
        };
      })
      .then((data) => {
        if (cancelled) return;
        setBusiness(data.business);
        setServices(data.services ?? []);
        setStaffList(data.staff ?? []);
        if (data.services[0]) {
          setSelectedServiceId(data.services[0].id);
        }
        const tz = data.business.timezone || 'Africa/Lagos';
        const initialCal = buildMonthCalendar(
          0,
          tz,
          data.business.advanceDays ?? 14,
          data.business.allowSameDay ?? true,
        );
        const firstOpen = initialCal.cells.find((c) => c.day && !c.day.disabled)?.day;
        if (firstOpen) setSelectedDateIso(firstOpen.isoDate);
      })
      .catch((err) => {
        if (!cancelled) {
          setCatalogError(err instanceof Error ? err.message : 'Unable to load booking page.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingCatalog(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const timezone = business?.timezone || 'Africa/Lagos';
  const selectedService = useMemo(
    () => services.find((s) => s.id === selectedServiceId) ?? null,
    [services, selectedServiceId],
  );

  const eligibleStaff = useMemo(() => {
    if (!selectedService) return staffList;
    const filtered = staffList.filter(
      (st) => st.serviceIds.length === 0 || st.serviceIds.includes(selectedService.id),
    );
    return filtered.length > 0 ? filtered : staffList;
  }, [selectedService, staffList]);

  useEffect(() => {
    if (selectedStaffId !== 'any' && !eligibleStaff.some((st) => st.id === selectedStaffId)) {
      setSelectedStaffId('any');
    }
  }, [eligibleStaff, selectedStaffId]);

  const monthCalendar = useMemo(
    () =>
      buildMonthCalendar(
        monthOffset,
        timezone,
        business?.advanceDays ?? 14,
        business?.allowSameDay ?? true,
      ),
    [business?.advanceDays, business?.allowSameDay, timezone, monthOffset],
  );

  // 2. Load authoritative availability whenever service, staff, or date changes
  useEffect(() => {
    if (!business || !selectedService || !selectedDateIso) return;
    let cancelled = false;
    setSlotsLoading(true);
    setFormError(null);
    setAlternatives([]);

    const qs = new URLSearchParams({
      service: selectedService.id,
      date: selectedDateIso,
      limit: '36',
    });
    if (selectedStaffId !== 'any') {
      qs.set('staff', selectedStaffId);
    }

    fetch(`/api/public/${encodeURIComponent(slug)}/slots?${qs.toString()}`, {
      cache: 'no-store',
    })
      .then((res) => res.json())
      .then((data: { slots?: Array<{ startsAt: string; endsAt: string; staffIds: string[] }> }) => {
        if (cancelled) return;
        const nextSlots: ApiSlotOption[] = (data.slots ?? []).map((s) => {
          const fmt = formatSlotTime(s.startsAt, timezone);
          return {
            ...s,
            label: fmt.label,
            hourLocal: fmt.hour,
          };
        });
        setSlots(nextSlots);
        setSelectedSlotStartsAt((prev) =>
          nextSlots.some((s) => s.startsAt === prev) ? prev : (nextSlots[0]?.startsAt ?? ''),
        );
        setSlotsAnnouncement(
          nextSlots.length > 0
            ? `${nextSlots.length} available time slots loaded for ${selectedDateIso}.`
            : `No available times for ${selectedDateIso}.`,
        );
      })
      .catch(() => {
        if (!cancelled) {
          setSlots([]);
          setSelectedSlotStartsAt('');
          setSlotsAnnouncement('Unable to load availability.');
        }
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [business, selectedDateIso, selectedService, selectedStaffId, slug, timezone]);

  const groupedSlots = useMemo(() => {
    const morning = slots.filter((s) => s.hourLocal < 12);
    const afternoon = slots.filter((s) => s.hourLocal >= 12 && s.hourLocal < 17);
    const evening = slots.filter((s) => s.hourLocal >= 17);
    return [
      { key: 'morning', title: 'Morning', items: morning },
      { key: 'afternoon', title: 'Afternoon', items: afternoon },
      { key: 'evening', title: 'Evening', items: evening },
    ].filter((g) => g.items.length > 0);
  }, [slots]);

  const selectedSlotObj = useMemo(
    () => slots.find((s) => s.startsAt === selectedSlotStartsAt) ?? null,
    [slots, selectedSlotStartsAt],
  );

  const selectedStaffName = useMemo(() => {
    if (selectedStaffId === 'any') return 'Anyone available';
    return eligibleStaff.find((s) => s.id === selectedStaffId)?.name ?? 'Anyone available';
  }, [eligibleStaff, selectedStaffId]);

  const depositKobo = selectedService ? resolveServiceDepositKobo(selectedService) : 0;
  const priceKobo = selectedService?.priceKobo ?? 0;
  const remainingKobo = Math.max(0, priceKobo - depositKobo);

  const handleContinueToPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setAlternatives([]);

    if (!selectedService) {
      setFormError('Please select a service.');
      return;
    }
    if (!selectedSlotStartsAt) {
      setFormError('Please select an available appointment time.');
      return;
    }
    if (!fullName.trim()) {
      setFormError('Please enter your full name.');
      return;
    }
    const cleanDigits = phoneNumber.replace(/[^\d]/g, '');
    if (cleanDigits.length < 7 || cleanDigits.length > 15) {
      setFormError('Please enter a valid phone number.');
      return;
    }

    const formattedPhone =
      countryCode === '+234' && cleanDigits.startsWith('0')
        ? `+234${cleanDigits.slice(1)}`
        : `${countryCode}${cleanDigits}`;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/public/${encodeURIComponent(slug)}/holds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: selectedService.id,
          ...(selectedStaffId !== 'any' ? { staffId: selectedStaffId } : {}),
          startsAt: selectedSlotStartsAt,
          customer: {
            name: fullName.trim(),
            phone: formattedPhone,
          },
          idempotencyKey,
        }),
      });

      const payload = (await res.json()) as {
        booking?: { id: string; status: string };
        error?: { code?: string; message?: string };
        alternatives?: Array<{ startsAt: string; endsAt: string; staffIds: string[] }>;
      };

      if (res.status === 409 && payload.error?.code === 'SLOT_TAKEN') {
        const alts = (payload.alternatives ?? []).map((a) => {
          const fmt = formatSlotTime(a.startsAt, timezone);
          return { ...a, label: fmt.label, hourLocal: fmt.hour };
        });
        setAlternatives(alts);
        setFormError(
          'That time was just booked by someone else. Please pick another available slot.',
        );
        rotateIdempotencyKey();
        return;
      }

      if (!res.ok || !payload.booking) {
        if (payload.error?.code === 'INVALID_PHONE') {
          setFormError('Please enter a valid phone number (e.g. 0803 123 4567).');
        } else if (payload.error?.code === 'IDEMPOTENCY_KEY_REUSED') {
          rotateIdempotencyKey();
          setFormError('Your selection changed—please tap Continue to Payment again.');
        } else {
          setFormError(
            payload.error?.message ||
              'Unable to reserve this slot right now. Please try another time.',
          );
        }
        return;
      }

      router.push(
        `/b/${encodeURIComponent(slug)}/payment/${encodeURIComponent(payload.booking.id)}`,
      );
    } catch {
      setFormError('Network error while securing your slot. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingCatalog) {
    return (
      <main className="min-h-screen bg-[#F5F6FA] flex items-center justify-center p-6">
        <div className="flex items-center gap-3 text-sm font-medium text-[#22306B]">
          <span className="w-4 h-4 rounded-full border-2 border-[#22306B] border-t-transparent animate-spin" />
          <span>Loading booking schedule…</span>
        </div>
      </main>
    );
  }

  if (catalogError || !business) {
    return (
      <main className="min-h-screen bg-[#F5F6FA] flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl bg-white border border-slate-200 p-6 text-center space-y-2 shadow-xs">
          <h1 className="text-lg font-bold text-[#111827]">Booking page unavailable</h1>
          <p className="text-sm text-slate-600">
            {catalogError ?? 'This business booking link could not be found.'}
          </p>
        </div>
      </main>
    );
  }

  if (services.length === 0) {
    return (
      <main className="min-h-screen bg-[#F5F6FA] flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl bg-white border border-slate-200 p-6 text-center space-y-2 shadow-xs">
          <h1 className="text-lg font-bold text-[#111827]">{business.name}</h1>
          <p className="text-sm text-slate-600">
            No bookable services are currently published for this business.
          </p>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen lg:h-dvh lg:flex lg:flex-col bg-[#F5F6FA] text-[#111827]">
      {/* Compact Header (56px) */}
      <header className="h-14 shrink-0 bg-white border-b border-slate-200/80 px-4 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#22306B] text-white flex items-center justify-center shrink-0">
            <SwitchboardIconSvg className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-[#111827] truncate">{business.name}</p>
            {business.location && (
              <p className="text-[11px] text-slate-500 truncate">{business.location}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F5B700]/15 text-[#7A5900] text-[11px] font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F5B700]" />
            Interledger Test Wallet
          </span>
          <span className="text-[11px] font-medium text-slate-500 hidden md:inline">
            {timezone}
          </span>
        </div>
      </header>

      {/* Main Two-Column Booking Form */}
      <form
        onSubmit={(e) => void handleContinueToPayment(e)}
        className="flex-1 min-h-0 flex flex-col max-w-6xl w-full mx-auto px-4 sm:px-6 py-4 pb-28 lg:pb-4 gap-4"
      >
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* LEFT COLUMN: Service, Staff, Customer Details */}
          <div className="lg:col-span-6 lg:overflow-y-auto lg:pr-1 space-y-3.5">
            {/* 1. Service */}
            <section
              aria-labelledby="service-heading"
              className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <h2
                  id="service-heading"
                  className="text-xs font-bold uppercase tracking-wider text-[#22306B]"
                >
                  1. Service
                </h2>
                <span className="text-[11px] text-slate-500">{services.length} available</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
                {services.map((svc) => {
                  const selected = svc.id === selectedServiceId;
                  const dep = resolveServiceDepositKobo(svc);
                  return (
                    <button
                      key={svc.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setSelectedServiceId(svc.id)}
                      className={`w-full text-left px-3.5 py-2.5 rounded-xl border transition-colors cursor-pointer flex items-center justify-between gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22306B] ${
                        selected
                          ? 'border-[#22306B] bg-[#22306B]/[0.04] ring-1 ring-[#22306B]'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#111827] truncate">{svc.name}</p>
                        <p className="text-[11px] text-slate-500">
                          {svc.durationMin} mins ·{' '}
                          {dep > 0 ? `${formatNairaFromKobo(dep)} deposit` : 'No deposit'}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-[#22306B] shrink-0">
                        {formatNairaFromKobo(svc.priceKobo)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* 2. Staff */}
            <section
              aria-labelledby="staff-heading"
              className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 space-y-2.5"
            >
              <h2
                id="staff-heading"
                className="text-xs font-bold uppercase tracking-wider text-[#22306B]"
              >
                2. Staff
              </h2>
              {eligibleStaff.length === 0 ? (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  No staff members are assigned to this service yet.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    aria-pressed={selectedStaffId === 'any'}
                    onClick={() => setSelectedStaffId('any')}
                    className={`px-3 py-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22306B] ${
                      selectedStaffId === 'any'
                        ? 'border-[#22306B] bg-[#22306B] text-white'
                        : 'border-slate-200 bg-white text-[#111827] hover:border-slate-300'
                    }`}
                  >
                    Anyone Available
                  </button>
                  {eligibleStaff.map((st) => {
                    const selected = selectedStaffId === st.id;
                    return (
                      <button
                        key={st.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setSelectedStaffId(st.id)}
                        className={`px-3 py-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22306B] ${
                          selected
                            ? 'border-[#22306B] bg-[#22306B] text-white'
                            : 'border-slate-200 bg-white text-[#111827] hover:border-slate-300'
                        }`}
                      >
                        {st.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {/* 3. Customer Details */}
            <section
              aria-labelledby="details-heading"
              className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 space-y-2.5"
            >
              <h2
                id="details-heading"
                className="text-xs font-bold uppercase tracking-wider text-[#22306B]"
              >
                3. Your Details
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label
                    htmlFor="booking-full-name"
                    className="block text-[11px] font-semibold text-slate-700 mb-1"
                  >
                    Full name
                  </label>
                  <input
                    id="booking-full-name"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Adaeze Okonkwo"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#22306B]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="booking-phone"
                    className="block text-[11px] font-semibold text-slate-700 mb-1"
                  >
                    Phone number
                  </label>
                  <div className="flex gap-1.5">
                    <select
                      aria-label="Country code"
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                      className="px-2 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#22306B]"
                    >
                      <option value="+234">NG +234</option>
                      <option value="+44">UK +44</option>
                      <option value="+1">US +1</option>
                    </select>
                    <input
                      id="booking-phone"
                      type="tel"
                      required
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="0803 123 4567"
                      className="min-w-0 flex-1 px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#22306B]"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label
                  htmlFor="booking-email"
                  className="block text-[11px] font-semibold text-slate-700 mb-1"
                >
                  Email <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <input
                  id="booking-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="adaeze@example.com"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#22306B]"
                />
              </div>
            </section>
          </div>

          {/* RIGHT COLUMN: Date & Available Time Slots */}
          <div className="lg:col-span-6 lg:overflow-y-auto lg:pl-1 space-y-3.5">
            {/* 4. Date */}
            <section
              aria-labelledby="date-heading"
              className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <h2
                  id="date-heading"
                  className="text-xs font-bold uppercase tracking-wider text-[#22306B]"
                >
                  4. Date
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!monthCalendar.canPrevMonth}
                    onClick={() => setMonthOffset((m) => Math.max(0, m - 1))}
                    aria-label="Previous month"
                    className="p-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-xs font-semibold text-[#111827] min-w-[108px] text-center">
                    {monthCalendar.monthLabel}
                  </span>
                  <button
                    type="button"
                    disabled={!monthCalendar.canNextMonth}
                    onClick={() => setMonthOffset((m) => m + 1)}
                    aria-label="Next month"
                    className="p-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((wd) => (
                  <div
                    key={wd}
                    className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 py-0.5"
                  >
                    {wd}
                  </div>
                ))}
                {monthCalendar.cells.map(({ key, day }) => {
                  if (!day) {
                    return <div key={key} className="h-8" />;
                  }
                  const selected = day.isoDate === selectedDateIso;
                  return (
                    <button
                      key={day.isoDate}
                      type="button"
                      disabled={day.disabled}
                      aria-pressed={selected}
                      aria-label={day.isoDate}
                      onClick={() => setSelectedDateIso(day.isoDate)}
                      className={`h-8 rounded-lg border text-xs font-semibold transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed flex flex-col items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22306B] ${
                        selected
                          ? 'border-[#22306B] bg-[#22306B] text-white'
                          : day.isToday
                            ? 'border-[#22306B]/40 bg-[#22306B]/[0.05] text-[#22306B] hover:border-[#22306B]'
                            : 'border-transparent bg-slate-50/70 text-[#111827] hover:border-slate-300 hover:bg-white'
                      }`}
                    >
                      <span>{day.dayNumber}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* 5. Time Slots */}
            <section
              aria-labelledby="time-heading"
              className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h2
                  id="time-heading"
                  className="text-xs font-bold uppercase tracking-wider text-[#22306B]"
                >
                  5. Available Times (WAT)
                </h2>
                <span className="sr-only" aria-live="polite">
                  {slotsAnnouncement}
                </span>
                {selectedSlotObj && (
                  <span className="text-xs font-semibold text-[#22306B]">
                    Selected: {selectedSlotObj.label}
                  </span>
                )}
              </div>

              {slotsLoading ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'].map((k) => (
                    <div key={k} className="h-9 rounded-xl bg-slate-100 animate-pulse" />
                  ))}
                </div>
              ) : groupedSlots.length === 0 ? (
                <div className="rounded-xl bg-[#F5F6FA] border border-slate-200 p-4 text-center space-y-1">
                  <p className="text-xs font-semibold text-[#111827]">No open slots on this date</p>
                  <p className="text-[11px] text-slate-500">
                    Try another day or choose Anyone Available.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {groupedSlots.map((group) => (
                    <div key={group.key} className="space-y-1.5">
                      <p className="text-[11px] font-semibold text-slate-500">{group.title}</p>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {group.items.map((slot) => {
                          const selected = slot.startsAt === selectedSlotStartsAt;
                          return (
                            <button
                              key={slot.startsAt}
                              type="button"
                              aria-pressed={selected}
                              onClick={() => {
                                setSelectedSlotStartsAt(slot.startsAt);
                                setFormError(null);
                                rotateIdempotencyKey();
                              }}
                              className={`py-2 px-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22306B] ${
                                selected
                                  ? 'border-[#22306B] bg-[#22306B] text-white shadow-xs'
                                  : 'border-slate-200 bg-white text-[#111827] hover:border-[#22306B]/50'
                              }`}
                            >
                              {slot.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>

        {/* Inline Error / Slot Taken Alternatives */}
        {formError && (
          <div
            role="alert"
            className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs text-amber-900 flex flex-wrap items-center justify-between gap-2"
          >
            <span className="font-semibold">{formError}</span>
            {alternatives.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {alternatives.map((alt) => (
                  <button
                    key={alt.startsAt}
                    type="button"
                    onClick={() => {
                      setSelectedSlotStartsAt(alt.startsAt);
                      setFormError(null);
                      setAlternatives([]);
                      rotateIdempotencyKey();
                    }}
                    className="px-2.5 py-1 rounded-lg bg-white border border-amber-300 font-semibold text-[#111827] hover:border-[#22306B] cursor-pointer"
                  >
                    {alt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Bottom Compact Summary & Continue to Payment Bar */}
        <div className="fixed bottom-0 inset-x-0 lg:static z-20 bg-white border-t lg:border border-slate-200 lg:rounded-2xl shadow-sm px-4 sm:px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs min-w-0">
            <div>
              <p className="font-bold text-[#111827] truncate">
                {selectedService?.name ?? 'Select a service'}
              </p>
              <p className="text-[11px] text-slate-500">
                {selectedService ? `${selectedService.durationMin}m` : '—'} · {selectedStaffName} ·{' '}
                {selectedDateIso || '—'} {selectedSlotObj ? `at ${selectedSlotObj.label}` : ''}
              </p>
            </div>
            <div className="hidden md:flex items-center gap-4 pl-4 border-l border-slate-200">
              <div>
                <p className="text-[10px] uppercase text-slate-400 font-semibold">Total</p>
                <p className="font-semibold text-[#111827]">{formatNairaFromKobo(priceKobo)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-slate-400 font-semibold">Deposit due</p>
                <p className="font-bold text-[#22306B]">
                  {depositKobo > 0 ? formatNairaFromKobo(depositKobo) : '₦0'}
                </p>
              </div>
              {remainingKobo > 0 && (
                <div>
                  <p className="text-[10px] uppercase text-slate-400 font-semibold">At venue</p>
                  <p className="font-semibold text-slate-700">
                    {formatNairaFromKobo(remainingKobo)}
                  </p>
                </div>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !selectedSlotStartsAt || !selectedService}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#22306B] hover:bg-[#192350] text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22306B]"
          >
            {isSubmitting
              ? 'Reserving slot…'
              : depositKobo > 0
                ? 'Continue to Payment'
                : 'Confirm Booking'}
          </button>
        </div>
      </form>
    </div>
  );
}
