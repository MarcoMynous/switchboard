'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { OnboardingState } from '@/app/onboarding/page';
import { AppIcon } from '@/components/AppIcon';
import { HoldBand } from '@/components/HoldBand';
import { Button } from '@/components/ui/button';
import type {
  DashboardBookingRecord,
  DashboardConversationRecord,
} from '../bookings/BookingsManagementView';

type ConversationStatusFilter =
  | 'all'
  | 'agent_active'
  | 'needs_human'
  | 'staff_takeover'
  | 'resolved';

type ChannelFilter = 'all' | 'whatsapp' | 'web_chat';
type ContextFilter = 'all' | 'has_booking' | 'payment_issues';

export interface ConversationsManagementViewProps {
  workspace: OnboardingState;
  conversations: DashboardConversationRecord[];
  bookings: DashboardBookingRecord[];
  userRole: 'owner' | 'staff';
  operatorName: string;
  whatsappConnected: boolean;
  isLoading: boolean;
  apiError: string | null;
  initialNeedsHumanOnly?: boolean;
  onRefresh: () => void;
  onOpenTestChat: () => void;
  onUpdateConversation: (
    conversationId: string,
    updater: (prev: DashboardConversationRecord) => DashboardConversationRecord,
  ) => void;
  onUpdateBooking: (
    bookingId: string,
    updater: (prev: DashboardBookingRecord) => DashboardBookingRecord,
  ) => void;
  onNavigateSection: (
    section: 'bookings' | 'customers' | 'needs-attention' | 'ai-receptionist' | 'integrations',
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

function getConversationStatusMeta(status: DashboardConversationRecord['status']): {
  label: string;
  badgeClass: string;
  icon: string;
} {
  switch (status) {
    case 'agent_active':
      return {
        label: 'AI Handling',
        badgeClass: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
        icon: 'smart_toy',
      };
    case 'needs_human':
      return {
        label: 'Needs Human',
        badgeClass: 'bg-amber-100 text-amber-900 border border-amber-300',
        icon: 'notification_important',
      };
    case 'staff_takeover':
      return {
        label: 'Human Handling',
        badgeClass: 'bg-indigo-100 text-indigo-800 border border-indigo-200',
        icon: 'support_agent',
      };
    case 'resolved':
      return {
        label: 'Resolved',
        badgeClass: 'bg-slate-100 text-slate-700 border border-slate-200',
        icon: 'check_circle',
      };
  }
}

function getPaymentLabel(paymentStatus: DashboardBookingRecord['paymentStatus']): {
  label: string;
  className: string;
} {
  switch (paymentStatus) {
    case 'verified':
      return { label: 'Verified', className: 'text-emerald-700' };
    case 'awaiting_payment':
      return { label: 'Awaiting Deposit', className: 'text-amber-700' };
    case 'pending_verification':
      return { label: 'Payment Being Verified', className: 'text-indigo-700' };
    case 'underpaid':
      return { label: 'Underpaid', className: 'text-red-700' };
    case 'refund_pending':
      return { label: 'Refund Pending', className: 'text-amber-700' };
    case 'refunded':
      return { label: 'Refunded', className: 'text-slate-600' };
    case 'not_required':
      return { label: 'No Deposit Required', className: 'text-slate-600' };
  }
}

export function ConversationsManagementView({
  workspace,
  conversations,
  bookings,
  userRole,
  operatorName,
  whatsappConnected,
  isLoading,
  apiError,
  initialNeedsHumanOnly = false,
  onRefresh,
  onOpenTestChat,
  onUpdateConversation,
  onUpdateBooking,
  onNavigateSection,
}: ConversationsManagementViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ConversationStatusFilter>(
    initialNeedsHumanOnly ? 'needs_human' : 'all',
  );
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>('all');
  const [contextFilter, setContextFilter] = useState<ContextFilter>('all');

  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(
    conversations[0]?.id ?? null,
  );
  const [showContextPanel, setShowContextPanel] = useState(true);
  const [mobilePanel, setMobilePanel] = useState<'inbox' | 'chat' | 'context'>('inbox');
  const [replyDraft, setReplyDraft] = useState('');
  const [checkingPaymentId, setCheckingPaymentId] = useState<string | null>(null);
  const [paymentCheckNotice, setPaymentCheckNotice] = useState<{
    bookingId: string;
    tone: 'success' | 'pending' | 'issue';
    text: string;
  } | null>(null);

  useEffect(() => {
    setStatusFilter(initialNeedsHumanOnly ? 'needs_human' : 'all');
  }, [initialNeedsHumanOnly]);

  const getLinkedBookings = useCallback(
    (conv: DashboardConversationRecord): DashboardBookingRecord[] => {
      return bookings.filter(
        (b) =>
          b.customerPhone === conv.customerPhone ||
          b.customerName.toLowerCase() === conv.customerName.toLowerCase(),
      );
    },
    [bookings],
  );

  // Summary counts
  const summaryCounts = useMemo(() => {
    return {
      total: conversations.length,
      aiHandling: conversations.filter((c) => c.status === 'agent_active').length,
      needsHuman: conversations.filter((c) => c.status === 'needs_human').length,
      resolved: conversations.filter((c) => c.status === 'resolved').length,
    };
  }, [conversations]);

  // Filtered inbox list
  const filteredConversations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return conversations.filter((conv) => {
      if (q) {
        const hay =
          `${conv.customerName} ${conv.customerPhone} ${conv.id} ${conv.lastMessage}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (statusFilter !== 'all' && conv.status !== statusFilter) return false;
      if (channelFilter !== 'all' && conv.channel !== channelFilter) return false;

      if (contextFilter !== 'all') {
        const linked = getLinkedBookings(conv);
        if (contextFilter === 'has_booking' && linked.length === 0) return false;
        if (
          contextFilter === 'payment_issues' &&
          !linked.some(
            (b) =>
              b.paymentStatus === 'pending_verification' ||
              b.paymentStatus === 'underpaid' ||
              b.paymentStatus === 'refund_pending',
          )
        ) {
          return false;
        }
      }
      return true;
    });
  }, [conversations, searchQuery, statusFilter, channelFilter, contextFilter, getLinkedBookings]);

  const selectedConversation = useMemo(
    () =>
      filteredConversations.find((c) => c.id === selectedConversationId) ??
      conversations.find((c) => c.id === selectedConversationId) ??
      null,
    [filteredConversations, conversations, selectedConversationId],
  );

  const selectedLinkedBookings = useMemo(
    () => (selectedConversation ? getLinkedBookings(selectedConversation) : []),
    [selectedConversation, getLinkedBookings],
  );
  const primaryBooking = selectedLinkedBookings[0] ?? null;

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    statusFilter !== 'all' ||
    channelFilter !== 'all' ||
    contextFilter !== 'all';

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setChannelFilter('all');
    setContextFilter('all');
  };

  // System events derived from verified booking/conversation state
  const systemEvents = useMemo(() => {
    if (!selectedConversation) return [];
    const list: Array<{ id: string; title: string; detail: string; icon: string; tone: string }> =
      [];

    if (primaryBooking) {
      if (primaryBooking.status === 'held') {
        list.push({
          id: `sys_held_${primaryBooking.id}`,
          title: 'Slot Held',
          detail: `Appointment temporarily reserved (${primaryBooking.slotTime}).`,
          icon: 'schedule',
          tone: 'bg-amber-50 border-amber-200 text-amber-900',
        });
      }
      if (primaryBooking.depositKobo > 0 && primaryBooking.paymentStatus === 'awaiting_payment') {
        list.push({
          id: `sys_dep_${primaryBooking.id}`,
          title: 'Deposit Requested',
          detail: `${formatNairaFromKobo(primaryBooking.depositKobo)} deposit instructions issued.`,
          icon: 'payments',
          tone: 'bg-slate-50 border-slate-200 text-slate-800',
        });
      }
      if (primaryBooking.paymentStatus === 'verified') {
        list.push({
          id: `sys_ver_${primaryBooking.id}`,
          title: 'Payment Verified',
          detail: `${formatNairaFromKobo(primaryBooking.depositKobo)} verified through Kora.`,
          icon: 'verified',
          tone: 'bg-emerald-50 border-emerald-200 text-emerald-900',
        });
      }
      if (primaryBooking.status === 'confirmed') {
        list.push({
          id: `sys_conf_${primaryBooking.id}`,
          title: 'Booking Confirmed',
          detail: `Appointment confirmed for ${primaryBooking.slotTime}.`,
          icon: 'event_available',
          tone: 'bg-emerald-50 border-emerald-200 text-emerald-900',
        });
      }
      if (primaryBooking.status === 'expired') {
        list.push({
          id: `sys_exp_${primaryBooking.id}`,
          title: 'Booking Expired',
          detail: 'Hold window elapsed before payment verification.',
          icon: 'history',
          tone: 'bg-slate-100 border-slate-200 text-slate-700',
        });
      }
    }

    if (selectedConversation.status === 'needs_human') {
      list.push({
        id: `sys_esc_${selectedConversation.id}`,
        title: 'Conversation Escalated',
        detail: selectedConversation.escalationReason || 'Customer requested staff assistance.',
        icon: 'notification_important',
        tone: 'bg-amber-50 border-amber-200 text-amber-900',
      });
    }
    if (selectedConversation.status === 'staff_takeover') {
      list.push({
        id: `sys_staff_${selectedConversation.id}`,
        title: 'Human Operator Joined',
        detail: `${selectedConversation.assignedTo || operatorName} took over from ${workspace.assistantName}.`,
        icon: 'support_agent',
        tone: 'bg-indigo-50 border-indigo-200 text-indigo-900',
      });
    }
    if (selectedConversation.status === 'resolved') {
      list.push({
        id: `sys_res_${selectedConversation.id}`,
        title: 'Conversation Resolved',
        detail: `Marked resolved${selectedConversation.resolvedBy ? ` by ${selectedConversation.resolvedBy}` : ''}.`,
        icon: 'check_circle',
        tone: 'bg-slate-50 border-slate-200 text-slate-800',
      });
    }

    return list;
  }, [selectedConversation, primaryBooking, operatorName, workspace.assistantName]);

  const handleTakeOver = (conv: DashboardConversationRecord) => {
    onUpdateConversation(conv.id, (prev) => ({
      ...prev,
      status: 'staff_takeover',
      assignedTo: operatorName,
      unread: false,
      updatedAt: 'Just now',
      messages: [
        ...prev.messages,
        {
          id: `sys_join_${Date.now()}`,
          sender: 'system',
          text: `${operatorName} joined the conversation. AI replies are paused.`,
          time: 'Now',
        },
      ],
    }));
  };

  const handleReturnToAi = (conv: DashboardConversationRecord) => {
    onUpdateConversation(conv.id, (prev) => ({
      ...prev,
      status: 'agent_active',
      assignedTo: undefined,
      updatedAt: 'Just now',
      messages: [
        ...prev.messages,
        {
          id: `sys_ai_${Date.now()}`,
          sender: 'system',
          text: `Conversation returned to ${workspace.assistantName} (AI Receptionist).`,
          time: 'Now',
        },
      ],
    }));
  };

  const handleMarkResolved = (conv: DashboardConversationRecord) => {
    onUpdateConversation(conv.id, (prev) => ({
      ...prev,
      status: 'resolved',
      resolvedAt: new Date().toISOString(),
      resolvedBy: operatorName,
      unread: false,
      updatedAt: 'Just now',
      messages: [
        ...prev.messages,
        {
          id: `sys_res_${Date.now()}`,
          sender: 'system',
          text: `Conversation marked as resolved by ${operatorName}.`,
          time: 'Now',
        },
      ],
    }));
  };

  const handleSendStaffReply = (conv: DashboardConversationRecord) => {
    const text = replyDraft.trim();
    if (!text) return;

    // For WhatsApp when disconnected, do not pretend it was delivered
    const deliveryState: 'sent' | 'failed' =
      conv.channel === 'whatsapp' && !whatsappConnected ? 'failed' : 'sent';

    onUpdateConversation(conv.id, (prev) => ({
      ...prev,
      status: 'staff_takeover',
      assignedTo: operatorName,
      lastMessage: deliveryState === 'failed' ? prev.lastMessage : text,
      updatedAt: 'Just now',
      messages: [
        ...prev.messages,
        {
          id: `st_${Date.now()}`,
          sender: 'staff',
          text,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          deliveryState,
        },
      ],
    }));
    setReplyDraft('');
  };

  const handleCheckBookingPayment = async (bk: DashboardBookingRecord) => {
    setCheckingPaymentId(bk.id);
    setPaymentCheckNotice(null);
    try {
      const res = await fetch(`/api/booking-status?reference=${encodeURIComponent(bk.reference)}`);
      const data = (await res.json()) as {
        ok?: boolean;
        found?: boolean;
        status?: string;
        amountPaidKobo?: number;
      };
      if (!res.ok || !data.ok || !data.found) {
        setPaymentCheckNotice({
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
        setPaymentCheckNotice({
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
        setPaymentCheckNotice({
          bookingId: bk.id,
          tone: 'issue',
          text: 'This payment needs attention. Customer paid less than expected.',
        });
      } else {
        setPaymentCheckNotice({
          bookingId: bk.id,
          tone: 'pending',
          text: "We haven't confirmed this payment yet. Switchboard will continue checking.",
        });
      }
    } catch {
      setPaymentCheckNotice({
        bookingId: bk.id,
        tone: 'pending',
        text: "We haven't confirmed this payment yet. Switchboard will continue checking.",
      });
    } finally {
      setCheckingPaymentId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* =====================================================================
          ROW 1: PAGE HEADER
      ===================================================================== */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-2 border-b border-border/50">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap text-xs text-text-secondary font-medium">
            <span>{workspace.businessName}</span>
            <span>•</span>
            <span
              className={`font-semibold ${
                summaryCounts.needsHuman > 0 ? 'text-amber-700' : 'text-emerald-700'
              }`}
            >
              {summaryCounts.needsHuman} needing human assistance
            </span>
            <span>•</span>
            {whatsappConnected ? (
              <span className="inline-flex items-center gap-1 text-emerald-700">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                WhatsApp connected
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onNavigateSection('integrations')}
                className="inline-flex items-center gap-1 text-amber-700 hover:underline cursor-pointer"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                WhatsApp setup required
              </button>
            )}
          </div>
          <h1 className="font-headline-lg text-2xl sm:text-3xl font-bold text-text-primary tracking-tight">
            {initialNeedsHumanOnly ? 'Needs Attention' : 'Conversations'}
          </h1>
          <p className="font-body-md text-sm text-text-secondary">
            See what customers are asking, monitor your AI receptionist, and step in when needed.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <Button type="button" variant="outline" size="sm" onClick={onRefresh} className="h-9">
            <AppIcon name="refresh" className="text-[16px]" />
            <span>Refresh</span>
          </Button>

          <Button
            type="button"
            variant={statusFilter === 'needs_human' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(statusFilter === 'needs_human' ? 'all' : 'needs_human')}
            className="h-9"
          >
            <AppIcon name="notification_important" className="text-[16px]" />
            <span>Needs Human ({summaryCounts.needsHuman})</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenTestChat}
            className="h-9"
          >
            <AppIcon name="smart_toy" className="text-[16px] text-primary" />
            <span>Test AI Receptionist</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onNavigateSection('ai-receptionist')}
            className="h-9"
          >
            <AppIcon name="tune" className="text-[16px]" />
            <span>Conversation Settings</span>
          </Button>
        </div>
      </div>

      {/* =====================================================================
          ROW 2: COMPACT SUMMARY CARDS
      ===================================================================== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <button
          type="button"
          onClick={() => setStatusFilter('all')}
          className={`bg-surface rounded-xl p-3.5 border text-left transition-all cursor-pointer ${
            statusFilter === 'all' ? 'border-primary ring-1 ring-primary/20' : 'border-border/70'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-secondary">Conversations</span>
            <AppIcon name="forum" className="text-[16px] text-primary" />
          </div>
          <div className="text-xl font-bold text-text-primary mt-1">{summaryCounts.total}</div>
          <p className="text-[11px] text-text-secondary mt-0.5 truncate">
            Customer threads in this workspace.
          </p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'agent_active' ? 'all' : 'agent_active')}
          className={`bg-surface rounded-xl p-3.5 border text-left transition-all cursor-pointer ${
            statusFilter === 'agent_active'
              ? 'border-emerald-500 ring-1 ring-emerald-500/20'
              : 'border-border/70'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-secondary">AI Handling</span>
            <AppIcon name="smart_toy" className="text-[16px] text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-text-primary mt-1">{summaryCounts.aiHandling}</div>
          <p className="text-[11px] text-text-secondary mt-0.5 truncate">
            Managed by {workspace.assistantName}.
          </p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'needs_human' ? 'all' : 'needs_human')}
          className={`bg-surface rounded-xl p-3.5 border text-left transition-all cursor-pointer ${
            statusFilter === 'needs_human'
              ? 'border-amber-500 ring-1 ring-amber-500/20'
              : summaryCounts.needsHuman > 0
                ? 'border-amber-300 bg-amber-50/30'
                : 'border-border/70'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-secondary">Needs Human</span>
            <AppIcon
              name={summaryCounts.needsHuman > 0 ? 'notification_important' : 'check_circle'}
              className={`text-[16px] ${
                summaryCounts.needsHuman > 0 ? 'text-amber-600' : 'text-emerald-600'
              }`}
            />
          </div>
          <div
            className={`text-xl font-bold mt-1 ${
              summaryCounts.needsHuman > 0 ? 'text-amber-700' : 'text-text-primary'
            }`}
          >
            {summaryCounts.needsHuman}
          </div>
          <p className="text-[11px] text-text-secondary mt-0.5 truncate">
            Waiting for assistance from your team.
          </p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'resolved' ? 'all' : 'resolved')}
          className={`bg-surface rounded-xl p-3.5 border text-left transition-all cursor-pointer ${
            statusFilter === 'resolved'
              ? 'border-slate-400 ring-1 ring-slate-400/20'
              : 'border-border/70'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-secondary">Resolved</span>
            <AppIcon name="task_alt" className="text-[16px] text-slate-600" />
          </div>
          <div className="text-xl font-bold text-text-primary mt-1">{summaryCounts.resolved}</div>
          <p className="text-[11px] text-text-secondary mt-0.5 truncate">
            Completed or closed interactions.
          </p>
        </button>
      </div>

      {/* Disconnected WhatsApp Banner */}
      {!whatsappConnected && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 flex items-center justify-between gap-3 flex-wrap text-xs">
          <div className="flex items-center gap-2 text-amber-900">
            <AppIcon name="warning" className="text-[18px] text-amber-600 shrink-0" />
            <span>
              <strong>WhatsApp needs attention.</strong> Check your connection settings to receive
              and reply to live WhatsApp messages. Web chat remains active.
            </span>
          </div>
          <button
            type="button"
            onClick={() => onNavigateSection('integrations')}
            className="font-semibold text-primary hover:underline cursor-pointer shrink-0"
          >
            Open Integrations →
          </button>
        </div>
      )}

      {/* Error Banner */}
      {apiError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-center justify-between gap-3 text-xs text-red-900">
          <span>{apiError}</span>
          <Button type="button" variant="outline" size="sm" onClick={onRefresh} className="h-7">
            Retry
          </Button>
        </div>
      )}

      {/* =====================================================================
          ROW 3: EMPTY / LOADING OR THREE-PANEL INBOX
      ===================================================================== */}
      {isLoading && conversations.length === 0 ? (
        <div className="bg-surface rounded-xl border border-border/70 p-6 grid grid-cols-1 lg:grid-cols-12 gap-4 animate-pulse">
          <div className="lg:col-span-3 space-y-3">
            <div className="h-9 bg-surface-container rounded-lg" />
            <div className="h-20 bg-surface-container-low rounded-lg" />
            <div className="h-20 bg-surface-container-low rounded-lg" />
          </div>
          <div className="lg:col-span-6 h-80 bg-surface-container-low rounded-xl" />
          <div className="lg:col-span-3 h-80 bg-surface-container-low rounded-xl" />
        </div>
      ) : conversations.length === 0 ? (
        <div className="bg-surface rounded-xl p-12 border border-border/70 text-center space-y-4 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-primary flex items-center justify-center mx-auto">
            <AppIcon name="forum" className="text-[30px]" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-text-primary">No customer conversations yet.</h3>
            <p className="text-sm text-text-secondary max-w-md mx-auto">
              When customers message your business through WhatsApp or web chat, their conversations
              will appear here.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2.5 flex-wrap pt-2">
            <Button type="button" variant="default" size="sm" onClick={onOpenTestChat}>
              <AppIcon name="smart_toy" className="text-[15px]" />
              <span>Test AI Receptionist</span>
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
            {!whatsappConnected && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onNavigateSection('integrations')}
              >
                Connect WhatsApp
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-surface rounded-xl border border-border/70 shadow-xs overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[580px]">
          {/* -----------------------------------------------------------------
              LEFT PANEL: CONVERSATION INBOX (~25-30% -> 3 cols)
          ----------------------------------------------------------------- */}
          <div
            className={`lg:col-span-4 xl:col-span-3 border-r border-border/60 flex flex-col ${
              mobilePanel === 'inbox' ? 'flex' : 'hidden lg:flex'
            }`}
          >
            {/* Search & Filters */}
            <div className="p-3.5 border-b border-border/60 space-y-2.5 bg-surface-container-lowest">
              <div className="relative">
                <AppIcon
                  name="search"
                  className="text-[16px] text-text-secondary absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search name, phone, or message..."
                  className="w-full h-8 pl-8 pr-2.5 rounded-lg border border-border bg-surface text-xs text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <select
                  aria-label="Filter by conversation status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as ConversationStatusFilter)}
                  className="h-7 px-2 rounded-md border border-border bg-surface text-[11px] text-text-primary"
                >
                  <option value="all">Status: All</option>
                  <option value="agent_active">AI Handling</option>
                  <option value="needs_human">Needs Human</option>
                  <option value="staff_takeover">Human Handling</option>
                  <option value="resolved">Resolved</option>
                </select>

                <select
                  aria-label="Filter by channel"
                  value={channelFilter}
                  onChange={(e) => setChannelFilter(e.target.value as ChannelFilter)}
                  className="h-7 px-2 rounded-md border border-border bg-surface text-[11px] text-text-primary"
                >
                  <option value="all">Channel: All</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="web_chat">Web Chat</option>
                </select>
              </div>

              <div className="flex items-center justify-between gap-2">
                <select
                  aria-label="Filter by booking or payment context"
                  value={contextFilter}
                  onChange={(e) => setContextFilter(e.target.value as ContextFilter)}
                  className="flex-1 h-7 px-2 rounded-md border border-border bg-surface text-[11px] text-text-primary"
                >
                  <option value="all">Context: All threads</option>
                  <option value="has_booking">With bookings</option>
                  <option value="payment_issues">With payment issues</option>
                </select>

                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="text-[11px] font-semibold text-primary hover:underline cursor-pointer shrink-0"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Conversation List */}
            <div className="flex-1 overflow-y-auto divide-y divide-border/50 max-h-[540px]">
              {filteredConversations.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <p className="text-xs font-semibold text-text-primary">
                    No conversations match your search.
                  </p>
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="text-xs font-semibold text-primary hover:underline cursor-pointer"
                  >
                    Clear Filters
                  </button>
                </div>
              ) : (
                filteredConversations.map((conv) => {
                  const isSelected = selectedConversation?.id === conv.id;
                  const meta = getConversationStatusMeta(conv.status);

                  return (
                    <button
                      key={conv.id}
                      type="button"
                      onClick={() => {
                        setSelectedConversationId(conv.id);
                        setMobilePanel('chat');
                        if (conv.unread) {
                          onUpdateConversation(conv.id, (p) => ({ ...p, unread: false }));
                        }
                      }}
                      className={`w-full text-left p-3.5 transition-colors cursor-pointer space-y-1.5 ${
                        isSelected
                          ? 'bg-indigo-50/70 border-l-3 border-l-primary'
                          : 'hover:bg-surface-container-lowest'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {conv.unread && (
                            <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                          )}
                          <span className="font-semibold text-xs text-text-primary truncate">
                            {conv.customerName}
                          </span>
                        </div>
                        <span className="text-[10px] text-text-secondary shrink-0">
                          {conv.updatedAt}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] text-text-secondary">
                        <AppIcon
                          name={conv.channel === 'whatsapp' ? 'chat' : 'web'}
                          className="text-[13px] text-primary"
                        />
                        <span>{conv.channel === 'whatsapp' ? 'WhatsApp' : 'Web Chat'}</span>
                        <span>•</span>
                        <span className="font-mono">
                          {formatPhoneForRole(conv.customerPhone, userRole)}
                        </span>
                      </div>

                      <p className="text-xs text-text-secondary line-clamp-2 leading-snug">
                        {conv.lastMessage}
                      </p>

                      <div className="pt-0.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${meta.badgeClass}`}
                        >
                          <AppIcon name={meta.icon} className="text-[12px]" />
                          {meta.label}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* -----------------------------------------------------------------
              CENTER PANEL: CHAT HISTORY & COMPOSER (~45-50%)
          ----------------------------------------------------------------- */}
          <div
            className={`${
              showContextPanel ? 'lg:col-span-5 xl:col-span-6' : 'lg:col-span-8 xl:col-span-9'
            } flex flex-col border-r border-border/60 ${
              mobilePanel === 'chat' ? 'flex' : 'hidden lg:flex'
            }`}
          >
            {!selectedConversation ? (
              <div className="flex-1 flex flex-col items-center justify-center p-10 text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-surface-container-low text-text-secondary flex items-center justify-center">
                  <AppIcon name="chat_bubble_outline" className="text-[24px]" />
                </div>
                <h3 className="text-base font-bold text-text-primary">Select a conversation.</h3>
                <p className="text-xs text-text-secondary max-w-xs">
                  Choose a customer chat to view its messages and booking details.
                </p>
              </div>
            ) : (
              <>
                {/* Chat Header */}
                <div className="px-4 py-3 border-b border-border/60 bg-surface-container-lowest flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button
                      type="button"
                      onClick={() => setMobilePanel('inbox')}
                      className="lg:hidden p-1 rounded-md hover:bg-surface-container text-text-secondary"
                      aria-label="Back to inbox"
                    >
                      <AppIcon name="arrow_back" className="text-[18px]" />
                    </button>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="font-bold text-sm text-text-primary truncate">
                          {selectedConversation.customerName}
                        </h2>
                        {(() => {
                          const meta = getConversationStatusMeta(selectedConversation.status);
                          return (
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${meta.badgeClass}`}
                            >
                              <AppIcon name={meta.icon} className="text-[12px]" />
                              {meta.label}
                            </span>
                          );
                        })()}
                      </div>
                      <div className="text-[11px] text-text-secondary flex items-center gap-1.5 mt-0.5">
                        <span>
                          {selectedConversation.channel === 'whatsapp' ? 'WhatsApp' : 'Web Chat'}
                        </span>
                        <span>•</span>
                        <span>
                          Handler:{' '}
                          {selectedConversation.status === 'staff_takeover'
                            ? selectedConversation.assignedTo || operatorName
                            : selectedConversation.status === 'resolved'
                              ? selectedConversation.resolvedBy || 'Resolved'
                              : `${workspace.assistantName} (AI)`}
                        </span>
                        <span>•</span>
                        <span>{selectedConversation.updatedAt}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setMobilePanel('context')}
                      className="lg:hidden px-2.5 py-1 rounded-md border border-border bg-surface text-xs font-medium text-text-primary"
                    >
                      Details
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowContextPanel((prev) => !prev)}
                      className="hidden lg:inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-border bg-surface hover:bg-surface-container-low text-xs font-medium text-text-secondary cursor-pointer"
                    >
                      <AppIcon
                        name={showContextPanel ? 'right_panel_close' : 'right_panel_open'}
                        className="text-[15px]"
                      />
                      <span>{showContextPanel ? 'Hide Context' : 'Show Context'}</span>
                    </button>
                  </div>
                </div>

                {/* Messages & System Events Timeline */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-surface-container-lowest/40 max-h-[420px]">
                  {selectedConversation.messages.map((msg) => {
                    if (msg.sender === 'system') {
                      return (
                        <div key={msg.id} className="flex justify-center my-2">
                          <span className="px-3 py-1 rounded-full bg-surface-container text-[11px] text-text-secondary border border-border/60">
                            {msg.text} • {msg.time}
                          </span>
                        </div>
                      );
                    }

                    const isCustomer = msg.sender === 'customer';
                    const isStaff = msg.sender === 'staff';

                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isCustomer ? 'items-start' : 'items-end'}`}
                      >
                        <div className="flex items-center gap-1.5 text-[10px] text-text-secondary mb-1 px-1">
                          <AppIcon
                            name={isCustomer ? 'person' : isStaff ? 'support_agent' : 'smart_toy'}
                            className="text-[12px]"
                          />
                          <span className="font-semibold">
                            {isCustomer
                              ? selectedConversation.customerName
                              : isStaff
                                ? `${operatorName} (Staff)`
                                : `${workspace.assistantName} (AI)`}
                          </span>
                          <span>•</span>
                          <span>{msg.time}</span>
                        </div>

                        <div
                          className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed border ${
                            isCustomer
                              ? 'bg-surface border-border text-text-primary rounded-tl-xs'
                              : isStaff
                                ? 'bg-primary border-primary text-on-primary rounded-tr-xs'
                                : 'bg-indigo-50 border-indigo-200 text-indigo-950 rounded-tr-xs'
                          }`}
                        >
                          {msg.text}
                        </div>

                        {!isCustomer && (
                          <div className="text-[10px] mt-0.5 px-1 flex items-center gap-1">
                            {msg.deliveryState === 'failed' ? (
                              <span className="text-red-600 font-medium">
                                This message couldn&apos;t be delivered (WhatsApp disconnected).
                              </span>
                            ) : (
                              <span className="text-text-secondary capitalize">
                                {msg.deliveryState ?? 'sent'}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Verified Business System Events */}
                  {systemEvents.length > 0 && (
                    <div className="pt-3 border-t border-border/50 space-y-2">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-text-secondary text-center">
                        Verified Business Events
                      </div>
                      {systemEvents.map((ev) => (
                        <div
                          key={ev.id}
                          className={`rounded-xl border px-3 py-2 text-xs flex items-start gap-2 ${ev.tone}`}
                        >
                          <AppIcon name={ev.icon} className="text-[15px] mt-0.5 shrink-0" />
                          <div>
                            <span className="font-semibold">{ev.title}:</span>{' '}
                            <span>{ev.detail}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* State-Driven Composer (§8) */}
                <div className="p-3.5 border-t border-border/60 bg-surface">
                  {selectedConversation.status === 'agent_active' && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-container-low p-3 rounded-xl border border-border/60">
                      <div className="flex items-center gap-2 text-xs text-text-secondary">
                        <AppIcon
                          name="smart_toy"
                          className="text-[18px] text-emerald-600 shrink-0"
                        />
                        <span>
                          Your AI receptionist ({workspace.assistantName}) is currently handling
                          this conversation.
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        onClick={() => handleTakeOver(selectedConversation)}
                        className="shrink-0 h-8 text-xs"
                      >
                        Take Over Conversation
                      </Button>
                    </div>
                  )}

                  {selectedConversation.status === 'needs_human' && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-amber-50 p-3 rounded-xl border border-amber-200">
                      <div className="space-y-0.5 text-xs">
                        <div className="font-bold text-amber-900">
                          This customer needs assistance.
                        </div>
                        <div className="text-amber-800">
                          Reason: {selectedConversation.escalationReason || 'Requested team review'}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        onClick={() => handleTakeOver(selectedConversation)}
                        className="shrink-0 h-8 text-xs"
                      >
                        Take Over
                      </Button>
                    </div>
                  )}

                  {selectedConversation.status === 'staff_takeover' && (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2 flex-wrap text-[11px]">
                        <span className="text-indigo-800 font-semibold flex items-center gap-1">
                          <AppIcon name="support_agent" className="text-[14px]" />
                          Handled by {selectedConversation.assignedTo || operatorName} • AI replies
                          paused
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleReturnToAi(selectedConversation)}
                            className="text-primary font-semibold hover:underline cursor-pointer"
                          >
                            Return to AI
                          </button>
                          <span className="text-border">|</span>
                          <button
                            type="button"
                            onClick={() => handleMarkResolved(selectedConversation)}
                            className="text-emerald-700 font-semibold hover:underline cursor-pointer"
                          >
                            Mark Resolved
                          </button>
                        </div>
                      </div>

                      {selectedConversation.channel === 'whatsapp' && !whatsappConnected && (
                        <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                          WhatsApp Cloud API is not connected yet. Connect WhatsApp in Integrations
                          before sending live WhatsApp replies.
                        </p>
                      )}

                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={replyDraft}
                          onChange={(e) => setReplyDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleSendStaffReply(selectedConversation);
                            }
                          }}
                          placeholder={`Reply to ${selectedConversation.customerName} via ${
                            selectedConversation.channel === 'whatsapp' ? 'WhatsApp' : 'Web Chat'
                          }...`}
                          className="flex-1 h-9 px-3 rounded-lg border border-border bg-surface text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                        <Button
                          type="button"
                          variant="default"
                          size="sm"
                          disabled={!replyDraft.trim()}
                          onClick={() => handleSendStaffReply(selectedConversation)}
                          className="h-9 px-3 text-xs"
                        >
                          Send
                        </Button>
                      </div>
                    </div>
                  )}

                  {selectedConversation.status === 'resolved' && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-container-low p-3 rounded-xl border border-border/60 text-xs">
                      <span className="text-text-secondary">
                        Conversation marked as resolved. Full message history is preserved.
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleReturnToAi(selectedConversation)}
                        className="h-8 text-xs shrink-0"
                      >
                        Reopen for AI
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* -----------------------------------------------------------------
              RIGHT PANEL: CUSTOMER & BOOKING CONTEXT (~25-30%)
          ----------------------------------------------------------------- */}
          {(showContextPanel || mobilePanel === 'context') && (
            <div
              className={`lg:col-span-3 flex flex-col bg-surface-container-lowest/50 ${
                mobilePanel === 'context' ? 'flex' : 'hidden lg:flex'
              }`}
            >
              {mobilePanel === 'context' && (
                <div className="lg:hidden px-4 py-3 border-b border-border flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMobilePanel('chat')}
                    className="p-1 rounded-md hover:bg-surface-container text-text-secondary"
                    aria-label="Back to chat"
                  >
                    <AppIcon name="arrow_back" className="text-[18px]" />
                  </button>
                  <span className="font-bold text-sm text-text-primary">
                    Customer &amp; Booking Context
                  </span>
                </div>
              )}

              {!selectedConversation ? (
                <div className="p-6 text-center text-xs text-text-secondary">
                  Select a conversation to view customer and booking context.
                </div>
              ) : (
                <div className="p-4 space-y-5 overflow-y-auto max-h-[580px]">
                  {/* Section A — Customer Profile */}
                  <div className="space-y-2">
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
                      Customer Profile
                    </h3>
                    <div className="bg-surface p-3.5 rounded-xl border border-border/60 space-y-1.5 text-xs">
                      <div className="font-bold text-sm text-text-primary">
                        {selectedConversation.customerName}
                      </div>
                      <div className="font-mono text-text-secondary">
                        {formatPhoneForRole(selectedConversation.customerPhone, userRole)}
                      </div>
                      <div className="text-text-secondary">
                        Channel:{' '}
                        <strong>
                          {selectedConversation.channel === 'whatsapp' ? 'WhatsApp' : 'Web Chat'}
                        </strong>
                      </div>
                      <button
                        type="button"
                        onClick={() => onNavigateSection('customers')}
                        className="text-primary font-semibold hover:underline pt-1 inline-block cursor-pointer"
                      >
                        View Customer Profile →
                      </button>
                    </div>
                  </div>

                  {/* Section B — Appointment Information */}
                  <div className="space-y-2">
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
                      Appointment Information
                    </h3>
                    {!primaryBooking ? (
                      <div className="bg-surface p-3.5 rounded-xl border border-border/60 text-xs text-text-secondary">
                        No booking linked to this conversation yet.
                      </div>
                    ) : (
                      <div className="bg-surface p-3.5 rounded-xl border border-border/60 space-y-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-text-primary">
                            {primaryBooking.serviceName}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface-container text-text-primary capitalize">
                            {primaryBooking.status}
                          </span>
                        </div>
                        <div className="text-text-secondary">
                          Staff:{' '}
                          <strong className="text-text-primary">{primaryBooking.staffName}</strong>
                        </div>
                        <div className="text-text-secondary">
                          Time:{' '}
                          <strong className="text-text-primary">{primaryBooking.slotTime}</strong>
                        </div>
                        <div className="font-mono text-[11px] text-text-secondary">
                          Ref: {primaryBooking.reference}
                        </div>
                        {selectedLinkedBookings.length > 1 && (
                          <div className="text-[11px] text-text-secondary">
                            +{selectedLinkedBookings.length - 1} more booking(s) for this customer
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => onNavigateSection('bookings')}
                          className="text-primary font-semibold hover:underline pt-1 inline-block cursor-pointer"
                        >
                          View Booking →
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Section C — Deposit & Payment */}
                  {primaryBooking && (
                    <div className="space-y-2">
                      <h3 className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
                        Deposit &amp; Payment
                      </h3>
                      <div className="bg-surface p-3.5 rounded-xl border border-border/60 space-y-2.5 text-xs">
                        {primaryBooking.status === 'held' && (
                          <HoldBand
                            compact
                            status="held"
                            remainingSeconds={primaryBooking.holdSecondsRemaining ?? 900}
                            totalSeconds={900}
                            autoTick
                          />
                        )}

                        <div className="flex justify-between">
                          <span className="text-text-secondary">Expected Deposit</span>
                          <span className="font-bold text-text-primary">
                            {formatNairaFromKobo(primaryBooking.depositKobo)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-secondary">Verified Received</span>
                          <span className="font-bold text-emerald-700">
                            {primaryBooking.paymentStatus === 'verified'
                              ? formatNairaFromKobo(
                                  primaryBooking.verifiedAmountKobo ?? primaryBooking.depositKobo,
                                )
                              : formatNairaFromKobo(primaryBooking.verifiedAmountKobo ?? 0)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center pt-1 border-t border-border/50">
                          <span className="text-text-secondary">Payment Status</span>
                          {(() => {
                            const p = getPaymentLabel(primaryBooking.paymentStatus);
                            return (
                              <span className={`font-semibold ${p.className}`}>{p.label}</span>
                            );
                          })()}
                        </div>

                        {paymentCheckNotice?.bookingId === primaryBooking.id && (
                          <div
                            className={`p-2 rounded-lg text-[11px] border ${
                              paymentCheckNotice.tone === 'success'
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                : paymentCheckNotice.tone === 'issue'
                                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                                  : 'bg-indigo-50 border-indigo-200 text-indigo-900'
                            }`}
                          >
                            {paymentCheckNotice.text}
                          </div>
                        )}

                        {(primaryBooking.status === 'held' ||
                          primaryBooking.paymentStatus === 'pending_verification') && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={checkingPaymentId === primaryBooking.id}
                            onClick={() => void handleCheckBookingPayment(primaryBooking)}
                            className="w-full h-8 text-xs"
                          >
                            {checkingPaymentId === primaryBooking.id
                              ? 'Checking...'
                              : 'Check Payment Status'}
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Section D — Conversation Actions */}
                  <div className="space-y-2">
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
                      Actions
                    </h3>
                    <div className="space-y-1.5">
                      {(selectedConversation.status === 'agent_active' ||
                        selectedConversation.status === 'needs_human') && (
                        <Button
                          type="button"
                          variant="default"
                          size="sm"
                          onClick={() => handleTakeOver(selectedConversation)}
                          className="w-full h-8 text-xs"
                        >
                          Take Over Conversation
                        </Button>
                      )}
                      {selectedConversation.status === 'staff_takeover' && (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleReturnToAi(selectedConversation)}
                            className="w-full h-8 text-xs"
                          >
                            Return to AI
                          </Button>
                          <Button
                            type="button"
                            variant="default"
                            size="sm"
                            onClick={() => handleMarkResolved(selectedConversation)}
                            className="w-full h-8 text-xs bg-emerald-600 hover:bg-emerald-700"
                          >
                            Mark Resolved
                          </Button>
                        </>
                      )}
                      {selectedConversation.status === 'needs_human' && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => onNavigateSection('needs-attention')}
                          className="w-full h-8 text-xs"
                        >
                          Open Related Issue
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
