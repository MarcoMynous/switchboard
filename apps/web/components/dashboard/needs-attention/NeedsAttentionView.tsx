'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppIcon } from '@/components/AppIcon';
import { Button } from '@/components/ui/button';
import type {
  IssueCategory,
  IssuePriority,
  IssueStatus,
  NeedsAttentionIssue,
  NeedsAttentionSummary,
} from '@/lib/needs-attention-server';
import { useDashboard } from '../DashboardContext';
import {
  getCategoryLabel,
  getPriorityMeta,
  getStatusMeta,
  IssueDetailsDrawer,
} from './IssueDetailsDrawer';

type StatusFilter = 'unresolved' | 'all' | IssueStatus;
type CategoryFilter = 'all' | IssueCategory;
type PriorityFilter = 'all' | IssuePriority;
type AssignedFilter = 'all' | 'unassigned' | 'me' | string;
type DateRangeFilter = 'all' | 'today' | 'week' | '30d' | 'custom';
type SortOption = 'urgency_age' | 'newest' | 'oldest' | 'highest_priority' | 'recently_updated';

function formatShortTime(iso: string, timezone: string): string {
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

export function NeedsAttentionView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { workspace, apiState, setActiveNav, refreshWorkspaceData } = useDashboard();

  const [issues, setIssues] = useState<NeedsAttentionIssue[]>([]);
  const [summary, setSummary] = useState<NeedsAttentionSummary>({
    openIssues: 0,
    needsHumanReply: 0,
    paymentIssues: 0,
    resolvedToday: 0,
  });
  const [staffMembers, setStaffMembers] = useState<
    Array<{ id: string; name: string; role: string }>
  >([]);
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string }>({
    id: '',
    name: '',
  });
  const [role, setRole] = useState<'owner' | 'staff'>('owner');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') ?? '');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    () => (searchParams.get('status') as StatusFilter) || 'unresolved',
  );
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>(
    () => (searchParams.get('type') as CategoryFilter) || 'all',
  );
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>(
    () => (searchParams.get('priority') as PriorityFilter) || 'all',
  );
  const [assignedFilter, setAssignedFilter] = useState<AssignedFilter>(
    () => searchParams.get('assigned') || 'all',
  );
  const [dateRange, setDateRange] = useState<DateRangeFilter>(
    () => (searchParams.get('range') as DateRangeFilter) || 'all',
  );
  const [customStart, setCustomStart] = useState(() => searchParams.get('from') ?? '');
  const [customEnd, setCustomEnd] = useState(() => searchParams.get('to') ?? '');
  const [sortBy, setSortBy] = useState<SortOption>(
    () => (searchParams.get('sort') as SortOption) || 'urgency_age',
  );
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(() =>
    searchParams.get('issue'),
  );

  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const timezone = workspace.timezone?.split(' ')[0] || 'Africa/Lagos';

  // Sync filters to URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set('q', searchQuery.trim());
    if (statusFilter !== 'unresolved') params.set('status', statusFilter);
    if (categoryFilter !== 'all') params.set('type', categoryFilter);
    if (priorityFilter !== 'all') params.set('priority', priorityFilter);
    if (assignedFilter !== 'all') params.set('assigned', assignedFilter);
    if (dateRange !== 'all') params.set('range', dateRange);
    if (dateRange === 'custom' && customStart) params.set('from', customStart);
    if (dateRange === 'custom' && customEnd) params.set('to', customEnd);
    if (sortBy !== 'urgency_age') params.set('sort', sortBy);
    if (selectedIssueId) params.set('issue', selectedIssueId);

    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [
    assignedFilter,
    categoryFilter,
    customEnd,
    customStart,
    dateRange,
    pathname,
    priorityFilter,
    router,
    searchQuery,
    selectedIssueId,
    sortBy,
    statusFilter,
  ]);

  const fetchIssues = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true);
        setLoadError(null);
        setAuthNotice(null);
      }

      try {
        const url = workspace.slug
          ? `/api/needs-attention?slug=${encodeURIComponent(workspace.slug)}`
          : '/api/needs-attention';
        const res = await fetch(url);

        if (res.status === 401) {
          setAuthNotice('Sign in to review and resolve issues from your database.');
          setIssues([]);
          return;
        }

        const data = (await res.json()) as {
          ok: boolean;
          issues?: NeedsAttentionIssue[];
          summary?: NeedsAttentionSummary;
          staffMembers?: Array<{ id: string; name: string; role: string }>;
          currentUser?: { id: string; name: string };
          role?: 'owner' | 'staff';
          error?: string;
        };

        if (!res.ok || !data.ok || !Array.isArray(data.issues)) {
          if (!silent) {
            setLoadError(data.error || "We couldn't load your issues.");
          }
          return;
        }

        setIssues(data.issues);
        if (data.summary) setSummary(data.summary);
        if (data.staffMembers) setStaffMembers(data.staffMembers);
        if (data.currentUser) setCurrentUser(data.currentUser);
        if (data.role) setRole(data.role);
        setLastRefreshedAt(new Date().toISOString());
      } catch {
        if (!silent) {
          setLoadError("We couldn't load your issues.");
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [workspace.slug],
  );

  useEffect(() => {
    void fetchIssues(false);
  }, [fetchIssues]);

  // Poll every 30s without wiping filters or current drawer selection
  useEffect(() => {
    const id = setInterval(() => {
      void fetchIssues(true);
    }, 30_000);
    return () => clearInterval(id);
  }, [fetchIssues]);

  const selectedIssue = useMemo(
    () => issues.find((i) => i.id === selectedIssueId) ?? null,
    [issues, selectedIssueId],
  );

  const filteredIssues = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const now = Date.now();

    const list = issues.filter((issue) => {
      if (statusFilter === 'unresolved') {
        if (
          issue.status !== 'open' &&
          issue.status !== 'in_progress' &&
          issue.status !== 'waiting'
        ) {
          return false;
        }
      } else if (statusFilter !== 'all' && issue.status !== statusFilter) {
        return false;
      }

      if (categoryFilter !== 'all' && issue.category !== categoryFilter) {
        return false;
      }

      if (priorityFilter !== 'all' && issue.priority !== priorityFilter) {
        return false;
      }

      if (assignedFilter === 'unassigned') {
        if (issue.assignedUserId !== null) return false;
      } else if (assignedFilter === 'me') {
        if (!currentUser.id || issue.assignedUserId !== currentUser.id) return false;
      } else if (assignedFilter !== 'all') {
        if (issue.assignedUserId !== assignedFilter) return false;
      }

      if (dateRange !== 'all') {
        const createdMs = new Date(issue.createdAt).getTime();
        if (dateRange === 'today') {
          if (now - createdMs > 86_400_000) return false;
        } else if (dateRange === 'week') {
          if (now - createdMs > 7 * 86_400_000) return false;
        } else if (dateRange === '30d') {
          if (now - createdMs > 30 * 86_400_000) return false;
        } else if (dateRange === 'custom') {
          if (customStart && createdMs < new Date(`${customStart}T00:00:00`).getTime()) {
            return false;
          }
          if (customEnd && createdMs > new Date(`${customEnd}T23:59:59`).getTime()) {
            return false;
          }
        }
      }

      if (q) {
        const haystacks = [
          issue.title,
          issue.reference,
          issue.customer?.name ?? '',
          issue.customer?.phone ?? '',
          issue.booking?.reference ?? '',
          issue.booking?.serviceName ?? '',
        ]
          .join(' ')
          .toLowerCase();
        if (!haystacks.includes(q)) return false;
      }

      return true;
    });

    const priorityRank: Record<IssuePriority, number> = { high: 0, normal: 1, low: 2 };
    const isUnresolved = (s: IssueStatus) => s === 'open' || s === 'in_progress' || s === 'waiting';

    return [...list].sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortBy === 'oldest') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      if (sortBy === 'recently_updated') {
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
      if (sortBy === 'highest_priority') {
        if (priorityRank[a.priority] !== priorityRank[b.priority]) {
          return priorityRank[a.priority] - priorityRank[b.priority];
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      // urgency_age default
      const ua = isUnresolved(a.status) ? 0 : 1;
      const ub = isUnresolved(b.status) ? 0 : 1;
      if (ua !== ub) return ua - ub;
      if (priorityRank[a.priority] !== priorityRank[b.priority]) {
        return priorityRank[a.priority] - priorityRank[b.priority];
      }
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }, [
    assignedFilter,
    categoryFilter,
    currentUser.id,
    customEnd,
    customStart,
    dateRange,
    issues,
    priorityFilter,
    searchQuery,
    sortBy,
    statusFilter,
  ]);

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    statusFilter !== 'unresolved' ||
    categoryFilter !== 'all' ||
    priorityFilter !== 'all' ||
    assignedFilter !== 'all' ||
    dateRange !== 'all';

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('unresolved');
    setCategoryFilter('all');
    setPriorityFilter('all');
    setAssignedFilter('all');
    setDateRange('all');
    setCustomStart('');
    setCustomEnd('');
    setSortBy('urgency_age');
  };

  const handleAssign = async (
    issue: NeedsAttentionIssue,
    assignedUserId: string,
    assignedUserName: string,
  ) => {
    setSubmitting(true);
    setActionError(null);
    try {
      const res = await fetch('/api/needs-attention', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'assign',
          slug: workspace.slug,
          entityId: issue.entityId,
          entityType: issue.entityType,
          assignedUserId,
          assignedUserName: assignedUserName || currentUser.name,
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setActionError(data.error || 'Could not assign issue.');
        return;
      }
      await fetchIssues(true);
      refreshWorkspaceData();
    } catch {
      setActionError('Network error while assigning issue.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTransition = async (
    issue: NeedsAttentionIssue,
    status: IssueStatus,
    resolutionNote?: string,
    resolutionCategory?: string,
  ) => {
    setSubmitting(true);
    setActionError(null);
    try {
      const res = await fetch('/api/needs-attention', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'transition',
          slug: workspace.slug,
          entityId: issue.entityId,
          entityType: issue.entityType,
          status,
          resolutionNote,
          resolutionCategory,
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setActionError(data.error || 'Could not update issue status.');
        return;
      }
      await fetchIssues(true);
      refreshWorkspaceData();
    } catch {
      setActionError('Network error while updating issue.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col w-full space-y-6">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-4 border-b border-border/50">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="font-headline-md text-2xl font-bold text-text-primary tracking-tight">
              Needs Attention
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-200">
              {summary.openIssues} unresolved
            </span>
          </div>
          <p className="text-sm text-text-secondary">
            Review customer requests and booking issues that need your help.
          </p>
          <div className="flex items-center gap-3 text-xs text-text-secondary flex-wrap pt-1">
            <span>
              Workspace:{' '}
              <strong className="text-text-primary font-medium">
                {workspace.businessName || 'Your Business'}
              </strong>
            </span>
            <span>•</span>
            <span>Timezone: {timezone}</span>
            {lastRefreshedAt && (
              <>
                <span>•</span>
                <span>Updated {formatShortTime(lastRefreshedAt, timezone)}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void fetchIssues(false)}
            disabled={loading}
            className="h-9 text-xs"
          >
            <AppIcon name="refresh" className="text-[16px]" />
            <span>Refresh</span>
          </Button>
          <Button
            type="button"
            variant={statusFilter === 'unresolved' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('unresolved')}
            className="h-9 text-xs"
          >
            <AppIcon name="inbox" className="text-[16px]" />
            <span>View Open Issues</span>
          </Button>
          <Link
            href="/dashboard/settings"
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-white text-xs font-medium text-text-primary hover:bg-surface-container-low transition-colors"
          >
            <AppIcon name="settings" className="text-[16px]" />
            <span>Issue Settings</span>
          </Link>
        </div>
      </div>

      {authNotice && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-xs text-amber-900 flex items-center justify-between gap-3">
          <span>{authNotice}</span>
          <Link href="/auth/signin" className="font-semibold underline shrink-0">
            Sign in
          </Link>
        </div>
      )}

      {/* 4 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border/60 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-secondary">Open Issues</span>
            <AppIcon name="pending_actions" className="text-[18px] text-amber-600" />
          </div>
          <p className="font-headline-md text-2xl font-bold text-text-primary mt-2">
            {summary.openIssues}
          </p>
          <p className="text-xs text-text-secondary mt-1">
            Problems or requests still waiting to be resolved.
          </p>
        </div>

        <div
          data-tour="needs-attention-panel"
          className="rounded-xl border border-border/60 bg-white p-4 shadow-xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-secondary">Needs Human Reply</span>
            <AppIcon name="support_agent" className="text-[18px] text-primary" />
          </div>
          <p className="font-headline-md text-2xl font-bold text-text-primary mt-2">
            {summary.needsHumanReply}
          </p>
          <p className="text-xs text-text-secondary mt-1">
            Customer conversations waiting for someone from your team.
          </p>
        </div>

        <div className="rounded-xl border border-border/60 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-secondary">Payment Issues</span>
            <AppIcon name="payments" className="text-[18px] text-rose-600" />
          </div>
          <p className="font-headline-md text-2xl font-bold text-text-primary mt-2">
            {summary.paymentIssues}
          </p>
          <p className="text-xs text-text-secondary mt-1">
            Deposits or refunds that require investigation.
          </p>
        </div>

        <div className="rounded-xl border border-border/60 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-secondary">Resolved Today</span>
            <AppIcon name="task_alt" className="text-[18px] text-emerald-600" />
          </div>
          <p className="font-headline-md text-2xl font-bold text-text-primary mt-2">
            {summary.resolvedToday}
          </p>
          <p className="text-xs text-text-secondary mt-1">Issues successfully completed today.</p>
        </div>
      </div>

      {/* Main Inbox Card */}
      <div className="rounded-xl border border-border/60 bg-white shadow-xs overflow-hidden">
        <div className="p-5 border-b border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="font-headline-sm text-base font-bold text-text-primary">
              Issues Requiring Attention
            </h2>
            <p className="text-xs text-text-secondary">
              Review and resolve outstanding customer and operational requests.
            </p>
          </div>
          {hasActiveFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-8 text-xs self-start sm:self-auto"
            >
              Clear Filters
            </Button>
          )}
        </div>

        {/* Search & Filters Toolbar */}
        <div className="p-4 border-b border-border/50 bg-surface-container-lowest/60 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-2.5">
            <div className="lg:col-span-2 relative">
              <AppIcon
                name="search"
                className="text-[16px] text-text-secondary absolute left-3 top-1/2 -translate-y-1/2"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search customer, phone, or reference..."
                className="w-full h-9 pl-9 pr-3 rounded-lg border border-border bg-white text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
              />
            </div>

            <select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="h-9 rounded-lg border border-border bg-white px-2.5 text-xs text-text-primary"
            >
              <option value="unresolved">Status: Unresolved</option>
              <option value="all">Status: All</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="waiting">Waiting</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>

            <select
              aria-label="Filter by issue type"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
              className="h-9 rounded-lg border border-border bg-white px-2.5 text-xs text-text-primary"
            >
              <option value="all">Type: All</option>
              <option value="human_assistance">Human Assistance</option>
              <option value="booking">Booking</option>
              <option value="payment">Payment</option>
              <option value="notification">Notification</option>
              <option value="integration">Integration</option>
            </select>

            <select
              aria-label="Filter by priority"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as PriorityFilter)}
              className="h-9 rounded-lg border border-border bg-white px-2.5 text-xs text-text-primary"
            >
              <option value="all">Priority: All</option>
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </select>

            <select
              aria-label="Sort issues"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="h-9 rounded-lg border border-border bg-white px-2.5 text-xs text-text-primary"
            >
              <option value="urgency_age">Sort: Urgency &amp; Age</option>
              <option value="highest_priority">Sort: Highest Priority</option>
              <option value="newest">Sort: Newest</option>
              <option value="oldest">Sort: Oldest</option>
              <option value="recently_updated">Sort: Recently Updated</option>
            </select>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <select
              aria-label="Filter by assignee"
              value={assignedFilter}
              onChange={(e) => setAssignedFilter(e.target.value)}
              className="h-8 rounded-lg border border-border bg-white px-2.5 text-xs text-text-primary"
            >
              <option value="all">Assigned To: Anyone</option>
              <option value="unassigned">Unassigned</option>
              <option value="me">Assigned to Me</option>
              {staffMembers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by date range"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as DateRangeFilter)}
              className="h-8 rounded-lg border border-border bg-white px-2.5 text-xs text-text-primary"
            >
              <option value="all">Date: All Time</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="30d">Last 30 Days</option>
              <option value="custom">Custom Range</option>
            </select>

            {dateRange === 'custom' && (
              <div className="flex items-center gap-2 text-xs">
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="h-8 rounded-lg border border-border bg-white px-2 text-xs"
                />
                <span className="text-text-secondary">to</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="h-8 rounded-lg border border-border bg-white px-2 text-xs"
                />
              </div>
            )}
          </div>
        </div>

        {/* Content States */}
        {loading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3, 4].map((row) => (
              <div key={row} className="h-14 rounded-lg bg-surface-container-low animate-pulse" />
            ))}
          </div>
        ) : loadError ? (
          <div className="p-10 text-center space-y-3">
            <AppIcon name="cloud_off" className="text-[32px] text-rose-500 mx-auto" />
            <h3 className="font-headline-sm text-base font-bold text-text-primary">
              We couldn&apos;t load your issues.
            </h3>
            <p className="text-xs text-text-secondary">{loadError}</p>
            <Button type="button" size="sm" onClick={() => void fetchIssues(false)}>
              Retry
            </Button>
          </div>
        ) : filteredIssues.length === 0 ? (
          assignedFilter === 'me' ? (
            <div className="p-10 text-center space-y-3">
              <AppIcon name="assignment_ind" className="text-[32px] text-text-secondary mx-auto" />
              <h3 className="font-headline-sm text-base font-bold text-text-primary">
                No issues assigned to you.
              </h3>
              <p className="text-xs text-text-secondary">
                You can review open issues or return to the Overview.
              </p>
              <div className="flex items-center justify-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
                  View Open Issues
                </Button>
                <Button type="button" size="sm" onClick={() => setActiveNav('overview')}>
                  Return to Overview
                </Button>
              </div>
            </div>
          ) : hasActiveFilters ? (
            <div className="p-10 text-center space-y-3">
              <AppIcon name="filter_list_off" className="text-[32px] text-text-secondary mx-auto" />
              <h3 className="font-headline-sm text-base font-bold text-text-primary">
                No issues match your filters.
              </h3>
              <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
                Clear Filters
              </Button>
            </div>
          ) : (
            <div className="p-12 text-center space-y-2.5">
              <div className="w-11 h-11 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <AppIcon name="check_circle" className="text-[24px]" />
              </div>
              <h3 className="font-headline-sm text-base font-bold text-text-primary">
                You&apos;re all caught up!
              </h3>
              <p className="text-xs text-text-secondary max-w-md mx-auto">
                There are no customer requests or booking problems needing your attention right now.
              </p>
            </div>
          )
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/50 bg-surface-container-lowest text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
                    <th className="py-3 px-4">Issue</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Related Booking</th>
                    <th className="py-3 px-4">Priority</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Assigned To</th>
                    <th className="py-3 px-4">Created</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 text-xs">
                  {filteredIssues.map((issue) => {
                    const pMeta = getPriorityMeta(issue.priority);
                    const sMeta = getStatusMeta(issue.status);
                    return (
                      <tr
                        key={issue.id}
                        onClick={() => {
                          setActionError(null);
                          setSelectedIssueId(issue.id);
                        }}
                        className="hover:bg-surface-container-lowest/80 cursor-pointer transition-colors"
                      >
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-text-primary">{issue.title}</div>
                          <div className="text-[11px] text-text-secondary mt-0.5">
                            {getCategoryLabel(issue.category)} • {issue.reference}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          {issue.customer ? (
                            <div>
                              <div className="font-medium text-text-primary">
                                {issue.customer.name}
                              </div>
                              <div className="text-[11px] text-text-secondary">
                                {issue.customer.phone}
                              </div>
                            </div>
                          ) : (
                            <span className="text-text-secondary">Workspace</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          {issue.booking ? (
                            <div>
                              <div className="font-medium text-text-primary">
                                {issue.booking.serviceName}
                              </div>
                              <div className="text-[11px] text-text-secondary">
                                {issue.booking.reference}
                              </div>
                            </div>
                          ) : (
                            <span className="text-text-secondary">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${pMeta.badgeClass}`}
                          >
                            {pMeta.label}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${sMeta.badgeClass}`}
                          >
                            {sMeta.label}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-text-primary">
                          {issue.assignedUserName || (
                            <span className="text-text-secondary">Unassigned</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-text-secondary whitespace-nowrap">
                          {formatShortTime(issue.createdAt, timezone)}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActionError(null);
                              setSelectedIssueId(issue.id);
                            }}
                            className="h-7 text-xs"
                          >
                            Review Issue
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Cards */}
            <div className="lg:hidden divide-y divide-border/50">
              {filteredIssues.map((issue) => {
                const pMeta = getPriorityMeta(issue.priority);
                const sMeta = getStatusMeta(issue.status);
                return (
                  <div key={issue.id} className="p-4 space-y-2.5 bg-white">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold text-sm text-text-primary">{issue.title}</div>
                        <div className="text-xs text-text-secondary mt-0.5">
                          {getCategoryLabel(issue.category)} • {issue.reference}
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold shrink-0 ${pMeta.badgeClass}`}
                      >
                        {pMeta.label}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-text-secondary">
                      <span>{issue.customer?.name ?? 'Workspace'}</span>
                      <span>{formatShortTime(issue.createdAt, timezone)}</span>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${sMeta.badgeClass}`}
                      >
                        {sMeta.label}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActionError(null);
                          setSelectedIssueId(issue.id);
                        }}
                        className="h-7 text-xs"
                      >
                        Review Issue
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Issue Details Drawer */}
      {selectedIssue && (
        <IssueDetailsDrawer
          issue={selectedIssue}
          timezone={timezone}
          userRole={apiState.role ?? role}
          currentUserId={currentUser.id}
          staffMembers={staffMembers}
          submitting={submitting}
          actionError={actionError}
          onClose={() => setSelectedIssueId(null)}
          onAssign={(userId, userName) => handleAssign(selectedIssue, userId, userName)}
          onTransition={(status, note, category) =>
            handleTransition(selectedIssue, status, note, category)
          }
          onRefreshPaymentStatus={() => fetchIssues(false)}
          onOpenConversation={() => {
            setSelectedIssueId(null);
            setActiveNav('conversations');
          }}
          onViewBooking={() => {
            setSelectedIssueId(null);
            setActiveNav('bookings');
          }}
          onReviewRefund={() => {
            setSelectedIssueId(null);
            setActiveNav('payments');
          }}
          onOpenIntegrations={() => {
            setSelectedIssueId(null);
            setActiveNav('integrations');
          }}
        />
      )}
    </div>
  );
}
