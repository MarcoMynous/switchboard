'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import type { OnboardingState } from '../app/onboarding/page';
import { AppIcon } from './AppIcon';
import { HoldBand } from './HoldBand';
import { Button } from './ui/button';

type BookingStatus = 'held' | 'confirmed' | 'completed' | 'expired' | 'cancelled' | 'no_show';

export type PaymentStatus =
  | 'not_required'
  | 'awaiting_payment'
  | 'pending_verification'
  | 'verified'
  | 'underpaid'
  | 'refund_pending'
  | 'refunded';

export type BookingSource = 'whatsapp' | 'web_chat' | 'booking_page' | 'staff';

export interface DashboardBookingRecord {
  id: string;
  reference: string;
  customerName: string;
  customerPhone: string;
  serviceName: string;
  staffName: string;
  slotTime: string;
  /** Optional ISO UTC start timestamp for date/calendar filtering */
  startsAt?: string;
  /** Service duration in minutes (default 30) */
  durationMin?: number;
  priceKobo: number;
  depositKobo: number;
  verifiedAmountKobo?: number;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  holdSecondsRemaining?: number;
  holdExpiresAt?: string;
  verifiedAt?: string;
  cancelReason?: string;
  customerNotes?: string;
  source: BookingSource;
  createdAt: string;
}

export interface DashboardConversationRecord {
  id: string;
  customerName: string;
  customerPhone: string;
  channel: 'whatsapp' | 'web_chat';
  lastMessage: string;
  status: 'agent_active' | 'needs_human' | 'staff_takeover' | 'resolved';
  escalationReason?: string;
  assignedTo?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  unread?: boolean;
  updatedAt: string;
  messages: Array<{
    id: string;
    sender: 'customer' | 'agent' | 'staff' | 'system';
    text: string;
    time: string;
    deliveryState?: 'queued' | 'sent' | 'delivered' | 'failed';
  }>;
}

type ViewMode = 'list' | 'calendar' | 'staff_schedule';
type CalendarMode = 'day' | 'week';
type DateRangeFilter = 'all' | 'today' | 'tomorrow' | 'week' | 'month' | 'custom';
type StatusFilter =
  | 'all'
  | 'confirmed'
  | 'held'
  | 'upcoming'
  | 'pending_verification'
  | 'expired'
  | 'cancelled'
  | 'needs_attention';

export interface BookingsManagementViewProps {
  workspace: OnboardingState;
  bookings: DashboardBookingRecord[];
  conversations: DashboardConversationRecord[];
  userRole: 'owner' | 'staff';
  isLoading: boolean;
  apiError: string | null;
  copiedSlug: boolean;
  onCopyBookingLink: () => void;
  onRetryLoad?: () => void;
  onCreateBooking: (booking: DashboardBookingRecord) => void;
  onUpdateBooking: (
    bookingId: string,
    updater: (prev: DashboardBookingRecord) => DashboardBookingRecord,
  ) => void;
  onNavigateSection: (
    section: 'conversations' | 'customers' | 'needs-attention' | 'payments',
  ) => void;
}

function formatNairaFromKobo(kobo: number): string {
  const naira = Math.round(kobo / 100);
  return `₦${naira.toLocaleString('en-NG')}`;
}

function formatPhoneForRole(phone: string, role: 'owner' | 'staff'): string {
  if (role === 'staff') {
    return `•••• ${phone.slice(-4)}`;
  }
  return phone;
}

function getTzName(timezone: string): string {
  if (timezone.includes('Accra')) return 'Africa/Accra';
  if (timezone.includes('Nairobi')) return 'Africa/Nairobi';
  return 'Africa/Lagos';
}

function getLocalDateKey(date: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: getTzName(timezone),
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function getBookingDateObj(bk: DashboardBookingRecord): Date {
  if (bk.startsAt) {
    const parsed = new Date(bk.startsAt);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  const created = new Date(bk.createdAt);
  return Number.isNaN(created.getTime()) ? new Date() : created;
}

function getBookingHour(bk: DashboardBookingRecord, timezone: string): number {
  const dt = getBookingDateObj(bk);
  if (bk.startsAt) {
    try {
      const hourStr = new Intl.DateTimeFormat('en-US', {
        timeZone: getTzName(timezone),
        hour: 'numeric',
        hour12: false,
      }).format(dt);
      const parsed = Number.parseInt(hourStr, 10);
      if (!Number.isNaN(parsed)) return parsed;
    } catch {
      // fall through
    }
  }
  // Parse from slotTime like "Today, 2:30 PM (WAT)"
  const match = /(\d{1,2}):(\d{2})\s*(AM|PM)/i.exec(bk.slotTime);
  if (match?.[1] && match[3]) {
    let h = Number.parseInt(match[1], 10);
    const ampm = match[3].toUpperCase();
    if (ampm === 'PM' && h < 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return h;
  }
  return 14;
}

function formatSourceLabel(source: BookingSource): string {
  switch (source) {
    case 'whatsapp':
      return 'WhatsApp';
    case 'web_chat':
      return 'Web Chat';
    case 'booking_page':
      return 'Booking Page';
    case 'staff':
      return 'Manual';
  }
}

function getBookingStatusMeta(status: BookingStatus): {
  label: string;
  badgeClass: string;
  icon: string;
} {
  switch (status) {
    case 'confirmed':
      return {
        label: 'Confirmed',
        badgeClass: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
        icon: 'verified',
      };
    case 'completed':
      return {
        label: 'Completed',
        badgeClass: 'bg-indigo-100 text-indigo-800 border border-indigo-200',
        icon: 'task_alt',
      };
    case 'held':
      return {
        label: 'Awaiting Deposit',
        badgeClass: 'bg-amber-100 text-amber-900 border border-amber-300',
        icon: 'schedule',
      };
    case 'expired':
      return {
        label: 'Expired',
        badgeClass: 'bg-slate-100 text-slate-700 border border-slate-200',
        icon: 'history',
      };
    case 'cancelled':
      return {
        label: 'Cancelled',
        badgeClass: 'bg-red-50 text-red-700 border border-red-200',
        icon: 'cancel',
      };
    case 'no_show':
      return {
        label: 'No-Show',
        badgeClass: 'bg-red-100 text-red-800 border border-red-200',
        icon: 'person_off',
      };
  }
}

function getPaymentStatusMeta(paymentStatus: PaymentStatus): {
  label: string;
  textClass: string;
  icon: string;
} {
  switch (paymentStatus) {
    case 'verified':
      return { label: 'Verified', textClass: 'text-emerald-700', icon: 'check_circle' };
    case 'awaiting_payment':
      return { label: 'Awaiting Payment', textClass: 'text-amber-700', icon: 'hourglass_bottom' };
    case 'pending_verification':
      return { label: 'Pending Verification', textClass: 'text-indigo-700', icon: 'sync' };
    case 'underpaid':
      return { label: 'Underpaid', textClass: 'text-red-700', icon: 'warning' };
    case 'refund_pending':
      return { label: 'Refund Pending', textClass: 'text-amber-700', icon: 'currency_exchange' };
    case 'refunded':
      return { label: 'Refunded', textClass: 'text-slate-600', icon: 'assignment_return' };
    case 'not_required':
      return {
        label: 'No Deposit Required',
        textClass: 'text-slate-600',
        icon: 'remove_circle_outline',
      };
  }
}

const DAILY_HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];

function formatHourLabel(hour24: number): string {
  const period = hour24 >= 12 ? 'PM' : 'AM';
  const h12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${h12}:00 ${period}`;
}

export function BookingsManagementView({
  workspace,
  bookings,
  conversations,
  userRole,
  isLoading,
  apiError,
  copiedSlug,
  onCopyBookingLink,
  onRetryLoad,
  onCreateBooking,
  onUpdateBooking,
  onNavigateSection,
}: BookingsManagementViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [calendarMode, setCalendarMode] = useState<CalendarMode>('day');
  const [calendarDate, setCalendarDate] = useState<Date>(() => new Date());
  const [calendarStaffFilter, setCalendarStaffFilter] = useState<string>('all');

  // Search & Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<DateRangeFilter>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [staffFilter, setStaffFilter] = useState<string>('all');
  const [serviceFilter, setServiceFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | BookingSource>('all');
  const [paymentFilter, setPaymentFilter] = useState<'all' | PaymentStatus>('all');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Details Drawer & Action Modals
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [checkingPaymentId, setCheckingPaymentId] = useState<string | null>(null);
  const [paymentCheckMessage, setPaymentCheckMessage] = useState<{
    bookingId: string;
    tone: 'success' | 'pending' | 'issue';
    text: string;
  } | null>(null);

  // Guided Manual Booking Modal (5-step)
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [manualStep, setManualStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [manualForm, setManualForm] = useState({
    customerMode: 'new' as 'existing' | 'new',
    customerName: '',
    customerPhone: '+234 ',
    customerNotes: '',
    serviceIndex: 0,
    staffIndex: 0,
    dateKey: getLocalDateKey(new Date(), workspace.timezone),
    hourSlot: 14,
  });

  // Cancel Dialog
  const [cancelTarget, setCancelTarget] = useState<DashboardBookingRecord | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [initiateRefundOnCancel, setInitiateRefundOnCancel] = useState(true);

  // Reschedule Modal
  const [rescheduleTarget, setRescheduleTarget] = useState<DashboardBookingRecord | null>(null);
  const [rescheduleDateKey, setRescheduleDateKey] = useState(() =>
    getLocalDateKey(new Date(), workspace.timezone),
  );
  const [rescheduleHour, setRescheduleHour] = useState<number>(15);
  const [rescheduleStaff, setRescheduleStaff] = useState<string>('');

  const selectedBooking = useMemo(
    () => bookings.find((b) => b.id === selectedBookingId) ?? null,
    [bookings, selectedBookingId],
  );

  // Known customers for Step 1 existing customer search
  const knownCustomers = useMemo(() => {
    const map = new Map<string, { name: string; phone: string }>();
    for (const b of bookings) {
      if (!map.has(b.customerPhone)) {
        map.set(b.customerPhone, { name: b.customerName, phone: b.customerPhone });
      }
    }
    for (const c of conversations) {
      if (!map.has(c.customerPhone)) {
        map.set(c.customerPhone, { name: c.customerName, phone: c.customerPhone });
      }
    }
    return Array.from(map.values());
  }, [bookings, conversations]);

  const findLinkedConversation = useCallback(
    (bk: DashboardBookingRecord): DashboardConversationRecord | null => {
      return (
        conversations.find(
          (c) =>
            c.customerPhone === bk.customerPhone ||
            c.customerName.toLowerCase() === bk.customerName.toLowerCase(),
        ) ?? null
      );
    },
    [conversations],
  );

  const hasBookingIssue = useCallback(
    (bk: DashboardBookingRecord): boolean => {
      if (bk.paymentStatus === 'pending_verification' || bk.paymentStatus === 'underpaid') {
        return true;
      }
      if (bk.paymentStatus === 'refund_pending') return true;
      const conv = findLinkedConversation(bk);
      return conv?.status === 'needs_human';
    },
    [findLinkedConversation],
  );

  // Date-range matching
  const matchesDateRange = useCallback(
    (bk: DashboardBookingRecord): boolean => {
      if (dateRangeFilter === 'all') return true;
      const bkDateKey = getLocalDateKey(getBookingDateObj(bk), workspace.timezone);
      const today = new Date();
      const todayKey = getLocalDateKey(today, workspace.timezone);

      if (dateRangeFilter === 'today') return bkDateKey === todayKey;
      if (dateRangeFilter === 'tomorrow') {
        const tmr = new Date(today);
        tmr.setDate(tmr.getDate() + 1);
        return bkDateKey === getLocalDateKey(tmr, workspace.timezone);
      }
      if (dateRangeFilter === 'week') {
        const start = new Date(today);
        start.setDate(today.getDate() - today.getDay());
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        return (
          bkDateKey >= getLocalDateKey(start, workspace.timezone) &&
          bkDateKey <= getLocalDateKey(end, workspace.timezone)
        );
      }
      if (dateRangeFilter === 'month') {
        return bkDateKey.slice(0, 7) === todayKey.slice(0, 7);
      }
      if (dateRangeFilter === 'custom') {
        if (customStartDate && bkDateKey < customStartDate) return false;
        if (customEndDate && bkDateKey > customEndDate) return false;
        return true;
      }
      return true;
    },
    [dateRangeFilter, customStartDate, customEndDate, workspace.timezone],
  );

  // Summary cards counts (computed over selected date range)
  const summaryCounts = useMemo(() => {
    const inRange = bookings.filter(matchesDateRange);
    const nowMs = Date.now();

    const confirmed = inRange.filter(
      (b) => b.status === 'confirmed' || b.status === 'completed',
    ).length;

    const awaitingPayment = inRange.filter(
      (b) => b.status === 'held' && (b.holdSecondsRemaining ?? 900) > 0,
    ).length;

    const upcoming = inRange.filter((b) => {
      if (b.status !== 'confirmed') return false;
      if (b.startsAt) {
        return new Date(b.startsAt).getTime() >= nowMs;
      }
      return true;
    }).length;

    const needsAttention = inRange.filter(hasBookingIssue).length;

    return { confirmed, awaitingPayment, upcoming, needsAttention };
  }, [bookings, matchesDateRange, hasBookingIssue]);

  // Filtered bookings list
  const filteredBookings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return bookings.filter((bk) => {
      if (!matchesDateRange(bk)) return false;

      if (q) {
        const hay =
          `${bk.customerName} ${bk.customerPhone} ${bk.reference} ${bk.serviceName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      if (statusFilter === 'confirmed' && bk.status !== 'confirmed' && bk.status !== 'completed') {
        return false;
      }
      if (statusFilter === 'held' && bk.status !== 'held') return false;
      if (statusFilter === 'upcoming') {
        if (bk.status !== 'confirmed') return false;
        if (bk.startsAt && new Date(bk.startsAt).getTime() < Date.now()) return false;
      }
      if (statusFilter === 'pending_verification' && bk.paymentStatus !== 'pending_verification') {
        return false;
      }
      if (statusFilter === 'expired' && bk.status !== 'expired') return false;
      if (statusFilter === 'cancelled' && bk.status !== 'cancelled') return false;
      if (statusFilter === 'needs_attention' && !hasBookingIssue(bk)) return false;

      if (staffFilter !== 'all' && bk.staffName !== staffFilter) return false;
      if (serviceFilter !== 'all' && bk.serviceName !== serviceFilter) return false;
      if (sourceFilter !== 'all' && bk.source !== sourceFilter) return false;
      if (paymentFilter !== 'all' && bk.paymentStatus !== paymentFilter) return false;

      return true;
    });
  }, [
    bookings,
    matchesDateRange,
    hasBookingIssue,
    searchQuery,
    statusFilter,
    staffFilter,
    serviceFilter,
    sourceFilter,
    paymentFilter,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredBookings.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedBookings = filteredBookings.slice((safePage - 1) * pageSize, safePage * pageSize);

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    statusFilter !== 'all' ||
    dateRangeFilter !== 'all' ||
    staffFilter !== 'all' ||
    serviceFilter !== 'all' ||
    sourceFilter !== 'all' ||
    paymentFilter !== 'all';

  const clearAllFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setDateRangeFilter('all');
    setCustomStartDate('');
    setCustomEndDate('');
    setStaffFilter('all');
    setServiceFilter('all');
    setSourceFilter('all');
    setPaymentFilter('all');
    setCurrentPage(1);
  };

  // Authoritative backend payment status check (never blindly sets verified)
  const handleCheckPaymentStatus = async (bk: DashboardBookingRecord) => {
    setCheckingPaymentId(bk.id);
    setPaymentCheckMessage(null);
    try {
      const res = await fetch(`/api/booking-status?reference=${encodeURIComponent(bk.reference)}`);
      const data = (await res.json()) as {
        ok?: boolean;
        found?: boolean;
        status?: string;
        amountPaidKobo?: number;
        amountExpectedKobo?: number;
      };

      if (!res.ok || !data.ok) {
        setPaymentCheckMessage({
          bookingId: bk.id,
          tone: 'issue',
          text: 'Could not reach payment verification service. Please try again.',
        });
        return;
      }

      if (!data.found) {
        setPaymentCheckMessage({
          bookingId: bk.id,
          tone: 'pending',
          text: "We haven't confirmed this payment yet. Switchboard will continue checking.",
        });
        return;
      }

      if (data.status === 'confirmed') {
        onUpdateBooking(bk.id, (prev) => ({
          ...prev,
          status: 'confirmed',
          paymentStatus: 'verified',
          verifiedAmountKobo: data.amountPaidKobo ?? prev.depositKobo,
          verifiedAt: new Date().toISOString(),
          holdSecondsRemaining: undefined,
        }));
        setPaymentCheckMessage({
          bookingId: bk.id,
          tone: 'success',
          text: 'The deposit has been successfully verified.',
        });
      } else if (data.status === 'underpaid') {
        onUpdateBooking(bk.id, (prev) => ({
          ...prev,
          paymentStatus: 'underpaid',
          verifiedAmountKobo: data.amountPaidKobo ?? 0,
        }));
        setPaymentCheckMessage({
          bookingId: bk.id,
          tone: 'issue',
          text: 'This payment needs attention. Review the details before taking action.',
        });
      } else if (data.status === 'expired') {
        onUpdateBooking(bk.id, (prev) => ({
          ...prev,
          status: 'expired',
          holdSecondsRemaining: 0,
        }));
        setPaymentCheckMessage({
          bookingId: bk.id,
          tone: 'issue',
          text: 'Reservation expired before payment was completed.',
        });
      } else {
        setPaymentCheckMessage({
          bookingId: bk.id,
          tone: 'pending',
          text: "We haven't confirmed this payment yet. Switchboard will continue checking.",
        });
      }
    } catch {
      setPaymentCheckMessage({
        bookingId: bk.id,
        tone: 'pending',
        text: "We haven't confirmed this payment yet. Switchboard will continue checking.",
      });
    } finally {
      setCheckingPaymentId(null);
    }
  };

  // Check if a staff member has a conflict at (dateKey, hour)
  const isSlotOccupied = (
    staffName: string,
    dateKey: string,
    hour: number,
    ignoreBookingId?: string,
  ): boolean => {
    return bookings.some((bk) => {
      if (bk.id === ignoreBookingId) return false;
      if (bk.status !== 'held' && bk.status !== 'confirmed') return false;
      if (bk.staffName !== staffName) return false;
      const bkDateKey = getLocalDateKey(getBookingDateObj(bk), workspace.timezone);
      if (bkDateKey !== dateKey) return false;
      return getBookingHour(bk, workspace.timezone) === hour;
    });
  };

  // Create manual booking respecting policy & availability
  const handleCompleteManualBooking = () => {
    const svc = workspace.services[manualForm.serviceIndex] ?? {
      id: 'svc_default',
      name: 'Classic Fade & Beard Sculpt',
      duration: 45,
      price: 5000,
      depositAmount: workspace.depositAmount || 1500,
    };
    const stf = workspace.staff[manualForm.staffIndex] ?? {
      id: 'stf_default',
      name: 'Tunde Adeyemi',
    };

    const requiresDeposit = Boolean(workspace.depositRequired && workspace.depositAmount > 0);
    const depositKobo = requiresDeposit ? workspace.depositAmount * 100 : 0;
    const ulidSuffix = Math.random().toString(36).substring(2, 10).toUpperCase();
    const startsAtIso = `${manualForm.dateKey}T${String(manualForm.hourSlot).padStart(2, '0')}:00:00+01:00`;
    const slotLabel = `${
      manualForm.dateKey === getLocalDateKey(new Date(), workspace.timezone)
        ? 'Today'
        : manualForm.dateKey
    }, ${formatHourLabel(manualForm.hourSlot)} (WAT)`;

    const newBooking: DashboardBookingRecord = {
      id: `bk_${Date.now()}`,
      reference: `sb_dep_${ulidSuffix}`,
      customerName: manualForm.customerName.trim() || 'Walk-in Customer',
      customerPhone: manualForm.customerPhone.trim() || '+234 800 000 0000',
      customerNotes: manualForm.customerNotes.trim() || undefined,
      serviceName: svc.name,
      staffName: stf.name,
      slotTime: slotLabel,
      startsAt: new Date(startsAtIso).toISOString(),
      durationMin: svc.duration || 30,
      priceKobo: svc.price * 100,
      depositKobo,
      status: requiresDeposit ? 'held' : 'confirmed',
      paymentStatus: requiresDeposit ? 'awaiting_payment' : 'not_required',
      holdSecondsRemaining: requiresDeposit ? 900 : undefined,
      holdExpiresAt: requiresDeposit
        ? new Date(Date.now() + 15 * 60 * 1000).toISOString()
        : undefined,
      source: 'staff',
      createdAt: new Date().toISOString(),
    };

    onCreateBooking(newBooking);
    setManualModalOpen(false);
    setManualStep(1);
    setManualForm((prev) => ({
      ...prev,
      customerName: '',
      customerPhone: '+234 ',
      customerNotes: '',
    }));
    setSelectedBookingId(newBooking.id);
  };

  const handleConfirmCancel = () => {
    if (!cancelTarget) return;
    onUpdateBooking(cancelTarget.id, (prev) => ({
      ...prev,
      status: 'cancelled',
      cancelReason: cancelReason.trim() || 'Cancelled by staff',
      holdSecondsRemaining: undefined,
      paymentStatus:
        prev.paymentStatus === 'verified' && initiateRefundOnCancel
          ? 'refund_pending'
          : prev.paymentStatus,
    }));
    setCancelTarget(null);
    setCancelReason('');
  };

  const handleConfirmReschedule = () => {
    if (!rescheduleTarget) return;
    const targetStaff = rescheduleStaff || rescheduleTarget.staffName;
    if (isSlotOccupied(targetStaff, rescheduleDateKey, rescheduleHour, rescheduleTarget.id)) {
      return;
    }
    const startsAtIso = `${rescheduleDateKey}T${String(rescheduleHour).padStart(2, '0')}:00:00+01:00`;
    const slotLabel = `${
      rescheduleDateKey === getLocalDateKey(new Date(), workspace.timezone)
        ? 'Today'
        : rescheduleDateKey
    }, ${formatHourLabel(rescheduleHour)} (WAT)`;

    onUpdateBooking(rescheduleTarget.id, (prev) => ({
      ...prev,
      staffName: targetStaff,
      slotTime: slotLabel,
      startsAt: new Date(startsAtIso).toISOString(),
    }));
    setRescheduleTarget(null);
  };

  const selectedServiceForManual = workspace.services[manualForm.serviceIndex] ?? {
    name: 'Classic Fade & Beard Sculpt',
    durationMin: 45,
    price: 5000,
  };
  const selectedStaffForManual = workspace.staff[manualForm.staffIndex] ?? {
    name: 'Tunde Adeyemi',
  };

  const activeDateKey = getLocalDateKey(calendarDate, workspace.timezone);

  const weekDays = useMemo(() => {
    const start = new Date(calendarDate);
    const day = start.getDay();
    const diffToMon = day === 0 ? -6 : 1 - day;
    start.setDate(start.getDate() + diffToMon);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [calendarDate]);

  return (
    <div className="space-y-6">
      {/* =====================================================================
          ROW 1: PAGE HEADER
      ===================================================================== */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-2 border-b border-border/50">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap text-xs text-text-secondary font-medium">
            <span>{workspace.businessName}</span>
            <span>•</span>
            <span>{workspace.timezone}</span>
            <span>•</span>
            <span className="inline-flex items-center gap-1 text-emerald-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Web booking active
            </span>
          </div>
          <h1 className="font-headline-lg text-2xl sm:text-3xl font-bold text-text-primary tracking-tight">
            Bookings
          </h1>
          <p className="font-body-md text-sm text-text-secondary">
            Manage appointments, track payments, and keep your schedule organized.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={() => {
              setManualStep(1);
              setManualModalOpen(true);
            }}
            className="h-9"
          >
            <AppIcon name="add" className="text-[16px]" />
            <span>New Booking</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setViewMode(viewMode === 'calendar' ? 'list' : 'calendar')}
            className="h-9"
          >
            <AppIcon
              name={viewMode === 'calendar' ? 'view_list' : 'calendar_month'}
              className="text-[16px] text-primary"
            />
            <span>{viewMode === 'calendar' ? 'View List' : 'View Calendar'}</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCopyBookingLink}
            className="h-9"
          >
            <AppIcon
              name={copiedSlug ? 'check' : 'content_copy'}
              className="text-[16px] text-primary"
            />
            <span>{copiedSlug ? 'Link Copied!' : 'Copy Booking Link'}</span>
          </Button>

          <Link
            href={`/b/${workspace.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="h-9 px-3 rounded-lg border border-border bg-surface hover:bg-surface-container-low text-xs font-medium text-text-primary inline-flex items-center gap-1.5 transition-colors"
          >
            <span>Open Booking Page</span>
            <AppIcon name="open_in_new" className="text-[14px]" />
          </Link>
        </div>
      </div>

      {/* =====================================================================
          ROW 2: BOOKING SUMMARY CARDS (4 CLICKABLE CARDS)
      ===================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => {
            setStatusFilter(statusFilter === 'confirmed' ? 'all' : 'confirmed');
            setCurrentPage(1);
          }}
          className={`bg-surface rounded-xl p-4 border text-left transition-all cursor-pointer ${
            statusFilter === 'confirmed'
              ? 'border-primary ring-2 ring-primary/15 shadow-sm'
              : 'border-border/70 hover:border-primary/40 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-text-primary">Confirmed</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <AppIcon name="event_available" className="text-[16px]" />
            </div>
          </div>
          <div className="text-2xl font-bold text-text-primary">{summaryCounts.confirmed}</div>
          <p className="text-xs text-text-secondary mt-1">Appointments successfully secured.</p>
        </button>

        <button
          type="button"
          onClick={() => {
            setStatusFilter(statusFilter === 'held' ? 'all' : 'held');
            setCurrentPage(1);
          }}
          className={`bg-surface rounded-xl p-4 border text-left transition-all cursor-pointer ${
            statusFilter === 'held'
              ? 'border-amber-500 ring-2 ring-amber-500/15 shadow-sm'
              : 'border-border/70 hover:border-amber-400 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-text-primary">Awaiting Payment</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <AppIcon name="schedule" className="text-[16px]" />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-700">{summaryCounts.awaitingPayment}</div>
          <p className="text-xs text-text-secondary mt-1">
            Temporarily reserved while customers pay.
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setStatusFilter(statusFilter === 'upcoming' ? 'all' : 'upcoming');
            setCurrentPage(1);
          }}
          className={`bg-surface rounded-xl p-4 border text-left transition-all cursor-pointer ${
            statusFilter === 'upcoming'
              ? 'border-primary ring-2 ring-primary/15 shadow-sm'
              : 'border-border/70 hover:border-primary/40 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-text-primary">Upcoming</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-primary flex items-center justify-center">
              <AppIcon name="upcoming" className="text-[16px]" />
            </div>
          </div>
          <div className="text-2xl font-bold text-text-primary">{summaryCounts.upcoming}</div>
          <p className="text-xs text-text-secondary mt-1">
            Confirmed appointments not started yet.
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setStatusFilter(statusFilter === 'needs_attention' ? 'all' : 'needs_attention');
            setCurrentPage(1);
          }}
          className={`bg-surface rounded-xl p-4 border text-left transition-all cursor-pointer ${
            statusFilter === 'needs_attention'
              ? 'border-amber-500 ring-2 ring-amber-500/15 shadow-sm'
              : summaryCounts.needsAttention > 0
                ? 'border-amber-300 bg-amber-50/20 shadow-xs'
                : 'border-border/70 hover:border-emerald-300 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-text-primary">Needs Attention</span>
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                summaryCounts.needsAttention > 0
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-emerald-50 text-emerald-700'
              }`}
            >
              <AppIcon
                name={summaryCounts.needsAttention > 0 ? 'notification_important' : 'check_circle'}
                className="text-[16px]"
              />
            </div>
          </div>
          <div
            className={`text-2xl font-bold ${
              summaryCounts.needsAttention > 0 ? 'text-amber-700' : 'text-text-primary'
            }`}
          >
            {summaryCounts.needsAttention}
          </div>
          <p className="text-xs text-text-secondary mt-1">
            {summaryCounts.needsAttention > 0
              ? 'Unresolved booking or payment issues.'
              : 'No booking or payment issues.'}
          </p>
        </button>
      </div>

      {/* =====================================================================
          ROW 3: VIEW SELECTOR & COMPACT SEARCH / FILTER TOOLBAR
      ===================================================================== */}
      <div className="bg-surface rounded-xl border border-border/70 p-4 space-y-3 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* View Mode Segmented Control */}
          <div className="inline-flex p-1 rounded-lg bg-surface-container-low border border-border/50 self-start">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                viewMode === 'list'
                  ? 'bg-surface text-primary shadow-2xs'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <AppIcon name="view_list" className="text-[15px]" />
              <span>List</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                viewMode === 'calendar'
                  ? 'bg-surface text-primary shadow-2xs'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <AppIcon name="calendar_month" className="text-[15px]" />
              <span>Calendar</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('staff_schedule')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                viewMode === 'staff_schedule'
                  ? 'bg-surface text-primary shadow-2xs'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <AppIcon name="groups" className="text-[15px]" />
              <span>Staff Schedule</span>
            </button>
          </div>

          {/* Search & Mobile Filter Toggle */}
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <AppIcon
                name="search"
                className="text-[17px] text-text-secondary absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search customer, phone, reference, or service..."
                className="w-full h-9 pl-9 pr-3 rounded-lg border border-border bg-surface text-xs text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <button
              type="button"
              onClick={() => setMobileFiltersOpen((prev) => !prev)}
              className="md:hidden h-9 px-3 rounded-lg border border-border bg-surface text-xs font-medium text-text-primary flex items-center gap-1.5 cursor-pointer"
            >
              <AppIcon name="filter_list" className="text-[16px]" />
              <span>Filters</span>
            </button>
          </div>
        </div>

        {/* Filter Controls */}
        <div
          className={`${
            mobileFiltersOpen ? 'grid' : 'hidden md:grid'
          } grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 pt-2 border-t border-border/50`}
        >
          <select
            aria-label="Filter by booking status"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as StatusFilter);
              setCurrentPage(1);
            }}
            className="h-8 px-2.5 rounded-lg border border-border bg-surface text-xs text-text-primary"
          >
            <option value="all">Status: All</option>
            <option value="confirmed">Confirmed</option>
            <option value="held">Awaiting Deposit</option>
            <option value="pending_verification">Payment Being Verified</option>
            <option value="expired">Expired</option>
            <option value="cancelled">Cancelled</option>
            <option value="needs_attention">Needs Attention</option>
          </select>

          <select
            aria-label="Filter by date range"
            value={dateRangeFilter}
            onChange={(e) => {
              setDateRangeFilter(e.target.value as DateRangeFilter);
              setCurrentPage(1);
            }}
            className="h-8 px-2.5 rounded-lg border border-border bg-surface text-xs text-text-primary"
          >
            <option value="all">Date: All Dates</option>
            <option value="today">Today</option>
            <option value="tomorrow">Tomorrow</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="custom">Custom Range</option>
          </select>

          <select
            aria-label="Filter by staff member"
            value={staffFilter}
            onChange={(e) => {
              setStaffFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="h-8 px-2.5 rounded-lg border border-border bg-surface text-xs text-text-primary"
          >
            <option value="all">Staff: All</option>
            {workspace.staff.map((stf) => (
              <option key={stf.id || stf.name} value={stf.name}>
                {stf.name}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by service"
            value={serviceFilter}
            onChange={(e) => {
              setServiceFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="h-8 px-2.5 rounded-lg border border-border bg-surface text-xs text-text-primary"
          >
            <option value="all">Service: All</option>
            {workspace.services.map((svc) => (
              <option key={svc.id || svc.name} value={svc.name}>
                {svc.name}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by booking source"
            value={sourceFilter}
            onChange={(e) => {
              setSourceFilter(e.target.value as 'all' | BookingSource);
              setCurrentPage(1);
            }}
            className="h-8 px-2.5 rounded-lg border border-border bg-surface text-xs text-text-primary"
          >
            <option value="all">Source: All</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="web_chat">Web Chat</option>
            <option value="booking_page">Public Booking Page</option>
            <option value="staff">Manual</option>
          </select>

          <select
            aria-label="Filter by payment status"
            value={paymentFilter}
            onChange={(e) => {
              setPaymentFilter(e.target.value as 'all' | PaymentStatus);
              setCurrentPage(1);
            }}
            className="h-8 px-2.5 rounded-lg border border-border bg-surface text-xs text-text-primary"
          >
            <option value="all">Payment: All</option>
            <option value="not_required">No Deposit Required</option>
            <option value="awaiting_payment">Awaiting Payment</option>
            <option value="pending_verification">Pending Verification</option>
            <option value="verified">Verified</option>
            <option value="underpaid">Underpaid</option>
            <option value="refund_pending">Refund Pending</option>
            <option value="refunded">Refunded</option>
          </select>
        </div>

        {dateRangeFilter === 'custom' && (
          <div className="flex items-center gap-3 flex-wrap pt-1 text-xs">
            <label className="flex items-center gap-1.5 text-text-secondary">
              <span>From:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="h-8 px-2 rounded-md border border-border bg-surface text-text-primary"
              />
            </label>
            <label className="flex items-center gap-1.5 text-text-secondary">
              <span>To:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="h-8 px-2 rounded-md border border-border bg-surface text-text-primary"
              />
            </label>
          </div>
        )}

        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-1 text-xs">
            <span className="text-text-secondary">
              Showing {filteredBookings.length} of {bookings.length} appointments
            </span>
            <button
              type="button"
              onClick={clearAllFilters}
              className="font-semibold text-primary hover:underline cursor-pointer"
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>

      {/* =====================================================================
          LOADING / ERROR STATES
      ===================================================================== */}
      {apiError && bookings.length === 0 && (
        <div className="bg-surface rounded-xl border border-red-200 p-8 text-center space-y-3">
          <AppIcon name="error_outline" className="text-[32px] text-red-600" />
          <h3 className="text-base font-bold text-text-primary">
            We couldn&apos;t load your bookings.
          </h3>
          <p className="text-xs text-text-secondary max-w-md mx-auto">{apiError}</p>
          {onRetryLoad && (
            <Button type="button" variant="outline" size="sm" onClick={onRetryLoad}>
              Retry
            </Button>
          )}
        </div>
      )}

      {isLoading && bookings.length === 0 && (
        <div className="bg-surface rounded-xl border border-border/70 p-6 space-y-4 animate-pulse">
          <div className="h-5 w-48 bg-surface-container rounded" />
          <div className="h-14 w-full bg-surface-container-low rounded-lg" />
          <div className="h-14 w-full bg-surface-container-low rounded-lg" />
          <div className="h-14 w-full bg-surface-container-low rounded-lg" />
        </div>
      )}

      {/* =====================================================================
          ROW 4A: LIST VIEW (DEFAULT)
      ===================================================================== */}
      {!isLoading &&
        viewMode === 'list' &&
        (bookings.length === 0 ? (
          <div className="bg-surface rounded-xl p-12 border border-border/70 text-center space-y-4 shadow-xs">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-primary flex items-center justify-center mx-auto">
              <AppIcon name="calendar_month" className="text-[30px]" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-text-primary">No appointments yet.</h3>
              <p className="text-sm text-text-secondary max-w-md mx-auto">
                Once customers start booking through your page, WhatsApp, or web chat, their
                appointments will appear here.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2.5 flex-wrap pt-2">
              <Button type="button" variant="outline" size="sm" onClick={onCopyBookingLink}>
                <AppIcon name="content_copy" className="text-[15px]" />
                <span>{copiedSlug ? 'Link Copied!' : 'Copy Booking Link'}</span>
              </Button>
              <Link
                href={`/b/${workspace.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="h-8 px-3 rounded-lg border border-border bg-surface hover:bg-surface-container-low text-xs font-medium text-text-primary inline-flex items-center gap-1.5"
              >
                <span>View Booking Page</span>
                <AppIcon name="open_in_new" className="text-[14px]" />
              </Link>
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={() => {
                  setManualStep(1);
                  setManualModalOpen(true);
                }}
              >
                <AppIcon name="add" className="text-[15px]" />
                <span>New Booking</span>
              </Button>
            </div>
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="bg-surface rounded-xl p-10 border border-border/70 text-center space-y-3 shadow-xs">
            <AppIcon name="filter_alt_off" className="text-[32px] text-text-secondary" />
            <h3 className="text-base font-bold text-text-primary">
              No bookings match your filters.
            </h3>
            <p className="text-xs text-text-secondary">
              Try adjusting your search query, date range, or status filter.
            </p>
            <Button type="button" variant="outline" size="sm" onClick={clearAllFilters}>
              Clear Filters
            </Button>
          </div>
        ) : (
          <div className="bg-surface rounded-xl border border-border/70 shadow-xs overflow-hidden">
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-surface-container-lowest text-[11px] uppercase tracking-wider text-text-secondary font-semibold">
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Service</th>
                    <th className="py-3 px-4">Staff</th>
                    <th className="py-3 px-4">Appointment</th>
                    <th className="py-3 px-4">Booking Status</th>
                    <th className="py-3 px-4">Payment</th>
                    <th className="py-3 px-4">Source</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 text-xs">
                  {paginatedBookings.map((bk) => {
                    const bMeta = getBookingStatusMeta(bk.status);
                    const pMeta = getPaymentStatusMeta(bk.paymentStatus);
                    const linkedConv = findLinkedConversation(bk);

                    return (
                      <tr
                        key={bk.id}
                        className="hover:bg-surface-container-lowest/80 transition-colors group"
                      >
                        <td className="py-3.5 px-4">
                          <button
                            type="button"
                            onClick={() => setSelectedBookingId(bk.id)}
                            className="text-left cursor-pointer hover:text-primary"
                          >
                            <div className="font-semibold text-text-primary group-hover:text-primary">
                              {bk.customerName}
                            </div>
                            <div className="text-[11px] font-mono text-text-secondary">
                              {formatPhoneForRole(bk.customerPhone, userRole)}
                            </div>
                            <div className="text-[10px] font-mono text-text-secondary/80 mt-0.5">
                              {bk.reference}
                            </div>
                          </button>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-text-primary">{bk.serviceName}</div>
                          <div className="text-[11px] text-text-secondary">
                            {bk.durationMin ?? 30} min • {formatNairaFromKobo(bk.priceKobo)}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-medium text-text-primary">
                          {bk.staffName}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-text-primary">{bk.slotTime}</div>
                          {bk.status === 'held' && (
                            <div className="mt-1.5 max-w-[200px]">
                              <HoldBand
                                compact
                                status="held"
                                remainingSeconds={bk.holdSecondsRemaining ?? 900}
                                totalSeconds={900}
                                autoTick
                              />
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${bMeta.badgeClass}`}
                          >
                            <AppIcon name={bMeta.icon} className="text-[13px]" />
                            {bMeta.label}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-text-primary">
                            {bk.depositKobo > 0 ? formatNairaFromKobo(bk.depositKobo) : '₦0'}
                          </div>
                          <div
                            className={`inline-flex items-center gap-1 text-[11px] font-medium mt-0.5 ${pMeta.textClass}`}
                          >
                            <AppIcon name={pMeta.icon} className="text-[13px]" />
                            {pMeta.label}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-text-secondary font-medium">
                          {formatSourceLabel(bk.source)}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedBookingId(bk.id)}
                              className="px-2.5 py-1 rounded-md border border-border bg-surface hover:bg-surface-container-low text-[11px] font-semibold text-text-primary cursor-pointer"
                            >
                              View
                            </button>
                            {linkedConv && (
                              <button
                                type="button"
                                onClick={() => onNavigateSection('conversations')}
                                className="px-2 py-1 rounded-md border border-border bg-surface hover:bg-surface-container-low text-[11px] text-primary cursor-pointer"
                                title="Open Conversation"
                              >
                                <AppIcon name="chat" className="text-[14px]" />
                              </button>
                            )}
                            {(bk.status === 'held' ||
                              bk.paymentStatus === 'pending_verification') && (
                              <button
                                type="button"
                                onClick={() => void handleCheckPaymentStatus(bk)}
                                disabled={checkingPaymentId === bk.id}
                                className="px-2 py-1 rounded-md border border-border bg-surface hover:bg-surface-container-low text-[11px] font-medium text-text-primary cursor-pointer disabled:opacity-50"
                                title="Check Payment Status"
                              >
                                {checkingPaymentId === bk.id ? 'Checking...' : 'Check Pay'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Cards */}
            <div className="lg:hidden divide-y divide-border/60">
              {paginatedBookings.map((bk) => {
                const bMeta = getBookingStatusMeta(bk.status);
                const pMeta = getPaymentStatusMeta(bk.paymentStatus);

                return (
                  <button
                    type="button"
                    key={bk.id}
                    onClick={() => setSelectedBookingId(bk.id)}
                    className="w-full text-left p-4 space-y-2.5 cursor-pointer hover:bg-surface-container-lowest block"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-sm text-text-primary">{bk.customerName}</div>
                        <div className="text-xs text-text-secondary">
                          {bk.serviceName} • {bk.staffName}
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold shrink-0 ${bMeta.badgeClass}`}
                      >
                        <AppIcon name={bMeta.icon} className="text-[12px]" />
                        {bMeta.label}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-text-secondary">
                      <span>{bk.slotTime}</span>
                      <span
                        className={`font-medium inline-flex items-center gap-1 ${pMeta.textClass}`}
                      >
                        <AppIcon name={pMeta.icon} className="text-[13px]" />
                        {formatNairaFromKobo(bk.depositKobo)} ({pMeta.label})
                      </span>
                    </div>

                    {bk.status === 'held' && (
                      <HoldBand
                        compact
                        status="held"
                        remainingSeconds={bk.holdSecondsRemaining ?? 900}
                        totalSeconds={900}
                        autoTick
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Pagination Footer */}
            <div className="px-4 py-3 border-t border-border/60 bg-surface-container-lowest flex items-center justify-between text-xs text-text-secondary">
              <span>
                Showing {(safePage - 1) * pageSize + 1}–
                {Math.min(safePage * pageSize, filteredBookings.length)} of{' '}
                {filteredBookings.length}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="h-7 px-2.5 text-xs"
                >
                  Previous
                </Button>
                <span className="font-medium text-text-primary">
                  Page {safePage} of {totalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={safePage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="h-7 px-2.5 text-xs"
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        ))}

      {/* =====================================================================
          ROW 4B: CALENDAR VIEW (DAY & WEEK)
      ===================================================================== */}
      {!isLoading && viewMode === 'calendar' && (
        <div className="bg-surface rounded-xl border border-border/70 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const next = new Date(calendarDate);
                  next.setDate(next.getDate() - (calendarMode === 'day' ? 1 : 7));
                  setCalendarDate(next);
                }}
                className="h-8 px-2"
                aria-label="Previous date"
              >
                <AppIcon name="chevron_left" className="text-[18px]" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCalendarDate(new Date())}
                className="h-8 text-xs"
              >
                Today
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const next = new Date(calendarDate);
                  next.setDate(next.getDate() + (calendarMode === 'day' ? 1 : 7));
                  setCalendarDate(next);
                }}
                className="h-8 px-2"
                aria-label="Next date"
              >
                <AppIcon name="chevron_right" className="text-[18px]" />
              </Button>
              <span className="font-semibold text-sm text-text-primary ml-2">
                {new Intl.DateTimeFormat('en-NG', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  timeZone: getTzName(workspace.timezone),
                }).format(calendarDate)}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                aria-label="Filter calendar by staff"
                value={calendarStaffFilter}
                onChange={(e) => setCalendarStaffFilter(e.target.value)}
                className="h-8 px-2.5 rounded-lg border border-border bg-surface text-xs text-text-primary"
              >
                <option value="all">All Staff</option>
                {workspace.staff.map((stf) => (
                  <option key={stf.id || stf.name} value={stf.name}>
                    {stf.name}
                  </option>
                ))}
              </select>

              <div className="inline-flex p-0.5 rounded-lg bg-surface-container-low border border-border/50">
                <button
                  type="button"
                  onClick={() => setCalendarMode('day')}
                  className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer ${
                    calendarMode === 'day'
                      ? 'bg-surface text-primary shadow-2xs'
                      : 'text-text-secondary'
                  }`}
                >
                  Day
                </button>
                <button
                  type="button"
                  onClick={() => setCalendarMode('week')}
                  className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer ${
                    calendarMode === 'week'
                      ? 'bg-surface text-primary shadow-2xs'
                      : 'text-text-secondary'
                  }`}
                >
                  Week
                </button>
              </div>
            </div>
          </div>

          {calendarMode === 'day' ? (
            <div className="divide-y divide-border/50">
              {DAILY_HOURS.map((hour) => {
                const slotBookings = filteredBookings.filter((bk) => {
                  if (calendarStaffFilter !== 'all' && bk.staffName !== calendarStaffFilter) {
                    return false;
                  }
                  const bkDateKey = getLocalDateKey(getBookingDateObj(bk), workspace.timezone);
                  return (
                    bkDateKey === activeDateKey && getBookingHour(bk, workspace.timezone) === hour
                  );
                });

                return (
                  <div key={hour} className="flex min-h-[64px]">
                    <div className="w-24 shrink-0 py-3 px-4 border-r border-border/50 text-xs font-mono text-text-secondary bg-surface-container-lowest">
                      {formatHourLabel(hour)}
                    </div>
                    <div className="flex-1 p-2 flex flex-wrap gap-2 items-start">
                      {slotBookings.length === 0 ? (
                        <span className="text-[11px] text-text-secondary/60 py-1 px-2">
                          Open slot
                        </span>
                      ) : (
                        slotBookings.map((bk) => {
                          const bMeta = getBookingStatusMeta(bk.status);
                          return (
                            <button
                              key={bk.id}
                              type="button"
                              onClick={() => setSelectedBookingId(bk.id)}
                              className={`text-left px-3 py-2 rounded-lg border text-xs transition-shadow hover:shadow-sm cursor-pointer min-w-[210px] ${
                                bk.status === 'confirmed'
                                  ? 'bg-indigo-50/70 border-primary/40'
                                  : bk.status === 'held'
                                    ? 'bg-amber-50 border-amber-300'
                                    : 'bg-slate-50 border-slate-200'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-bold text-text-primary">
                                  {bk.customerName}
                                </span>
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${bMeta.badgeClass}`}
                                >
                                  {bMeta.label}
                                </span>
                              </div>
                              <div className="text-[11px] text-text-secondary mt-0.5">
                                {bk.serviceName} • {bk.staffName}
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-7 divide-y md:divide-y-0 md:divide-x divide-border/60">
              {weekDays.map((dayObj) => {
                const dayKey = getLocalDateKey(dayObj, workspace.timezone);
                const isToday = dayKey === getLocalDateKey(new Date(), workspace.timezone);
                const dayBookings = filteredBookings.filter((bk) => {
                  if (calendarStaffFilter !== 'all' && bk.staffName !== calendarStaffFilter) {
                    return false;
                  }
                  return getLocalDateKey(getBookingDateObj(bk), workspace.timezone) === dayKey;
                });

                return (
                  <div key={dayKey} className="min-h-[220px] flex flex-col">
                    <div
                      className={`px-3 py-2 border-b border-border/50 text-xs font-semibold flex items-center justify-between ${
                        isToday
                          ? 'bg-indigo-50 text-primary'
                          : 'bg-surface-container-lowest text-text-primary'
                      }`}
                    >
                      <span>
                        {new Intl.DateTimeFormat('en-NG', {
                          weekday: 'short',
                          day: 'numeric',
                        }).format(dayObj)}
                      </span>
                      <span className="text-[11px] text-text-secondary">{dayBookings.length}</span>
                    </div>
                    <div className="p-2 space-y-1.5 flex-1">
                      {dayBookings.length === 0 ? (
                        <p className="text-[11px] text-text-secondary/60 text-center py-6">
                          No bookings
                        </p>
                      ) : (
                        dayBookings.map((bk) => {
                          const bMeta = getBookingStatusMeta(bk.status);
                          return (
                            <button
                              key={bk.id}
                              type="button"
                              onClick={() => setSelectedBookingId(bk.id)}
                              className={`w-full text-left p-2 rounded-lg border text-[11px] cursor-pointer ${
                                bk.status === 'confirmed'
                                  ? 'bg-indigo-50/70 border-primary/30'
                                  : bk.status === 'held'
                                    ? 'bg-amber-50 border-amber-300'
                                    : 'bg-slate-50 border-slate-200'
                              }`}
                            >
                              <div className="font-bold text-text-primary truncate">
                                {formatHourLabel(getBookingHour(bk, workspace.timezone))} •{' '}
                                {bk.customerName}
                              </div>
                              <div className="text-text-secondary truncate">{bk.serviceName}</div>
                              <div className="mt-1">
                                <span
                                  className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${bMeta.badgeClass}`}
                                >
                                  {bMeta.label}
                                </span>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          ROW 4C: STAFF SCHEDULE VIEW
      ===================================================================== */}
      {!isLoading && viewMode === 'staff_schedule' && (
        <div className="bg-surface rounded-xl border border-border/70 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-border/60 flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="font-semibold text-sm text-text-primary">
                Staff Daily Capacity •{' '}
                {new Intl.DateTimeFormat('en-NG', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'short',
                }).format(calendarDate)}
              </h3>
              <p className="text-xs text-text-secondary">
                Compare confirmed bookings, active holds, and open slots across your team.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const prev = new Date(calendarDate);
                  prev.setDate(prev.getDate() - 1);
                  setCalendarDate(prev);
                }}
                className="h-8 px-2"
              >
                <AppIcon name="chevron_left" className="text-[18px]" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCalendarDate(new Date())}
                className="h-8 text-xs"
              >
                Today
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const next = new Date(calendarDate);
                  next.setDate(next.getDate() + 1);
                  setCalendarDate(next);
                }}
                className="h-8 px-2"
              >
                <AppIcon name="chevron_right" className="text-[18px]" />
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-surface-container-lowest">
                  <th className="py-3 px-4 text-left font-semibold text-text-secondary w-24">
                    Time
                  </th>
                  {workspace.staff.map((stf) => (
                    <th
                      key={stf.id || stf.name}
                      className="py-3 px-4 text-left font-semibold text-text-primary min-w-[180px]"
                    >
                      <div>{stf.name}</div>
                      <div className="text-[11px] font-normal text-text-secondary">
                        {stf.role || 'Staff Provider'}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {DAILY_HOURS.map((hour) => (
                  <tr key={hour}>
                    <td className="py-2.5 px-4 font-mono text-text-secondary bg-surface-container-lowest border-r border-border/50">
                      {formatHourLabel(hour)}
                    </td>
                    {workspace.staff.map((stf) => {
                      const match = filteredBookings.find(
                        (bk) =>
                          bk.staffName === stf.name &&
                          (bk.status === 'held' || bk.status === 'confirmed') &&
                          getLocalDateKey(getBookingDateObj(bk), workspace.timezone) ===
                            activeDateKey &&
                          getBookingHour(bk, workspace.timezone) === hour,
                      );

                      if (!match) {
                        return (
                          <td key={stf.id || stf.name} className="p-2 border-r border-border/30">
                            <button
                              type="button"
                              onClick={() => {
                                const idx = workspace.staff.findIndex((s) => s.name === stf.name);
                                setManualForm((prev) => ({
                                  ...prev,
                                  staffIndex: Math.max(0, idx),
                                  dateKey: activeDateKey,
                                  hourSlot: hour,
                                }));
                                setManualStep(1);
                                setManualModalOpen(true);
                              }}
                              className="w-full py-2 px-2.5 rounded-lg border border-dashed border-border/60 text-[11px] text-text-secondary/70 hover:border-primary/40 hover:text-primary transition-colors text-left cursor-pointer"
                            >
                              Available • + Book
                            </button>
                          </td>
                        );
                      }

                      const bMeta = getBookingStatusMeta(match.status);
                      return (
                        <td key={stf.id || stf.name} className="p-2 border-r border-border/30">
                          <button
                            type="button"
                            onClick={() => setSelectedBookingId(match.id)}
                            className={`w-full p-2 rounded-lg border text-left cursor-pointer ${
                              match.status === 'confirmed'
                                ? 'bg-indigo-50 border-primary/40'
                                : 'bg-amber-50 border-amber-300'
                            }`}
                          >
                            <div className="font-bold text-text-primary truncate">
                              {match.customerName}
                            </div>
                            <div className="text-[11px] text-text-secondary truncate">
                              {match.serviceName}
                            </div>
                            <span
                              className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${bMeta.badgeClass}`}
                            >
                              {bMeta.label}
                            </span>
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          RIGHT-SIDE BOOKING DETAILS DRAWER (FULL-SCREEN ON MOBILE)
      ===================================================================== */}
      {selectedBooking && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex justify-end">
          <div className="w-full md:max-w-lg bg-surface h-full shadow-2xl border-l border-border flex flex-col">
            {/* Drawer Header */}
            <div className="px-6 py-4 border-b border-border flex items-start justify-between gap-3 bg-surface-container-lowest">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs text-text-secondary">
                    {selectedBooking.reference}
                  </span>
                  {(() => {
                    const meta = getBookingStatusMeta(selectedBooking.status);
                    return (
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${meta.badgeClass}`}
                      >
                        <AppIcon name={meta.icon} className="text-[13px]" />
                        {meta.label}
                      </span>
                    );
                  })()}
                </div>
                <h2 className="text-lg font-bold text-text-primary mt-1">
                  {selectedBooking.customerName}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedBookingId(null);
                  setPaymentCheckMessage(null);
                }}
                className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-container cursor-pointer"
                aria-label="Close booking details"
              >
                <AppIcon name="close" className="text-[20px]" />
              </button>
            </div>

            {/* Drawer Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Section A — Appointment Information */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                  Appointment Information
                </h3>
                <div className="grid grid-cols-2 gap-3 text-xs bg-surface-container-lowest p-4 rounded-xl border border-border/60">
                  <div>
                    <span className="text-text-secondary block">Service</span>
                    <span className="font-semibold text-text-primary">
                      {selectedBooking.serviceName}
                    </span>
                  </div>
                  <div>
                    <span className="text-text-secondary block">Staff Member</span>
                    <span className="font-semibold text-text-primary">
                      {selectedBooking.staffName}
                    </span>
                  </div>
                  <div>
                    <span className="text-text-secondary block">Scheduled Time</span>
                    <span className="font-semibold text-text-primary">
                      {selectedBooking.slotTime}
                    </span>
                  </div>
                  <div>
                    <span className="text-text-secondary block">Duration &amp; Price</span>
                    <span className="font-semibold text-text-primary">
                      {selectedBooking.durationMin ?? 30} min •{' '}
                      {formatNairaFromKobo(selectedBooking.priceKobo)}
                    </span>
                  </div>
                  <div>
                    <span className="text-text-secondary block">Timezone</span>
                    <span className="font-medium text-text-primary">{workspace.timezone}</span>
                  </div>
                  <div>
                    <span className="text-text-secondary block">Source</span>
                    <span className="font-medium text-text-primary">
                      {formatSourceLabel(selectedBooking.source)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Section B — Customer Information */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                  Customer Information
                </h3>
                <div className="bg-surface-container-lowest p-4 rounded-xl border border-border/60 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-text-primary text-sm">
                        {selectedBooking.customerName}
                      </div>
                      <div className="font-mono text-text-secondary">
                        {formatPhoneForRole(selectedBooking.customerPhone, userRole)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onNavigateSection('customers')}
                        className="text-primary font-semibold hover:underline cursor-pointer"
                      >
                        Profile →
                      </button>
                      {findLinkedConversation(selectedBooking) && (
                        <button
                          type="button"
                          onClick={() => onNavigateSection('conversations')}
                          className="px-2.5 py-1 rounded-md bg-indigo-50 text-primary font-semibold hover:bg-indigo-100 cursor-pointer"
                        >
                          Open Chat
                        </button>
                      )}
                    </div>
                  </div>
                  {selectedBooking.customerNotes && (
                    <div className="pt-2 border-t border-border/50 text-text-secondary">
                      <strong>Notes:</strong> {selectedBooking.customerNotes}
                    </div>
                  )}
                </div>
              </div>

              {/* Section C — Deposit & Payment */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                  Deposit and Payment
                </h3>
                <div className="bg-surface-container-lowest p-4 rounded-xl border border-border/60 space-y-3 text-xs">
                  {selectedBooking.status === 'held' && (
                    <div className="space-y-1.5">
                      <HoldBand
                        status="held"
                        remainingSeconds={selectedBooking.holdSecondsRemaining ?? 900}
                        totalSeconds={900}
                        autoTick
                        reference={selectedBooking.reference}
                      />
                      <p className="text-[11px] text-text-secondary">
                        Waiting for the customer&apos;s deposit. This slot will be released if
                        payment is not completed in time.
                      </p>
                    </div>
                  )}

                  {selectedBooking.paymentStatus === 'pending_verification' && (
                    <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs">
                      <strong>Payment verification is taking longer than expected.</strong>{' '}
                      Switchboard will continue checking rather than declaring failure.
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-text-secondary block">Deposit Required</span>
                      <span className="font-semibold text-text-primary">
                        {selectedBooking.depositKobo > 0 ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div>
                      <span className="text-text-secondary block">Payment Status</span>
                      {(() => {
                        const pMeta = getPaymentStatusMeta(selectedBooking.paymentStatus);
                        return (
                          <span
                            className={`inline-flex items-center gap-1 font-semibold ${pMeta.textClass}`}
                          >
                            <AppIcon name={pMeta.icon} className="text-[14px]" />
                            {pMeta.label}
                          </span>
                        );
                      })()}
                    </div>
                    <div>
                      <span className="text-text-secondary block">Amount Expected</span>
                      <span className="font-semibold text-text-primary">
                        {formatNairaFromKobo(selectedBooking.depositKobo)}
                      </span>
                    </div>
                    <div>
                      <span className="text-text-secondary block">Amount Verified</span>
                      <span className="font-semibold text-emerald-700">
                        {selectedBooking.paymentStatus === 'verified'
                          ? formatNairaFromKobo(
                              selectedBooking.verifiedAmountKobo ?? selectedBooking.depositKobo,
                            )
                          : formatNairaFromKobo(selectedBooking.verifiedAmountKobo ?? 0)}
                      </span>
                    </div>
                  </div>

                  {selectedBooking.verifiedAt && (
                    <div className="text-[11px] text-text-secondary pt-1 border-t border-border/50">
                      Verified at: {new Date(selectedBooking.verifiedAt).toLocaleString()}
                    </div>
                  )}

                  {paymentCheckMessage?.bookingId === selectedBooking.id && (
                    <div
                      className={`p-3 rounded-lg text-xs border ${
                        paymentCheckMessage.tone === 'success'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : paymentCheckMessage.tone === 'issue'
                            ? 'bg-amber-50 border-amber-200 text-amber-900'
                            : 'bg-indigo-50 border-indigo-200 text-indigo-900'
                      }`}
                    >
                      {paymentCheckMessage.text}
                    </div>
                  )}
                </div>
              </div>

              {/* Section D — Booking History */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                  Booking History
                </h3>
                <div className="space-y-2.5 text-xs border-l-2 border-border pl-4 ml-1.5">
                  <div>
                    <div className="font-semibold text-text-primary">Booking created</div>
                    <div className="text-text-secondary">
                      {new Date(selectedBooking.createdAt).toLocaleString()} • Via{' '}
                      {formatSourceLabel(selectedBooking.source)}
                    </div>
                  </div>
                  {selectedBooking.depositKobo > 0 && (
                    <div>
                      <div className="font-semibold text-text-primary">
                        Slot temporarily held &amp; deposit requested
                      </div>
                      <div className="text-text-secondary">
                        Expected {formatNairaFromKobo(selectedBooking.depositKobo)} (Ref:{' '}
                        {selectedBooking.reference})
                      </div>
                    </div>
                  )}
                  {selectedBooking.paymentStatus === 'verified' && (
                    <div>
                      <div className="font-semibold text-emerald-700">
                        Payment verified &amp; appointment confirmed
                      </div>
                      <div className="text-text-secondary">
                        {selectedBooking.verifiedAt
                          ? new Date(selectedBooking.verifiedAt).toLocaleString()
                          : 'Confirmed by Kora'}
                      </div>
                    </div>
                  )}
                  {selectedBooking.status === 'expired' && (
                    <div>
                      <div className="font-semibold text-slate-700">Reservation expired</div>
                      <div className="text-text-secondary">
                        Hold window elapsed before deposit verification.
                      </div>
                    </div>
                  )}
                  {selectedBooking.status === 'cancelled' && (
                    <div>
                      <div className="font-semibold text-red-700">Appointment cancelled</div>
                      <div className="text-text-secondary">
                        {selectedBooking.cancelReason || 'Cancelled'}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Section E — Available Actions Footer */}
            <div className="px-6 py-4 border-t border-border bg-surface-container-lowest flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                {(selectedBooking.status === 'held' ||
                  selectedBooking.paymentStatus === 'pending_verification') && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={checkingPaymentId === selectedBooking.id}
                    onClick={() => void handleCheckPaymentStatus(selectedBooking)}
                    className="h-8 text-xs"
                  >
                    <AppIcon name="sync" className="text-[14px]" />
                    <span>
                      {checkingPaymentId === selectedBooking.id
                        ? 'Checking...'
                        : 'Check Payment Status'}
                    </span>
                  </Button>
                )}

                {(selectedBooking.status === 'held' || selectedBooking.status === 'confirmed') && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setRescheduleTarget(selectedBooking);
                      setRescheduleStaff(selectedBooking.staffName);
                      setRescheduleDateKey(
                        getLocalDateKey(getBookingDateObj(selectedBooking), workspace.timezone),
                      );
                      setRescheduleHour(getBookingHour(selectedBooking, workspace.timezone));
                    }}
                    className="h-8 text-xs"
                  >
                    <AppIcon name="event_repeat" className="text-[14px]" />
                    <span>Reschedule</span>
                  </Button>
                )}
              </div>

              {(selectedBooking.status === 'held' || selectedBooking.status === 'confirmed') && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCancelTarget(selectedBooking)}
                  className="h-8 text-xs text-red-600 border-red-200 hover:bg-red-50"
                >
                  <AppIcon name="cancel" className="text-[14px]" />
                  <span>Cancel Booking</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          GUIDED 5-STEP MANUAL BOOKING MODAL
      ===================================================================== */}
      {manualModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-surface rounded-2xl border border-border shadow-2xl p-6 space-y-5">
            <div className="flex items-start justify-between border-b border-border/50 pb-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                  Step {manualStep} of 5 • New Booking
                </span>
                <h3 className="text-lg font-bold text-text-primary mt-0.5">
                  {manualStep === 1 && 'Customer Details'}
                  {manualStep === 2 && 'Select Service & Staff'}
                  {manualStep === 3 && 'Choose Available Time'}
                  {manualStep === 4 && 'Booking & Deposit Policy'}
                  {manualStep === 5 && 'Review & Create Booking'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setManualModalOpen(false)}
                className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary cursor-pointer"
                aria-label="Close new booking modal"
              >
                <AppIcon name="close" className="text-[20px]" />
              </button>
            </div>

            {/* Step 1: Customer */}
            {manualStep === 1 && (
              <div className="space-y-4 text-xs">
                {knownCustomers.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="font-semibold text-text-primary block">
                      Select existing customer (optional)
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {knownCustomers.slice(0, 5).map((cust) => (
                        <button
                          key={cust.phone}
                          type="button"
                          onClick={() =>
                            setManualForm((prev) => ({
                              ...prev,
                              customerMode: 'existing',
                              customerName: cust.name,
                              customerPhone: cust.phone,
                            }))
                          }
                          className={`px-2.5 py-1 rounded-full border text-xs cursor-pointer ${
                            manualForm.customerPhone === cust.phone
                              ? 'border-primary bg-indigo-50 text-primary font-semibold'
                              : 'border-border bg-surface-container-low text-text-primary'
                          }`}
                        >
                          {cust.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label htmlFor="mb-name" className="font-semibold text-text-primary block">
                    Customer Name
                  </label>
                  <input
                    id="mb-name"
                    type="text"
                    required
                    value={manualForm.customerName}
                    onChange={(e) =>
                      setManualForm((prev) => ({ ...prev, customerName: e.target.value }))
                    }
                    placeholder="e.g. Chinedu Eze"
                    className="w-full h-9 px-3 rounded-lg border border-border bg-surface text-sm text-text-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="mb-phone" className="font-semibold text-text-primary block">
                    Phone Number (E.164)
                  </label>
                  <input
                    id="mb-phone"
                    type="tel"
                    required
                    value={manualForm.customerPhone}
                    onChange={(e) =>
                      setManualForm((prev) => ({ ...prev, customerPhone: e.target.value }))
                    }
                    placeholder="+234 803 123 4567"
                    className="w-full h-9 px-3 rounded-lg border border-border bg-surface text-sm text-text-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="mb-notes" className="font-semibold text-text-primary block">
                    Customer Notes (optional)
                  </label>
                  <input
                    id="mb-notes"
                    type="text"
                    value={manualForm.customerNotes}
                    onChange={(e) =>
                      setManualForm((prev) => ({ ...prev, customerNotes: e.target.value }))
                    }
                    placeholder="Preferred clipper guard or style notes"
                    className="w-full h-9 px-3 rounded-lg border border-border bg-surface text-sm text-text-primary"
                  />
                </div>
              </div>
            )}

            {/* Step 2: Service & Staff */}
            {manualStep === 2 && (
              <div className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label htmlFor="mb-service" className="font-semibold text-text-primary block">
                    Service
                  </label>
                  <select
                    id="mb-service"
                    value={manualForm.serviceIndex}
                    onChange={(e) =>
                      setManualForm((prev) => ({ ...prev, serviceIndex: Number(e.target.value) }))
                    }
                    className="w-full h-10 px-3 rounded-lg border border-border bg-surface text-sm text-text-primary"
                  >
                    {workspace.services.map((svc, idx) => (
                      <option key={svc.id || svc.name} value={idx}>
                        {svc.name} — {svc.duration} min • ₦{svc.price.toLocaleString()}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="mb-staff" className="font-semibold text-text-primary block">
                    Assigned Staff Member
                  </label>
                  <select
                    id="mb-staff"
                    value={manualForm.staffIndex}
                    onChange={(e) =>
                      setManualForm((prev) => ({ ...prev, staffIndex: Number(e.target.value) }))
                    }
                    className="w-full h-10 px-3 rounded-lg border border-border bg-surface text-sm text-text-primary"
                  >
                    {workspace.staff.map((stf, idx) => (
                      <option key={stf.id || stf.name} value={idx}>
                        {stf.name} ({stf.role || 'Staff'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Step 3: Appointment Time (checks staff availability!) */}
            {manualStep === 3 && (
              <div className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label htmlFor="mb-date" className="font-semibold text-text-primary block">
                    Appointment Date
                  </label>
                  <input
                    id="mb-date"
                    type="date"
                    value={manualForm.dateKey}
                    onChange={(e) =>
                      setManualForm((prev) => ({ ...prev, dateKey: e.target.value }))
                    }
                    className="w-full h-9 px-3 rounded-lg border border-border bg-surface text-sm text-text-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <span className="font-semibold text-text-primary block">
                    Available Times for {selectedStaffForManual.name}
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {DAILY_HOURS.map((hour) => {
                      const occupied = isSlotOccupied(
                        selectedStaffForManual.name,
                        manualForm.dateKey,
                        hour,
                      );
                      const isSelected = manualForm.hourSlot === hour;
                      return (
                        <button
                          key={hour}
                          type="button"
                          disabled={occupied}
                          onClick={() => setManualForm((prev) => ({ ...prev, hourSlot: hour }))}
                          className={`py-2 px-2 rounded-lg border text-xs font-medium transition-colors ${
                            occupied
                              ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed line-through'
                              : isSelected
                                ? 'bg-primary text-white border-primary cursor-pointer'
                                : 'bg-surface border-border text-text-primary hover:border-primary/50 cursor-pointer'
                          }`}
                        >
                          {formatHourLabel(hour)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Booking Policy */}
            {manualStep === 4 && (
              <div className="space-y-3 text-xs bg-surface-container-lowest p-4 rounded-xl border border-border/60">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Service Price</span>
                  <span className="font-bold text-text-primary">
                    ₦{selectedServiceForManual.price.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Required Deposit</span>
                  <span className="font-bold text-text-primary">
                    {workspace.depositRequired
                      ? `₦${workspace.depositAmount.toLocaleString()}`
                      : 'None'}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-border/50">
                  <span className="text-text-secondary">Resulting Booking Status</span>
                  <span className="font-semibold text-amber-700">
                    {workspace.depositRequired
                      ? 'Held (Awaiting Deposit — 15m)'
                      : 'Confirmed (No deposit required)'}
                  </span>
                </div>
                {workspace.depositRequired && (
                  <p className="text-[11px] text-text-secondary pt-1">
                    Because this business requires a deposit, the slot will be held for 15 minutes
                    and confirmed only after Kora payment verification.
                  </p>
                )}
              </div>
            )}

            {/* Step 5: Review */}
            {manualStep === 5 && (
              <div className="space-y-2.5 text-xs bg-surface-container-lowest p-4 rounded-xl border border-border/60">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Customer</span>
                  <span className="font-semibold text-text-primary">
                    {manualForm.customerName} ({manualForm.customerPhone})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Service</span>
                  <span className="font-semibold text-text-primary">
                    {selectedServiceForManual.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Staff</span>
                  <span className="font-semibold text-text-primary">
                    {selectedStaffForManual.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">When</span>
                  <span className="font-semibold text-text-primary">
                    {manualForm.dateKey} at {formatHourLabel(manualForm.hourSlot)}
                  </span>
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-border/50 flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  manualStep > 1
                    ? setManualStep((s) => (s - 1) as 1 | 2 | 3 | 4 | 5)
                    : setManualModalOpen(false)
                }
              >
                {manualStep > 1 ? 'Back' : 'Cancel'}
              </Button>

              {manualStep < 5 ? (
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  disabled={
                    (manualStep === 1 && !manualForm.customerName.trim()) ||
                    (manualStep === 3 &&
                      isSlotOccupied(
                        selectedStaffForManual.name,
                        manualForm.dateKey,
                        manualForm.hourSlot,
                      ))
                  }
                  onClick={() => setManualStep((s) => (s + 1) as 1 | 2 | 3 | 4 | 5)}
                >
                  Continue
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={handleCompleteManualBooking}
                >
                  Create Booking
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          CANCELLATION DIALOG
      ===================================================================== */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-surface rounded-2xl border border-border shadow-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-text-primary">Cancel this appointment?</h3>
            <div className="p-3.5 rounded-xl bg-surface-container-lowest border border-border/60 text-xs space-y-1">
              <div className="font-semibold text-text-primary">{cancelTarget.customerName}</div>
              <div className="text-text-secondary">
                {cancelTarget.serviceName} • {cancelTarget.slotTime}
              </div>
              <div className="text-text-secondary">
                Deposit:{' '}
                {cancelTarget.paymentStatus === 'verified'
                  ? `${formatNairaFromKobo(cancelTarget.depositKobo)} Verified`
                  : 'Not yet paid'}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
              {cancelTarget.paymentStatus === 'verified' ? (
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={initiateRefundOnCancel}
                    onChange={(e) => setInitiateRefundOnCancel(e.target.checked)}
                    className="mt-0.5 accent-primary"
                  />
                  <span>
                    Initiate Kora refund review ({workspace.freeCancelHours ?? 4}h free-cancel
                    window). Refund will enter <strong>Refund Pending</strong> until Kora confirms.
                  </span>
                </label>
              ) : (
                <span>No refund is required because no verified deposit was collected.</span>
              )}
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="cancel-reason"
                className="text-xs font-semibold text-text-primary block"
              >
                Cancellation reason (optional)
              </label>
              <input
                id="cancel-reason"
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Customer requested cancellation"
                className="w-full h-9 px-3 rounded-lg border border-border bg-surface text-xs text-text-primary"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setCancelTarget(null)}>
                Keep Appointment
              </Button>
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={handleConfirmCancel}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Cancel Appointment
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SAFE RESCHEDULE MODAL
      ===================================================================== */}
      {rescheduleTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-surface rounded-2xl border border-border shadow-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-text-primary">Reschedule Appointment</h3>
            <p className="text-xs text-text-secondary">
              Moving <strong>{rescheduleTarget.customerName}</strong> (
              {rescheduleTarget.serviceName}
              ). Existing deposit status is preserved.
            </p>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label htmlFor="resch-staff" className="font-semibold text-text-primary block">
                  Staff Member
                </label>
                <select
                  id="resch-staff"
                  value={rescheduleStaff}
                  onChange={(e) => setRescheduleStaff(e.target.value)}
                  className="w-full h-9 px-2.5 rounded-lg border border-border bg-surface text-text-primary"
                >
                  {workspace.staff.map((stf) => (
                    <option key={stf.id || stf.name} value={stf.name}>
                      {stf.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label htmlFor="resch-date" className="font-semibold text-text-primary block">
                  New Date
                </label>
                <input
                  id="resch-date"
                  type="date"
                  value={rescheduleDateKey}
                  onChange={(e) => setRescheduleDateKey(e.target.value)}
                  className="w-full h-9 px-2.5 rounded-lg border border-border bg-surface text-text-primary"
                />
              </div>

              <div className="space-y-1">
                <span className="font-semibold text-text-primary block">Available Time Slots</span>
                <div className="grid grid-cols-3 gap-1.5">
                  {DAILY_HOURS.map((hour) => {
                    const occupied = isSlotOccupied(
                      rescheduleStaff,
                      rescheduleDateKey,
                      hour,
                      rescheduleTarget.id,
                    );
                    return (
                      <button
                        key={hour}
                        type="button"
                        disabled={occupied}
                        onClick={() => setRescheduleHour(hour)}
                        className={`py-1.5 px-2 rounded border text-xs ${
                          occupied
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed line-through'
                            : rescheduleHour === hour
                              ? 'bg-primary text-white border-primary cursor-pointer'
                              : 'bg-surface border-border text-text-primary cursor-pointer'
                        }`}
                      >
                        {formatHourLabel(hour)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setRescheduleTarget(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="default"
                size="sm"
                disabled={isSlotOccupied(
                  rescheduleStaff,
                  rescheduleDateKey,
                  rescheduleHour,
                  rescheduleTarget.id,
                )}
                onClick={handleConfirmReschedule}
              >
                Confirm Reschedule
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
