'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  ServiceCatalogItem,
  ServiceDisplayStatus,
  StaffDirectoryItem,
} from '@/app/api/services-staff/route';
import { AppIcon } from '@/components/AppIcon';
import { Button } from '@/components/ui/button';
import { useDashboard } from '../DashboardContext';

interface ServicesStaffApiResponse {
  ok: boolean;
  role: 'owner' | 'staff';
  business: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
    selfProvided: boolean;
    depositRequired: boolean;
    defaultDepositKobo: number;
  };
  services: ServiceCatalogItem[];
  staff: StaffDirectoryItem[];
  summary: {
    activeServices: number;
    staffMembers: number;
    servicesNeedingSetup: number;
    unavailableStaffToday: number;
  };
  error?: string;
}

type MainTab = 'services' | 'staff';
type ServiceStatusFilter = 'all' | ServiceDisplayStatus;
type ServiceSort = 'name' | 'price' | 'duration' | 'updated';
type StaffFilter = 'all' | 'active' | 'inactive' | 'schedule_ok' | 'schedule_missing';
type StaffSort = 'name' | 'updated';

const SERVICE_CATEGORIES = ['General', 'Haircuts', 'Grooming', 'Styling', 'Treatments'];

function formatNairaFromKobo(kobo: number): string {
  return `₦${Math.round(kobo / 100).toLocaleString('en-NG')}`;
}

function formatDateTime(iso: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-NG', {
      timeZone: timezone || 'Africa/Lagos',
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function getServiceStatusBadge(status: ServiceDisplayStatus): {
  label: string;
  badgeClass: string;
} {
  switch (status) {
    case 'active':
      return {
        label: 'Active',
        badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      };
    case 'needs_setup':
      return {
        label: 'Needs Setup',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
      };
    case 'inactive':
      return {
        label: 'Inactive',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
      };
    case 'archived':
      return {
        label: 'Archived',
        badgeClass: 'bg-slate-100 text-slate-500 border-slate-200',
      };
  }
}

export function ServicesStaffView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { workspace, setActiveNav, refreshWorkspaceData } = useDashboard();

  const [tab, setTab] = useState<MainTab>(() =>
    searchParams.get('tab') === 'staff' ? 'staff' : 'services',
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [data, setData] = useState<ServicesStaffApiResponse | null>(null);

  // Filters & sorting
  const [svcSearch, setSvcSearch] = useState('');
  const [svcStatusFilter, setSvcStatusFilter] = useState<ServiceStatusFilter>('all');
  const [svcSort, setSvcSort] = useState<ServiceSort>('name');
  const [stfSearch, setStfSearch] = useState('');
  const [stfFilter, setStfFilter] = useState<StaffFilter>('all');
  const [stfSort, setStfSort] = useState<StaffSort>('name');

  // Service Drawer state
  const [serviceDrawerOpen, setServiceDrawerOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceCatalogItem | null>(null);
  const [svcName, setSvcName] = useState('');
  const [svcDesc, setSvcDesc] = useState('');
  const [svcCategory, setSvcCategory] = useState('General');
  const [svcDuration, setSvcDuration] = useState('30');
  const [svcPriceNaira, setSvcPriceNaira] = useState('5000');
  const [svcStaffIds, setSvcStaffIds] = useState<string[]>([]);
  const [svcActive, setSvcActive] = useState(true);

  // Staff Drawer state
  const [staffDrawerOpen, setStaffDrawerOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffDirectoryItem | null>(null);
  const [stfName, setStfName] = useState('');
  const [stfTitle, setStfTitle] = useState('');
  const [stfPhone, setStfPhone] = useState('');
  const [stfBio, setStfBio] = useState('');
  const [stfServiceIds, setStfServiceIds] = useState<string[]>([]);
  const [stfActive, setStfActive] = useState(true);

  // Details & Confirmation
  const [viewingStaff, setViewingStaff] = useState<StaffDirectoryItem | null>(null);
  const [confirmAction, setConfirmAction] = useState<
    | { type: 'service_status'; item: ServiceCatalogItem; nextStatus: 'inactive' | 'archived' }
    | { type: 'staff_deactivate'; item: StaffDirectoryItem }
    | null
  >(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === 'staff') params.set('tab', 'staff');
    else params.delete('tab');
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [pathname, router, searchParams, tab]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setAuthNotice(null);

    try {
      const url = workspace.slug
        ? `/api/services-staff?slug=${encodeURIComponent(workspace.slug)}`
        : '/api/services-staff';
      const res = await fetch(url);
      if (res.status === 401) {
        setAuthNotice('Sign in to manage services and staff from your database.');
        setData(null);
        return;
      }
      const json = (await res.json()) as ServicesStaffApiResponse;
      if (!res.ok || !json.ok) {
        setLoadError(json.error || "We couldn't load your services and staff.");
        return;
      }
      setData(json);
    } catch {
      setLoadError("We couldn't load your services and staff.");
    } finally {
      setLoading(false);
    }
  }, [workspace.slug]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const openAddService = () => {
    setEditingService(null);
    setSvcName('');
    setSvcDesc('');
    setSvcCategory('General');
    setSvcDuration('30');
    setSvcPriceNaira('5000');
    setSvcStaffIds([]);
    setSvcActive(true);
    setFormError(null);
    setServiceDrawerOpen(true);
  };

  const openEditService = (svc: ServiceCatalogItem) => {
    setEditingService(svc);
    setSvcName(svc.name);
    setSvcDesc(svc.description);
    setSvcCategory(svc.category || 'General');
    setSvcDuration(String(svc.durationMin));
    setSvcPriceNaira(String(Math.round(svc.priceKobo / 100)));
    setSvcStaffIds(svc.assignedStaffIds);
    setSvcActive(svc.status !== 'inactive' && svc.status !== 'archived');
    setFormError(null);
    setServiceDrawerOpen(true);
  };

  const openAddStaff = () => {
    setEditingStaff(null);
    setStfName('');
    setStfTitle('Barber');
    setStfPhone('');
    setStfBio('');
    setStfServiceIds([]);
    setStfActive(true);
    setFormError(null);
    setStaffDrawerOpen(true);
  };

  const openEditStaff = (st: StaffDirectoryItem) => {
    setEditingStaff(st);
    setStfName(st.name);
    setStfTitle(st.roleTitle);
    setStfPhone(st.phoneE164 && !st.phoneE164.startsWith('•') ? st.phoneE164 : '');
    setStfBio(st.bio);
    setStfServiceIds(st.assignedServiceIds);
    setStfActive(st.active);
    setFormError(null);
    setStaffDrawerOpen(true);
  };

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data) return;
    setSubmitting(true);
    setFormError(null);

    try {
      const res = await fetch('/api/services-staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_service',
          slug: data.business.slug,
          id: editingService?.id,
          name: svcName.trim(),
          description: svcDesc.trim(),
          category: svcCategory,
          durationMin: Number(svcDuration),
          priceKobo: Math.round(Number(svcPriceNaira || 0) * 100),
          assignedStaffIds: svcStaffIds,
          status: svcActive ? 'active' : 'inactive',
        }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setFormError(json.error || 'Could not save service.');
        return;
      }
      setServiceDrawerOpen(false);
      await loadData();
      refreshWorkspaceData();
    } catch {
      setFormError('Network error while saving service.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data) return;
    setSubmitting(true);
    setFormError(null);

    try {
      const res = await fetch('/api/services-staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_staff',
          slug: data.business.slug,
          id: editingStaff?.id,
          name: stfName.trim(),
          roleTitle: stfTitle.trim(),
          phone: stfPhone.trim() || undefined,
          bio: stfBio.trim(),
          assignedServiceIds: stfServiceIds,
          active: stfActive,
        }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setFormError(json.error || 'Could not save staff member.');
        return;
      }
      setStaffDrawerOpen(false);
      await loadData();
      refreshWorkspaceData();
    } catch {
      setFormError('Network error while saving staff member.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetServiceStatus = async (
    serviceId: string,
    status: 'active' | 'inactive' | 'archived',
  ) => {
    if (!data) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch('/api/services-staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_service_status',
          slug: data.business.slug,
          id: serviceId,
          status,
        }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setLoadError(json.error || 'Could not update service status.');
        return;
      }
      setConfirmAction(null);
      await loadData();
      refreshWorkspaceData();
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetStaffActive = async (staffId: string, active: boolean) => {
    if (!data) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/services-staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_staff_active',
          slug: data.business.slug,
          id: staffId,
          active,
        }),
      });
      if (res.ok) {
        setConfirmAction(null);
        setViewingStaff(null);
        await loadData();
        refreshWorkspaceData();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const filteredServices = useMemo(() => {
    if (!data) return [];
    const q = svcSearch.trim().toLowerCase();
    const list = data.services.filter((s) => {
      if (svcStatusFilter !== 'all' && s.status !== svcStatusFilter) return false;
      if (q && !`${s.name} ${s.category} ${s.description}`.toLowerCase().includes(q)) return false;
      return true;
    });
    return [...list].sort((a, b) => {
      if (svcSort === 'price') return a.priceKobo - b.priceKobo;
      if (svcSort === 'duration') return a.durationMin - b.durationMin;
      if (svcSort === 'updated')
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      return a.name.localeCompare(b.name);
    });
  }, [data, svcSearch, svcSort, svcStatusFilter]);

  const filteredStaff = useMemo(() => {
    if (!data) return [];
    const q = stfSearch.trim().toLowerCase();
    const list = data.staff.filter((st) => {
      if (stfFilter === 'active' && !st.active) return false;
      if (stfFilter === 'inactive' && st.active) return false;
      if (stfFilter === 'schedule_ok' && !st.scheduleConfigured) return false;
      if (stfFilter === 'schedule_missing' && st.scheduleConfigured) return false;
      if (q && !`${st.name} ${st.roleTitle}`.toLowerCase().includes(q)) return false;
      return true;
    });
    return [...list].sort((a, b) => {
      if (stfSort === 'updated')
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      return a.name.localeCompare(b.name);
    });
  }, [data, stfFilter, stfSearch, stfSort]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-14 rounded-xl bg-surface-container-low animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-surface-container-low animate-pulse" />
          ))}
        </div>
        <div className="h-64 rounded-xl bg-surface-container-low animate-pulse" />
      </div>
    );
  }

  if (authNotice) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900 flex items-center justify-between gap-4">
        <span>{authNotice}</span>
        <Link href="/auth/signin" className="font-semibold underline shrink-0">
          Sign in
        </Link>
      </div>
    );
  }

  if (loadError || !data) {
    return (
      <div className="rounded-xl border border-border/60 bg-white p-10 text-center space-y-3">
        <AppIcon name="cloud_off" className="text-[32px] text-rose-500 mx-auto" />
        <h2 className="font-headline-sm text-base font-bold text-text-primary">
          We couldn&apos;t load your services and staff.
        </h2>
        <p className="text-xs text-text-secondary">{loadError}</p>
        <Button type="button" size="sm" onClick={() => void loadData()}>
          Retry
        </Button>
      </div>
    );
  }

  const isOwner = data.role === 'owner';
  const timezone = data.business.timezone || 'Africa/Lagos';

  return (
    <div className="flex flex-col w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-4 border-b border-border/50">
        <div className="space-y-1">
          <h1 className="font-headline-md text-2xl font-bold text-text-primary tracking-tight">
            Services &amp; Staff
          </h1>
          <p className="text-sm text-text-secondary">
            Manage your services, prices, and the people who provide them.
          </p>
          <div className="flex items-center gap-3 text-xs text-text-secondary flex-wrap pt-1">
            <span>
              Workspace: <strong className="text-text-primary">{data.business.name}</strong>
            </span>
            <span>•</span>
            <span>Timezone: {timezone}</span>
            <span>•</span>
            <span>{data.summary.activeServices} active services</span>
            <span>•</span>
            <span>{data.summary.staffMembers} active staff</span>
          </div>
        </div>

        <div data-tour="services-staff-actions" className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setActiveNav('working-hours')}
            className="h-9 text-xs"
          >
            <AppIcon name="schedule" className="text-[16px]" />
            <span>View Working Hours</span>
          </Button>
          {isOwner && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={openAddStaff}
                className="h-9 text-xs"
              >
                <AppIcon name="person_add" className="text-[16px]" />
                <span>+ Add Staff Member</span>
              </Button>
              <Button type="button" size="sm" onClick={openAddService} className="h-9 text-xs">
                <AppIcon name="add" className="text-[16px]" />
                <span>+ Add Service</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* 4 Summary Cards */}
      <div
        data-tour="services-staff-summary"
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
      >
        <div className="rounded-xl border border-border/60 bg-white p-4 shadow-xs">
          <span className="text-xs font-semibold text-text-secondary">Active Services</span>
          <p className="font-headline-md text-2xl font-bold text-text-primary mt-1.5">
            {data.summary.activeServices}
          </p>
          <p className="text-xs text-text-secondary mt-1">Services customers can currently book.</p>
        </div>

        <div className="rounded-xl border border-border/60 bg-white p-4 shadow-xs">
          <span className="text-xs font-semibold text-text-secondary">Staff Members</span>
          <p className="font-headline-md text-2xl font-bold text-text-primary mt-1.5">
            {data.summary.staffMembers}
          </p>
          <p className="text-xs text-text-secondary mt-1">
            People configured to provide appointments.
          </p>
        </div>

        <div className="rounded-xl border border-border/60 bg-white p-4 shadow-xs">
          <span className="text-xs font-semibold text-text-secondary">Services Needing Setup</span>
          <p className="font-headline-md text-2xl font-bold text-text-primary mt-1.5">
            {data.summary.servicesNeedingSetup}
          </p>
          <p className="text-xs text-text-secondary mt-1">
            Services missing information required for booking.
          </p>
        </div>

        <div className="rounded-xl border border-border/60 bg-white p-4 shadow-xs">
          <span className="text-xs font-semibold text-text-secondary">Unavailable Staff Today</span>
          <p className="font-headline-md text-2xl font-bold text-text-primary mt-1.5">
            {data.summary.unavailableStaffToday}
          </p>
          <p className="text-xs text-text-secondary mt-1">Staff members off schedule today.</p>
        </div>
      </div>

      {/* 2 Primary Tabs */}
      <div className="flex items-center gap-2 border-b border-border/60 pb-2">
        <button
          type="button"
          onClick={() => setTab('services')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
            tab === 'services'
              ? 'bg-primary text-white'
              : 'text-text-secondary hover:bg-surface-container-low hover:text-text-primary'
          }`}
        >
          Services ({data.services.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('staff')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
            tab === 'staff'
              ? 'bg-primary text-white'
              : 'text-text-secondary hover:bg-surface-container-low hover:text-text-primary'
          }`}
        >
          Staff Members ({data.staff.length})
        </button>
      </div>

      {/* PART A: SERVICES TAB */}
      {tab === 'services' && (
        <div className="rounded-xl border border-border/60 bg-white shadow-xs overflow-hidden">
          <div className="p-5 border-b border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-headline-sm text-base font-bold text-text-primary">
                Your Services
              </h2>
              <p className="text-xs text-text-secondary">
                Create and manage the services customers can book.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="text"
                value={svcSearch}
                onChange={(e) => setSvcSearch(e.target.value)}
                placeholder="Search services..."
                className="h-8 rounded-lg border border-border bg-white px-3 text-xs text-text-primary"
              />
              <select
                aria-label="Filter services by status"
                value={svcStatusFilter}
                onChange={(e) => setSvcStatusFilter(e.target.value as ServiceStatusFilter)}
                className="h-8 rounded-lg border border-border bg-white px-2.5 text-xs text-text-primary"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="needs_setup">Needs Setup</option>
                <option value="inactive">Inactive</option>
                <option value="archived">Archived</option>
              </select>
              <select
                aria-label="Sort services"
                value={svcSort}
                onChange={(e) => setSvcSort(e.target.value as ServiceSort)}
                className="h-8 rounded-lg border border-border bg-white px-2.5 text-xs text-text-primary"
              >
                <option value="name">Sort: Name</option>
                <option value="price">Sort: Price</option>
                <option value="duration">Sort: Duration</option>
                <option value="updated">Sort: Recently Updated</option>
              </select>
            </div>
          </div>

          {data.services.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <AppIcon name="content_cut" className="text-[32px] text-primary mx-auto" />
              <h3 className="font-headline-sm text-base font-bold text-text-primary">
                Add your first service.
              </h3>
              <p className="text-xs text-text-secondary max-w-md mx-auto">
                Tell Switchboard what customers can book with your business.
              </p>
              {isOwner && (
                <Button type="button" size="sm" onClick={openAddService}>
                  Add Service
                </Button>
              )}
            </div>
          ) : filteredServices.length === 0 ? (
            <div className="p-10 text-center space-y-3">
              <h3 className="font-headline-sm text-base font-bold text-text-primary">
                No matching results.
              </h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setSvcSearch('');
                  setSvcStatusFilter('all');
                }}
              >
                Clear Filters
              </Button>
            </div>
          ) : (
            <>
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border/50 bg-surface-container-lowest text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
                      <th className="py-3 px-4">Service</th>
                      <th className="py-3 px-4">Duration</th>
                      <th className="py-3 px-4">Price &amp; Deposit</th>
                      <th className="py-3 px-4">Assigned Staff</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40 text-xs">
                    {filteredServices.map((svc) => {
                      const badge = getServiceStatusBadge(svc.status);
                      return (
                        <tr key={svc.id} className="hover:bg-surface-container-lowest/70">
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-text-primary">{svc.name}</div>
                            {svc.description && (
                              <div className="text-[11px] text-text-secondary line-clamp-1 mt-0.5">
                                {svc.description}
                              </div>
                            )}
                            {svc.missingReasons.length > 0 && (
                              <div className="text-[11px] text-amber-700 mt-1">
                                Missing: {svc.missingReasons.join(', ')}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-text-primary">{svc.durationMin} mins</td>
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-text-primary">
                              {svc.priceKobo === 0 ? 'Free' : formatNairaFromKobo(svc.priceKobo)}
                            </div>
                            <div className="text-[11px] text-text-secondary">
                              {svc.depositKobo > 0
                                ? `Deposit: ${formatNairaFromKobo(svc.depositKobo)}`
                                : 'No deposit'}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-text-primary">
                            {svc.assignedStaffNames.length > 0 ? (
                              <span>{svc.assignedStaffNames.join(', ')}</span>
                            ) : (
                              <span className="text-amber-700 font-medium">Unassigned</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${badge.badgeClass}`}
                            >
                              {badge.label}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                            {isOwner && (
                              <>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openEditService(svc)}
                                  className="h-7 text-xs"
                                >
                                  Edit
                                </Button>
                                {svc.status === 'active' || svc.status === 'needs_setup' ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      setConfirmAction({
                                        type: 'service_status',
                                        item: svc,
                                        nextStatus: 'inactive',
                                      })
                                    }
                                    className="h-7 text-xs text-text-secondary"
                                  >
                                    Disable
                                  </Button>
                                ) : svc.status === 'inactive' ? (
                                  <>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => void handleSetServiceStatus(svc.id, 'active')}
                                      className="h-7 text-xs text-emerald-700"
                                    >
                                      Enable
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        setConfirmAction({
                                          type: 'service_status',
                                          item: svc,
                                          nextStatus: 'archived',
                                        })
                                      }
                                      className="h-7 text-xs text-text-secondary"
                                    >
                                      Archive
                                    </Button>
                                  </>
                                ) : null}
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Service Cards */}
              <div className="lg:hidden divide-y divide-border/50">
                {filteredServices.map((svc) => {
                  const badge = getServiceStatusBadge(svc.status);
                  return (
                    <div key={svc.id} className="p-4 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold text-sm text-text-primary">{svc.name}</div>
                          <div className="text-xs text-text-secondary">
                            {svc.durationMin} mins •{' '}
                            {svc.priceKobo === 0 ? 'Free' : formatNairaFromKobo(svc.priceKobo)}
                          </div>
                        </div>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${badge.badgeClass}`}
                        >
                          {badge.label}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-text-secondary">
                        <span>
                          {svc.assignedStaffNames.length > 0
                            ? `${svc.assignedStaffNames.length} staff assigned`
                            : 'No staff assigned'}
                        </span>
                        {isOwner && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openEditService(svc)}
                            className="h-7 text-xs"
                          >
                            Manage
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* PART B: STAFF TAB */}
      {tab === 'staff' && (
        <div className="rounded-xl border border-border/60 bg-white shadow-xs overflow-hidden">
          <div className="p-5 border-b border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-headline-sm text-base font-bold text-text-primary">Your Staff</h2>
              <p className="text-xs text-text-secondary">
                Manage the people customers can book appointments with.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="text"
                value={stfSearch}
                onChange={(e) => setStfSearch(e.target.value)}
                placeholder="Search staff..."
                className="h-8 rounded-lg border border-border bg-white px-3 text-xs text-text-primary"
              />
              <select
                aria-label="Filter staff"
                value={stfFilter}
                onChange={(e) => setStfFilter(e.target.value as StaffFilter)}
                className="h-8 rounded-lg border border-border bg-white px-2.5 text-xs text-text-primary"
              >
                <option value="all">All Staff</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="schedule_ok">Schedule Configured</option>
                <option value="schedule_missing">Schedule Missing</option>
              </select>
              <select
                aria-label="Sort staff"
                value={stfSort}
                onChange={(e) => setStfSort(e.target.value as StaffSort)}
                className="h-8 rounded-lg border border-border bg-white px-2.5 text-xs text-text-primary"
              >
                <option value="name">Sort: Name</option>
                <option value="updated">Sort: Recently Updated</option>
              </select>
            </div>
          </div>

          {data.staff.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <AppIcon name="badge" className="text-[32px] text-primary mx-auto" />
              <h3 className="font-headline-sm text-base font-bold text-text-primary">
                Add someone customers can book.
              </h3>
              <p className="text-xs text-text-secondary max-w-md mx-auto">
                Create a staff profile so customers can choose an available appointment.
              </p>
              {isOwner && (
                <Button type="button" size="sm" onClick={openAddStaff}>
                  Add Staff Member
                </Button>
              )}
            </div>
          ) : filteredStaff.length === 0 ? (
            <div className="p-10 text-center space-y-3">
              <h3 className="font-headline-sm text-base font-bold text-text-primary">
                No matching results.
              </h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setStfSearch('');
                  setStfFilter('all');
                }}
              >
                Clear Filters
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {filteredStaff.map((st) => (
                <div
                  key={st.id}
                  className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-surface-container-lowest/60"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-text-primary">{st.name}</span>
                      <span className="text-xs text-text-secondary">• {st.roleTitle}</span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                          st.active
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {st.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary">
                      Services:{' '}
                      <span className="text-text-primary">
                        {st.assignedServiceNames.length > 0
                          ? st.assignedServiceNames.join(', ')
                          : 'None assigned'}
                      </span>
                    </p>
                    <p className="text-xs text-text-secondary">
                      Availability:{' '}
                      <span
                        className={st.scheduleConfigured ? 'text-text-primary' : 'text-amber-700'}
                      >
                        {st.scheduleSummary}
                      </span>{' '}
                      • {st.upcomingBookingsCount} upcoming appointments
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setViewingStaff(st)}
                      className="h-8 text-xs"
                    >
                      View Details
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveNav('working-hours')}
                      className="h-8 text-xs"
                    >
                      Working Hours
                    </Button>
                    {isOwner && (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openEditStaff(st)}
                          className="h-8 text-xs"
                        >
                          Edit
                        </Button>
                        {st.active ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmAction({ type: 'staff_deactivate', item: st })}
                            className="h-8 text-xs text-text-secondary"
                          >
                            Deactivate
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleSetStaffActive(st.id, true)}
                            className="h-8 text-xs text-emerald-700"
                          >
                            Activate
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Service Add/Edit Drawer */}
      {serviceDrawerOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-900/40"
          role="dialog"
          aria-modal="true"
          aria-label={editingService ? 'Edit Service' : 'Add a New Service'}
        >
          <form
            onSubmit={handleSaveService}
            className="w-full max-w-lg h-full bg-white border-l border-border/70 shadow-2xl flex flex-col overflow-hidden"
          >
            <div className="p-5 border-b border-border/60 flex items-start justify-between">
              <div>
                <h2 className="font-headline-sm text-lg font-bold text-text-primary">
                  {editingService ? 'Edit Service' : 'Add a New Service'}
                </h2>
                <p className="text-xs text-text-secondary mt-0.5">
                  Tell us what customers can book and how the appointment works.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setServiceDrawerOpen(false)}
              >
                <AppIcon name="close" className="text-[20px]" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {formError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                  {formError}
                </div>
              )}

              <div className="space-y-1.5">
                <label htmlFor="svc-name" className="text-xs font-semibold text-text-primary block">
                  Service Name
                </label>
                <input
                  id="svc-name"
                  type="text"
                  required
                  value={svcName}
                  onChange={(e) => setSvcName(e.target.value)}
                  placeholder="e.g. Classic Haircut"
                  className="w-full h-9 rounded-lg border border-border px-3 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="svc-desc" className="text-xs font-semibold text-text-primary block">
                  Service Description (Optional)
                </label>
                <textarea
                  id="svc-desc"
                  rows={2}
                  value={svcDesc}
                  onChange={(e) => setSvcDesc(e.target.value)}
                  placeholder="Professional haircut with styling and finishing."
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label
                    htmlFor="svc-cat"
                    className="text-xs font-semibold text-text-primary block"
                  >
                    Category
                  </label>
                  <select
                    id="svc-cat"
                    value={svcCategory}
                    onChange={(e) => setSvcCategory(e.target.value)}
                    className="w-full h-9 rounded-lg border border-border px-2.5 text-sm bg-white"
                  >
                    {SERVICE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="svc-dur"
                    className="text-xs font-semibold text-text-primary block"
                  >
                    Duration (mins)
                  </label>
                  <input
                    id="svc-dur"
                    type="number"
                    min={5}
                    max={480}
                    required
                    value={svcDuration}
                    onChange={(e) => setSvcDuration(e.target.value)}
                    className="w-full h-9 rounded-lg border border-border px-3 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="svc-price"
                    className="text-xs font-semibold text-text-primary block"
                  >
                    Price (₦)
                  </label>
                  <input
                    id="svc-price"
                    type="number"
                    min={0}
                    required
                    value={svcPriceNaira}
                    onChange={(e) => setSvcPriceNaira(e.target.value)}
                    className="w-full h-9 rounded-lg border border-border px-3 text-sm"
                  />
                </div>
              </div>

              <div className="rounded-lg bg-surface-container-lowest border border-border/50 p-3 text-xs text-text-secondary">
                Deposit policy:{' '}
                <strong className="text-text-primary">
                  {data.business.depositRequired
                    ? `${formatNairaFromKobo(data.business.defaultDepositKobo)} Kora deposit required`
                    : 'No deposit required'}
                </strong>{' '}
                (inherited from your Payments policy; existing confirmed bookings keep their
                recorded price and deposit).
              </div>

              <div className="space-y-2">
                <span className="text-xs font-semibold text-text-primary block">
                  Assigned Staff
                </span>
                {data.staff.length === 0 ? (
                  <p className="text-xs text-amber-700">
                    No staff members added yet. Save this service now and assign staff later.
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto border border-border/50 rounded-lg p-2.5">
                    {data.staff.map((st) => {
                      const checked = svcStaffIds.includes(st.id);
                      return (
                        <label
                          key={st.id}
                          className="flex items-center gap-2 text-xs text-text-primary cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) setSvcStaffIds((prev) => [...prev, st.id]);
                              else setSvcStaffIds((prev) => prev.filter((id) => id !== st.id));
                            }}
                          />
                          <span>
                            {st.name} ({st.roleTitle}) {!st.active && '— Inactive'}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <label className="flex items-center gap-2 text-xs font-medium text-text-primary cursor-pointer">
                <input
                  type="checkbox"
                  checked={svcActive}
                  onChange={(e) => setSvcActive(e.target.checked)}
                />
                <span>Available for booking (Active when required setup is complete)</span>
              </label>
            </div>

            <div className="p-4 border-t border-border/60 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setServiceDrawerOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={submitting}>
                {submitting ? 'Saving...' : 'Save Service'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Staff Add/Edit Drawer */}
      {staffDrawerOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-900/40"
          role="dialog"
          aria-modal="true"
          aria-label={editingStaff ? 'Edit Staff Member' : 'Add Staff Member'}
        >
          <form
            onSubmit={handleSaveStaff}
            className="w-full max-w-lg h-full bg-white border-l border-border/70 shadow-2xl flex flex-col overflow-hidden"
          >
            <div className="p-5 border-b border-border/60 flex items-start justify-between">
              <div>
                <h2 className="font-headline-sm text-lg font-bold text-text-primary">
                  {editingStaff ? 'Edit Staff Member' : 'Add Staff Member'}
                </h2>
                <p className="text-xs text-text-secondary mt-0.5">
                  Add someone customers can book for your services.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setStaffDrawerOpen(false)}
              >
                <AppIcon name="close" className="text-[20px]" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {formError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                  {formError}
                </div>
              )}

              <div className="space-y-1.5">
                <label htmlFor="stf-name" className="text-xs font-semibold text-text-primary block">
                  Full Name
                </label>
                <input
                  id="stf-name"
                  type="text"
                  required
                  value={stfName}
                  onChange={(e) => setStfName(e.target.value)}
                  placeholder="e.g. Tunde Adeyemi"
                  className="w-full h-9 rounded-lg border border-border px-3 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label
                    htmlFor="stf-title"
                    className="text-xs font-semibold text-text-primary block"
                  >
                    Job Title (Optional)
                  </label>
                  <input
                    id="stf-title"
                    type="text"
                    value={stfTitle}
                    onChange={(e) => setStfTitle(e.target.value)}
                    placeholder="e.g. Senior Barber"
                    className="w-full h-9 rounded-lg border border-border px-3 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label
                    htmlFor="stf-phone"
                    className="text-xs font-semibold text-text-primary block"
                  >
                    Phone Number (Optional)
                  </label>
                  <input
                    id="stf-phone"
                    type="tel"
                    value={stfPhone}
                    onChange={(e) => setStfPhone(e.target.value)}
                    placeholder="+234 803 123 4567"
                    className="w-full h-9 rounded-lg border border-border px-3 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="stf-bio" className="text-xs font-semibold text-text-primary block">
                  Short Introduction (Optional)
                </label>
                <textarea
                  id="stf-bio"
                  rows={2}
                  value={stfBio}
                  onChange={(e) => setStfBio(e.target.value)}
                  placeholder="Specializes in fades, beard grooming, and classic cuts."
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                />
              </div>

              <div className="space-y-2">
                <span className="text-xs font-semibold text-text-primary block">
                  Services Provided
                </span>
                {data.services.length === 0 ? (
                  <p className="text-xs text-text-secondary">
                    No services added yet. You can assign services after creating them.
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto border border-border/50 rounded-lg p-2.5">
                    {data.services.map((svc) => (
                      <label
                        key={svc.id}
                        className="flex items-center gap-2 text-xs text-text-primary cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={stfServiceIds.includes(svc.id)}
                          onChange={(e) => {
                            if (e.target.checked) setStfServiceIds((prev) => [...prev, svc.id]);
                            else setStfServiceIds((prev) => prev.filter((id) => id !== svc.id));
                          }}
                        />
                        <span>{svc.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <label className="flex items-center gap-2 text-xs font-medium text-text-primary cursor-pointer">
                <input
                  type="checkbox"
                  checked={stfActive}
                  onChange={(e) => setStfActive(e.target.checked)}
                />
                <span>Active for customer bookings</span>
              </label>
            </div>

            <div className="p-4 border-t border-border/60 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setStaffDrawerOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={submitting}>
                {submitting ? 'Saving...' : 'Save Staff Member'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Staff Details Drawer */}
      {viewingStaff && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-900/40"
          role="dialog"
          aria-modal="true"
          aria-label={viewingStaff.name}
        >
          <div className="w-full max-w-lg h-full bg-white border-l border-border/70 shadow-2xl flex flex-col overflow-hidden">
            <div className="p-5 border-b border-border/60 flex items-start justify-between">
              <div>
                <h2 className="font-headline-sm text-lg font-bold text-text-primary">
                  {viewingStaff.name}
                </h2>
                <p className="text-xs text-text-secondary">{viewingStaff.roleTitle}</p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setViewingStaff(null)}>
                <AppIcon name="close" className="text-[20px]" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
              <div className="rounded-xl border border-border/60 p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Booking Status</span>
                  <span className="font-semibold text-text-primary">
                    {viewingStaff.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Phone</span>
                  <span className="font-medium text-text-primary">
                    {viewingStaff.phoneE164 || 'Not provided'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Working Hours</span>
                  <span className="font-medium text-text-primary">
                    {viewingStaff.scheduleSummary}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-text-primary uppercase tracking-wider text-[11px]">
                  Assigned Services
                </h3>
                {viewingStaff.assignedServiceNames.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {viewingStaff.assignedServiceNames.map((name) => (
                      <span
                        key={name}
                        className="px-2.5 py-1 rounded-full bg-surface-container-low border border-border/50 text-text-primary"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-text-secondary">No services assigned yet.</p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-text-primary uppercase tracking-wider text-[11px]">
                    Upcoming Appointments ({viewingStaff.upcomingBookingsCount})
                  </h3>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setViewingStaff(null);
                      setActiveNav('bookings');
                    }}
                    className="h-7 text-xs"
                  >
                    Open Bookings
                  </Button>
                </div>
                {viewingStaff.upcomingBookings.length === 0 ? (
                  <p className="text-text-secondary">No upcoming appointments.</p>
                ) : (
                  <div className="divide-y divide-border/40 border border-border/50 rounded-xl">
                    {viewingStaff.upcomingBookings.map((b) => (
                      <div key={b.id} className="p-3 flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-text-primary">{b.customerName}</div>
                          <div className="text-text-secondary">{b.serviceName}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-text-primary">
                            {formatDateTime(b.startsAt, timezone)}
                          </div>
                          <div className="capitalize text-text-secondary">{b.status}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-border/60 flex items-center justify-between">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setViewingStaff(null);
                  setActiveNav('working-hours');
                }}
              >
                Manage Working Hours
              </Button>
              {isOwner && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    const target = viewingStaff;
                    setViewingStaff(null);
                    openEditStaff(target);
                  }}
                >
                  Edit Profile
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmAction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl bg-white border border-border/70 p-5 space-y-4 shadow-xl">
            <h3 className="font-headline-sm text-base font-bold text-text-primary">
              {confirmAction.type === 'service_status'
                ? `${confirmAction.nextStatus === 'archived' ? 'Archive' : 'Disable'} ${confirmAction.item.name}?`
                : `Deactivate ${confirmAction.item.name}?`}
            </h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              {confirmAction.type === 'service_status'
                ? `Customers won't be able to create new appointments for this service. ${confirmAction.item.upcomingBookingsCount} existing upcoming booking(s) will remain unchanged.`
                : `${confirmAction.item.name} won't appear as available for new appointments. ${confirmAction.item.upcomingBookingsCount} existing upcoming booking(s) will not be automatically cancelled.`}
            </p>
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConfirmAction(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={submitting}
                onClick={() => {
                  if (confirmAction.type === 'service_status') {
                    void handleSetServiceStatus(confirmAction.item.id, confirmAction.nextStatus);
                  } else {
                    void handleSetStaffActive(confirmAction.item.id, false);
                  }
                }}
              >
                Confirm
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
