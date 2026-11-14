'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppIcon } from '@/components/AppIcon';
import { Button } from '@/components/ui/button';
import type {
  CustomerBookingSummary,
  CustomerDirectoryRecord,
  CustomerSource,
} from '@/lib/customers-server';
import { useDashboard } from '../DashboardContext';
import { CustomerProfileView } from './CustomerProfileView';

type CustomerTypeFilter = 'all' | 'new' | 'returning';
type BookingActivityFilter =
  | 'all'
  | 'has_upcoming'
  | 'no_upcoming'
  | 'has_confirmed'
  | 'no_confirmed';
type SourceFilter = 'all' | CustomerSource;
type DateRangeFilter = 'week' | 'month' | '30d' | 'all' | 'custom';
type SortOption = 'recent_activity' | 'newest' | 'name_asc' | 'most_bookings';

const PAGE_SIZE = 10;

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function formatDateInTimezone(iso: string | null, timezone = 'Africa/Lagos'): string {
  if (!iso) return '—';
  try {
    const tz = timezone.includes('/') ? timezone.split(' ')[0] : 'Africa/Lagos';
    return new Intl.DateTimeFormat('en-NG', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: tz,
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

function normalizePhoneSearch(input: string): string {
  return input.replace(/[\s\-()]/g, '').toLowerCase();
}

function formatSourceLabel(source: CustomerSource): string {
  switch (source) {
    case 'whatsapp':
      return 'WhatsApp';
    case 'web_chat':
      return 'Web Chat';
    case 'booking_page':
      return 'Booking Page';
    case 'staff':
      return 'Manual';
    case 'unknown':
      return 'Unknown';
  }
}

export function CustomersManagementView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const {
    workspace,
    apiState,
    bookings,
    conversations,
    copyBookingLink,
    copiedSlug,
    setActiveNav,
    setNewBookingModalOpen,
  } = useDashboard();

  const [customers, setCustomers] = useState<CustomerDirectoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [canPersistToDb, setCanPersistToDb] = useState(false);

  // Filters synced to URL search params
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') ?? '');
  const [typeFilter, setTypeFilter] = useState<CustomerTypeFilter>(
    () => (searchParams.get('type') as CustomerTypeFilter) || 'all',
  );
  const [activityFilter, setActivityFilter] = useState<BookingActivityFilter>(
    () => (searchParams.get('activity') as BookingActivityFilter) || 'all',
  );
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>(
    () => (searchParams.get('source') as SourceFilter) || 'all',
  );
  const [dateRange, setDateRange] = useState<DateRangeFilter>(
    () => (searchParams.get('range') as DateRangeFilter) || '30d',
  );
  const [customStart, setCustomStart] = useState(() => searchParams.get('from') ?? '');
  const [customEnd, setCustomEnd] = useState(() => searchParams.get('to') ?? '');
  const [sortBy, setSortBy] = useState<SortOption>(
    () => (searchParams.get('sort') as SortOption) || 'recent_activity',
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
    () => searchParams.get('customer') ?? null,
  );

  // Add Customer modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    name: '',
    phone: '',
    preferredChannel: '' as '' | 'whatsapp' | 'web_chat' | 'phone',
    notes: '',
  });
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [duplicateCustomer, setDuplicateCustomer] = useState<{ id: string; name: string } | null>(
    null,
  );

  // Sync filters to URL without remounting layout
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set('q', searchQuery.trim());
    if (typeFilter !== 'all') params.set('type', typeFilter);
    if (activityFilter !== 'all') params.set('activity', activityFilter);
    if (sourceFilter !== 'all') params.set('source', sourceFilter);
    if (dateRange !== '30d') params.set('range', dateRange);
    if (dateRange === 'custom' && customStart) params.set('from', customStart);
    if (dateRange === 'custom' && customEnd) params.set('to', customEnd);
    if (sortBy !== 'recent_activity') params.set('sort', sortBy);
    if (selectedCustomerId) params.set('customer', selectedCustomerId);

    const nextQs = params.toString();
    const targetUrl = nextQs ? `${pathname}?${nextQs}` : pathname;
    router.replace(targetUrl, { scroll: false });
  }, [
    searchQuery,
    typeFilter,
    activityFilter,
    sourceFilter,
    dateRange,
    customStart,
    customEnd,
    sortBy,
    selectedCustomerId,
    pathname,
    router,
  ]);

  const deriveLocalFallbackCustomers = useCallback((): CustomerDirectoryRecord[] => {
    const map = new Map<string, CustomerDirectoryRecord>();
    const normalizeLocalPhone = (raw: string) => {
      const digits = raw.replace(/[^\d]/g, '');
      if (digits.startsWith('234') && digits.length === 13) return `+${digits}`;
      if (digits.startsWith('0') && digits.length === 11) return `+234${digits.slice(1)}`;
      return raw.trim();
    };

    for (const bk of bookings) {
      const phone = normalizeLocalPhone(bk.customerPhone);
      if (!phone) continue;
      const existing = map.get(phone);
      const startsIso = bk.createdAt || new Date().toISOString();
      const mappedStatus: CustomerBookingSummary['status'] =
        bk.status === 'confirmed' || bk.status === 'completed' || bk.status === 'held'
          ? bk.status
          : bk.status === 'expired'
            ? ('expired' as const)
            : bk.status === 'cancelled'
              ? ('cancelled' as const)
              : ('no_show' as const);

      const bkSummary = {
        id: bk.id,
        reference: bk.reference,
        serviceName: bk.serviceName,
        staffName: bk.staffName,
        startsAt: startsIso,
        endsAt: startsIso,
        status: mappedStatus,
        holdExpiresAt: null,
        source: bk.source,
        depositKobo: bk.depositKobo,
        paymentStatus:
          bk.paymentStatus === 'verified'
            ? ('verified' as const)
            : bk.paymentStatus === 'pending_verification'
              ? ('pending_verification' as const)
              : bk.paymentStatus === 'not_required'
                ? ('not_required' as const)
                : ('awaiting_payment' as const),
        createdAt: startsIso,
      };

      if (!existing) {
        map.set(phone, {
          id: `local_${phone}`,
          reference: `cus_${phone.slice(-4)}`,
          name: bk.customerName,
          phoneE164: phone,
          preferredChannel: bk.source === 'whatsapp' ? 'whatsapp' : null,
          preferredLanguage: null,
          notes: null,
          source: bk.source,
          createdAt: startsIso,
          updatedAt: startsIso,
          lastActivityAt: startsIso,
          confirmedBookingsCount: bk.status === 'confirmed' || bk.status === 'completed' ? 1 : 0,
          lastBookingAt: bk.status === 'confirmed' || bk.status === 'completed' ? startsIso : null,
          nextUpcomingBooking: null,
          verifiedDepositKobo: bk.paymentStatus === 'verified' ? bk.depositKobo : 0,
          pendingVerificationKobo: bk.paymentStatus === 'pending_verification' ? bk.depositKobo : 0,
          latestPaymentAt: bk.paymentStatus === 'verified' ? startsIso : null,
          refundStatus: null,
          hasOpenAttention: bk.paymentStatus === 'pending_verification',
          bookings: [bkSummary],
          conversations: [],
          activities: [
            {
              id: `act_${bk.id}`,
              timestamp: startsIso,
              label: bk.status === 'confirmed' ? 'Booking confirmed' : 'Appointment slot held',
              detail: `${bk.serviceName} with ${bk.staffName}`,
              kind: 'booking',
            },
          ],
        });
      } else {
        existing.bookings.push(bkSummary);
        if (bk.status === 'confirmed' || bk.status === 'completed') {
          existing.confirmedBookingsCount += 1;
          existing.lastBookingAt = startsIso;
        }
        if (bk.paymentStatus === 'verified') {
          existing.verifiedDepositKobo += bk.depositKobo;
        }
      }
    }

    for (const cv of conversations) {
      // Do not treat anonymous web visitors without a phone as verified phone identities
      const phone = normalizeLocalPhone(cv.customerPhone);
      if (!phone || phone.endsWith('0000000')) continue;
      const existing = map.get(phone);
      const cvSummary = {
        id: cv.id,
        channel: cv.channel,
        status:
          cv.status === 'needs_human'
            ? ('needs_human' as const)
            : cv.status === 'resolved'
              ? ('closed' as const)
              : ('agent' as const),
        lastMessageAt: null,
        lastMessagePreview: cv.lastMessage,
        createdAt: new Date().toISOString(),
      };
      if (existing) {
        existing.conversations.push(cvSummary);
        if (cv.status === 'needs_human') existing.hasOpenAttention = true;
      }
    }

    return Array.from(map.values());
  }, [bookings, conversations]);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setAuthNotice(null);

    try {
      const url = workspace.slug
        ? `/api/customers?slug=${encodeURIComponent(workspace.slug)}`
        : '/api/customers';
      const res = await fetch(url);

      if (res.status === 401) {
        setCanPersistToDb(false);
        setAuthNotice('Sign in to sync and edit persisted Postgres customer profiles.');
        setCustomers(deriveLocalFallbackCustomers());
        return;
      }

      const data = (await res.json()) as {
        ok: boolean;
        customers?: CustomerDirectoryRecord[];
        error?: string;
      };

      if (!res.ok || !data.ok || !Array.isArray(data.customers)) {
        setLoadError(data.error || "We couldn't load your customers.");
        return;
      }

      setCanPersistToDb(true);
      setCustomers(data.customers);
    } catch {
      setLoadError("We couldn't load your customers.");
    } finally {
      setLoading(false);
    }
  }, [deriveLocalFallbackCustomers, workspace.slug]);

  useEffect(() => {
    void fetchCustomers();
  }, [fetchCustomers]);

  // Date range bounds in ms
  const dateBounds = useMemo(() => {
    const now = new Date();
    if (dateRange === 'all') return { startMs: null, endMs: null };
    if (dateRange === 'week') {
      const start = new Date(now.getTime() - 7 * 86_400_000);
      return { startMs: start.getTime(), endMs: now.getTime() };
    }
    if (dateRange === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { startMs: start.getTime(), endMs: now.getTime() };
    }
    if (dateRange === '30d') {
      const start = new Date(now.getTime() - 30 * 86_400_000);
      return { startMs: start.getTime(), endMs: now.getTime() };
    }
    const startMs = customStart ? new Date(`${customStart}T00:00:00`).getTime() : null;
    const endMs = customEnd ? new Date(`${customEnd}T23:59:59`).getTime() : null;
    return {
      startMs: startMs && !Number.isNaN(startMs) ? startMs : null,
      endMs: endMs && !Number.isNaN(endMs) ? endMs : null,
    };
  }, [dateRange, customStart, customEnd]);

  // 4 Customer Summary Metrics (scoped, distinct, persisted)
  const summaryMetrics = useMemo(() => {
    const totalCustomers = customers.length;
    const newCustomers = customers.filter((c) => {
      const createdMs = new Date(c.createdAt).getTime();
      if (dateBounds.startMs !== null && createdMs < dateBounds.startMs) return false;
      if (dateBounds.endMs !== null && createdMs > dateBounds.endMs) return false;
      return true;
    }).length;
    const returningCustomers = customers.filter((c) => c.confirmedBookingsCount >= 2).length;
    const customersWithUpcoming = customers.filter((c) => c.nextUpcomingBooking !== null).length;

    return {
      totalCustomers,
      newCustomers,
      returningCustomers,
      customersWithUpcoming,
    };
  }, [customers, dateBounds]);

  // Filtered & sorted directory
  const filteredCustomers = useMemo(() => {
    const qRaw = searchQuery.trim().toLowerCase();
    const qPhone = normalizePhoneSearch(searchQuery);

    const list = customers.filter((c) => {
      if (qRaw) {
        const matchName = c.name.toLowerCase().includes(qRaw);
        const matchRef = c.reference.toLowerCase().includes(qRaw);
        const matchPhone = qPhone.length > 0 && normalizePhoneSearch(c.phoneE164).includes(qPhone);
        if (!matchName && !matchRef && !matchPhone) return false;
      }

      if (typeFilter === 'new' && c.confirmedBookingsCount >= 2) return false;
      if (typeFilter === 'returning' && c.confirmedBookingsCount < 2) return false;

      if (activityFilter === 'has_upcoming' && !c.nextUpcomingBooking) return false;
      if (activityFilter === 'no_upcoming' && c.nextUpcomingBooking) return false;
      if (activityFilter === 'has_confirmed' && c.confirmedBookingsCount === 0) return false;
      if (activityFilter === 'no_confirmed' && c.confirmedBookingsCount > 0) return false;

      if (sourceFilter !== 'all' && c.source !== sourceFilter) return false;

      if (dateRange !== 'all') {
        const refTimeMs = new Date(c.lastActivityAt).getTime();
        if (dateBounds.startMs !== null && refTimeMs < dateBounds.startMs) return false;
        if (dateBounds.endMs !== null && refTimeMs > dateBounds.endMs) return false;
      }

      return true;
    });

    list.sort((a, b) => {
      if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
      if (sortBy === 'most_bookings') return b.confirmedBookingsCount - a.confirmedBookingsCount;
      if (sortBy === 'newest') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime();
    });

    return list;
  }, [
    customers,
    searchQuery,
    typeFilter,
    activityFilter,
    sourceFilter,
    dateRange,
    dateBounds,
    sortBy,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedCustomers = useMemo(
    () => filteredCustomers.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filteredCustomers, safePage],
  );

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId) ?? null,
    [customers, selectedCustomerId],
  );

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    typeFilter !== 'all' ||
    activityFilter !== 'all' ||
    sourceFilter !== 'all' ||
    dateRange !== '30d' ||
    sortBy !== 'recent_activity';

  const clearFilters = () => {
    setSearchQuery('');
    setTypeFilter('all');
    setActivityFilter('all');
    setSourceFilter('all');
    setDateRange('30d');
    setCustomStart('');
    setCustomEnd('');
    setSortBy('recent_activity');
    setCurrentPage(1);
  };

  const handleAddCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    setDuplicateCustomer(null);

    if (!canPersistToDb) {
      setAddError('Sign in to your business account to save new customers to Postgres.');
      return;
    }

    setAddingCustomer(true);
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: workspace.slug,
          name: addForm.name.trim(),
          phone: addForm.phone.trim(),
          preferredChannel: addForm.preferredChannel || null,
          notes: addForm.notes.trim() || null,
        }),
      });

      const data = (await res.json()) as {
        ok: boolean;
        customer?: CustomerDirectoryRecord;
        code?: string;
        error?: string;
        existingCustomer?: { id: string; name: string };
      };

      if (res.status === 409 && data.existingCustomer) {
        setDuplicateCustomer(data.existingCustomer);
        setAddError(
          data.error || 'A customer with this phone number already exists in your business.',
        );
        return;
      }

      if (!res.ok || !data.ok || !data.customer) {
        setAddError(data.error || 'Could not create customer profile.');
        return;
      }

      const created = data.customer;
      setCustomers((prev) => [created, ...prev]);
      setAddModalOpen(false);
      setAddForm({ name: '', phone: '', preferredChannel: '', notes: '' });
      setSelectedCustomerId(created.id);
    } catch {
      setAddError('Network error while saving customer.');
    } finally {
      setAddingCustomer(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl font-bold text-text-primary tracking-tight">Customers</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-surface border border-border text-xs font-mono font-semibold text-text-secondary">
              {workspace.businessName} • {summaryMetrics.totalCustomers}{' '}
              {summaryMetrics.totalCustomers === 1 ? 'customer' : 'customers'}
            </span>
          </div>
          <p className="text-sm text-text-secondary mt-1">
            View your customers, their appointments, and conversations in one place.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => searchInputRef.current?.focus()}
          >
            <AppIcon name="search" className="text-[16px]" />
            <span>Search Customers</span>
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={() => {
              setAddError(null);
              setDuplicateCustomer(null);
              setAddModalOpen(true);
            }}
          >
            <AppIcon name="person_add" className="text-[16px]" />
            <span>+ Add Customer</span>
          </Button>
        </div>
      </div>

      {authNotice && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-3 text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <AppIcon name="info" className="text-[18px] text-amber-700" />
            <span>{authNotice}</span>
          </div>
          <Link href="/auth/signin" className="font-semibold text-primary hover:underline shrink-0">
            Sign in
          </Link>
        </div>
      )}

      {loadError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between gap-3 text-sm text-rose-900">
          <div className="flex items-center gap-2.5">
            <AppIcon name="error_outline" className="text-[20px] text-rose-700" />
            <span>{loadError}</span>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void fetchCustomers()}>
            Retry
          </Button>
        </div>
      )}

      {/* 4 Compact Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-border p-4 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-secondary">Total Customers</span>
            <AppIcon name="group" className="text-[18px] text-primary" />
          </div>
          <div className="text-2xl font-mono font-bold text-text-primary">
            {loading ? '—' : summaryMetrics.totalCustomers}
          </div>
          <p className="text-xs text-text-secondary">Customers recorded in your business.</p>
        </div>

        <div className="bg-white rounded-xl border border-border p-4 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-secondary">New Customers</span>
            <AppIcon name="person_add" className="text-[18px] text-primary" />
          </div>
          <div className="text-2xl font-mono font-bold text-text-primary">
            {loading ? '—' : summaryMetrics.newCustomers}
          </div>
          <p className="text-xs text-text-secondary">Customers added during the selected period.</p>
        </div>

        <div className="bg-white rounded-xl border border-border p-4 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-secondary">Returning Customers</span>
            <AppIcon name="repeat" className="text-[18px] text-success-strong" />
          </div>
          <div className="text-2xl font-mono font-bold text-text-primary">
            {loading ? '—' : summaryMetrics.returningCustomers}
          </div>
          <p className="text-xs text-text-secondary">Customers who have booked more than once.</p>
        </div>

        <div className="bg-white rounded-xl border border-border p-4 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-secondary">Upcoming Appointments</span>
            <AppIcon name="event_available" className="text-[18px] text-primary" />
          </div>
          <div className="text-2xl font-mono font-bold text-text-primary">
            {loading ? '—' : summaryMetrics.customersWithUpcoming}
          </div>
          <p className="text-xs text-text-secondary">
            Customers with confirmed appointments coming up.
          </p>
        </div>
      </div>

      {/* Main Directory Card */}
      <section className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-border space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-text-primary">All Customers</h2>
              <p className="text-xs text-text-secondary">
                Find customers and view their booking history.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-xs font-semibold text-primary hover:underline cursor-pointer"
                >
                  Clear Filters
                </button>
              )}
              <button
                type="button"
                onClick={() => setMobileFiltersOpen((prev) => !prev)}
                className="lg:hidden px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-text-primary flex items-center gap-1.5"
              >
                <AppIcon name="tune" className="text-[15px]" />
                <span>Filters</span>
              </button>
            </div>
          </div>

          {/* Search & Filters Toolbar */}
          <div className="space-y-3">
            <div className="flex flex-col lg:flex-row gap-2.5">
              <div className="relative flex-1">
                <AppIcon
                  name="search"
                  className="text-[18px] text-text-secondary absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                />
                <input
                  ref={searchInputRef}
                  type="search"
                  aria-label="Search customers by name, phone number, or reference"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Search by customer name, phone (+234...), or reference..."
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-surface text-sm text-text-primary outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div
                className={`${
                  mobileFiltersOpen ? 'grid' : 'hidden'
                } lg:flex grid-cols-1 sm:grid-cols-2 flex-wrap gap-2`}
              >
                <select
                  aria-label="Filter by customer type"
                  value={typeFilter}
                  onChange={(e) => {
                    setTypeFilter(e.target.value as CustomerTypeFilter);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-2 rounded-lg border border-border bg-surface text-xs font-medium text-text-primary outline-none cursor-pointer"
                >
                  <option value="all">All Customers</option>
                  <option value="new">New Customers</option>
                  <option value="returning">Returning Customers</option>
                </select>

                <select
                  aria-label="Filter by booking activity"
                  value={activityFilter}
                  onChange={(e) => {
                    setActivityFilter(e.target.value as BookingActivityFilter);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-2 rounded-lg border border-border bg-surface text-xs font-medium text-text-primary outline-none cursor-pointer"
                >
                  <option value="all">All Booking Activity</option>
                  <option value="has_upcoming">Has Upcoming Booking</option>
                  <option value="no_upcoming">No Upcoming Booking</option>
                  <option value="has_confirmed">Has Confirmed Bookings</option>
                  <option value="no_confirmed">No Confirmed Bookings</option>
                </select>

                <select
                  aria-label="Filter by acquisition source"
                  value={sourceFilter}
                  onChange={(e) => {
                    setSourceFilter(e.target.value as SourceFilter);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-2 rounded-lg border border-border bg-surface text-xs font-medium text-text-primary outline-none cursor-pointer"
                >
                  <option value="all">All Sources</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="web_chat">Web Chat</option>
                  <option value="booking_page">Public Booking Page</option>
                  <option value="staff">Manual</option>
                  <option value="unknown">Unknown</option>
                </select>

                <select
                  aria-label="Filter by date range"
                  value={dateRange}
                  onChange={(e) => {
                    setDateRange(e.target.value as DateRangeFilter);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-2 rounded-lg border border-border bg-surface text-xs font-medium text-text-primary outline-none cursor-pointer"
                >
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="30d">Last 30 Days</option>
                  <option value="all">All Time</option>
                  <option value="custom">Custom Range</option>
                </select>

                <select
                  aria-label="Sort customers"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="px-3 py-2 rounded-lg border border-border bg-surface text-xs font-medium text-text-primary outline-none cursor-pointer"
                >
                  <option value="recent_activity">Most Recently Active</option>
                  <option value="newest">Newest Customer</option>
                  <option value="name_asc">Name A–Z</option>
                  <option value="most_bookings">Most Confirmed Bookings</option>
                </select>
              </div>
            </div>

            {dateRange === 'custom' && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <label htmlFor="cust-from-date" className="text-text-secondary">
                  From
                </label>
                <input
                  id="cust-from-date"
                  type="date"
                  value={customStart}
                  onChange={(e) => {
                    setCustomStart(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-2.5 py-1.5 rounded-lg border border-border bg-surface text-xs"
                />
                <label htmlFor="cust-to-date" className="text-text-secondary">
                  To
                </label>
                <input
                  id="cust-to-date"
                  type="date"
                  value={customEnd}
                  onChange={(e) => {
                    setCustomEnd(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-2.5 py-1.5 rounded-lg border border-border bg-surface text-xs"
                />
              </div>
            )}
          </div>
        </div>

        {/* Loading Skeleton */}
        {loading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-14 rounded-lg bg-surface-container-low animate-pulse" />
            ))}
          </div>
        ) : customers.length === 0 ? (
          /* Empty State: No Customers Yet */
          <div className="p-10 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-surface-container-low text-primary mx-auto flex items-center justify-center">
              <AppIcon name="group" className="text-[24px]" />
            </div>
            <h3 className="text-base font-bold text-text-primary">
              Your customers will appear here.
            </h3>
            <p className="text-xs text-text-secondary max-w-md mx-auto">
              When someone books an appointment or contacts your business through a supported
              channel, their customer profile can appear here.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={copyBookingLink}>
                <AppIcon name="link" className="text-[15px]" />
                <span>{copiedSlug ? 'Copied!' : 'Copy Booking Link'}</span>
              </Button>
              <Link
                href={`/b/${workspace.slug}`}
                className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-text-primary hover:bg-surface-container-low"
              >
                View Booking Page
              </Link>
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={() => setAddModalOpen(true)}
              >
                + Add Customer
              </Button>
            </div>
          </div>
        ) : filteredCustomers.length === 0 ? (
          /* Empty State: No Search Results */
          <div className="p-10 text-center space-y-3">
            <AppIcon name="search_off" className="text-[30px] text-text-secondary" />
            <h3 className="text-base font-bold text-text-primary">
              No customers match your search.
            </h3>
            <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
              Clear Filters
            </Button>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-surface-container-low/60 text-[11px] font-mono uppercase tracking-wider text-text-secondary">
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Phone Number</th>
                    <th className="py-3 px-4">Last Booking</th>
                    <th className="py-3 px-4">Total Bookings</th>
                    <th className="py-3 px-4">Upcoming Booking</th>
                    <th className="py-3 px-4">Source</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-sm">
                  {paginatedCustomers.map((cust) => {
                    const isReturning = cust.confirmedBookingsCount >= 2;
                    return (
                      <tr
                        key={cust.id}
                        className="hover:bg-surface-container-low/40 transition-colors"
                      >
                        <td className="py-3.5 px-4">
                          <button
                            type="button"
                            onClick={() => setSelectedCustomerId(cust.id)}
                            className="flex items-center gap-3 text-left cursor-pointer group"
                          >
                            <div className="w-9 h-9 rounded-full bg-primary-container/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                              {getInitials(cust.name)}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-text-primary group-hover:text-primary truncate">
                                  {cust.name}
                                </span>
                                {isReturning && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-primary">
                                    Returning
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] font-mono text-text-secondary">
                                {cust.reference}
                              </span>
                            </div>
                          </button>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs text-text-primary">
                          {cust.phoneE164}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-text-secondary">
                          {formatDateInTimezone(cust.lastBookingAt, workspace.timezone)}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs font-semibold text-text-primary">
                          {cust.confirmedBookingsCount}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-text-primary">
                          {cust.nextUpcomingBooking
                            ? formatDateInTimezone(
                                cust.nextUpcomingBooking.startsAt,
                                workspace.timezone,
                              )
                            : '—'}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-text-secondary">
                          {formatSourceLabel(cust.source)}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedCustomerId(cust.id)}
                          >
                            View Profile
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Cards */}
            <div className="md:hidden divide-y divide-border">
              {paginatedCustomers.map((cust) => (
                <div key={cust.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-primary-container/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                        {getInitials(cust.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-text-primary truncate">
                          {cust.name}
                        </p>
                        <p className="text-xs font-mono text-text-secondary">{cust.phoneE164}</p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedCustomerId(cust.id)}
                    >
                      View Profile
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-text-secondary">
                    <div>
                      Confirmed bookings:{' '}
                      <span className="font-mono font-semibold text-text-primary">
                        {cust.confirmedBookingsCount}
                      </span>
                    </div>
                    <div>
                      Next:{' '}
                      <span className="font-medium text-text-primary">
                        {cust.nextUpcomingBooking
                          ? formatDateInTimezone(
                              cust.nextUpcomingBooking.startsAt,
                              workspace.timezone,
                            )
                          : 'None'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Footer */}
            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-border flex items-center justify-between text-xs text-text-secondary">
                <span>
                  Showing {(safePage - 1) * PAGE_SIZE + 1}–
                  {Math.min(safePage * PAGE_SIZE, filteredCustomers.length)} of{' '}
                  {filteredCustomers.length}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={safePage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={safePage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* Customer Details Drawer (Right side on desktop, full-screen on mobile) */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex justify-end">
          <div className="w-full lg:max-w-2xl h-full bg-surface shadow-2xl overflow-hidden flex flex-col">
            <CustomerProfileView
              customer={selectedCustomer}
              timezone={workspace.timezone}
              userRole={apiState.role}
              canPersistEdits={canPersistToDb}
              onClose={() => setSelectedCustomerId(null)}
              onCustomerUpdated={(updated) =>
                setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
              }
              onOpenExistingProfile={(existingId) => setSelectedCustomerId(existingId)}
              onCreateBooking={() => setNewBookingModalOpen(true)}
              onNavigateSection={(sec) => {
                setSelectedCustomerId(null);
                setActiveNav(sec);
              }}
              dedicatedRouteHref={`/dashboard/customers/${selectedCustomer.id}`}
            />
          </div>
        </div>
      )}

      {/* Add New Customer Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl border border-border shadow-2xl p-6 space-y-4">
            <div className="flex items-start justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-lg font-bold text-text-primary">Add New Customer</h3>
                <p className="text-xs text-text-secondary">
                  Create a customer profile for your business.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                className="p-1 text-text-secondary hover:text-text-primary cursor-pointer"
                aria-label="Close modal"
              >
                <AppIcon name="close" className="text-[20px]" />
              </button>
            </div>

            {addError && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2">
                <p className="font-semibold">{addError}</p>
                {duplicateCustomer && (
                  <button
                    type="button"
                    onClick={() => {
                      setAddModalOpen(false);
                      setSelectedCustomerId(duplicateCustomer.id);
                    }}
                    className="px-2.5 py-1 rounded bg-white border border-amber-300 font-semibold text-primary hover:underline cursor-pointer"
                  >
                    Open existing profile ({duplicateCustomer.name})
                  </button>
                )}
              </div>
            )}

            <form onSubmit={handleAddCustomerSubmit} className="space-y-3.5">
              <div>
                <label
                  htmlFor="add-cust-name"
                  className="block text-xs font-semibold text-text-primary mb-1"
                >
                  Full Name
                </label>
                <input
                  id="add-cust-name"
                  type="text"
                  required
                  placeholder="e.g. Chinedu Eze"
                  value={addForm.name}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-border text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label
                  htmlFor="add-cust-phone"
                  className="block text-xs font-semibold text-text-primary mb-1"
                >
                  Phone Number
                </label>
                <input
                  id="add-cust-phone"
                  type="tel"
                  required
                  placeholder="e.g. +234 803 123 4567"
                  value={addForm.phone}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, phone: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-border text-sm font-mono outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label
                  htmlFor="add-cust-channel"
                  className="block text-xs font-semibold text-text-primary mb-1"
                >
                  Preferred Contact Channel (optional)
                </label>
                <select
                  id="add-cust-channel"
                  value={addForm.preferredChannel}
                  onChange={(e) =>
                    setAddForm((prev) => ({
                      ...prev,
                      preferredChannel: e.target.value as '' | 'whatsapp' | 'web_chat' | 'phone',
                    }))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-white outline-none"
                >
                  <option value="">Not specified</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="web_chat">Web Chat</option>
                  <option value="phone">Phone Contact</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="add-cust-notes"
                  className="block text-xs font-semibold text-text-primary mb-1"
                >
                  Notes (optional)
                </label>
                <textarea
                  id="add-cust-notes"
                  rows={2}
                  placeholder="e.g. Customer prefers afternoon appointments."
                  value={addForm.notes}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-border text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-border">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setAddModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="default" size="sm" disabled={addingCustomer}>
                  {addingCustomer ? 'Saving...' : 'Save Customer'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
