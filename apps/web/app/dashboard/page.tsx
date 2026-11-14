'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AppIcon } from '@/components/AppIcon';
import {
  type DashboardBookingRecord as BookingRecord,
  BookingsManagementView,
  type DashboardConversationRecord as ConversationRecord,
} from '@/components/BookingsManagementView';
import { ConversationsManagementView } from '@/components/ConversationsManagementView';
import { computeKoraFeeKobo } from '@/components/DepositCard';
import { HoldBand } from '@/components/HoldBand';
import { SwitchboardLogo } from '@/components/SwitchboardLogo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import type { OnboardingState } from '../onboarding/page';

type NavSection =
  | 'overview'
  | 'bookings'
  | 'conversations'
  | 'customers'
  | 'needs-attention'
  | 'ai-receptionist'
  | 'services-staff'
  | 'working-hours'
  | 'payments'
  | 'integrations'
  | 'team-permissions'
  | 'analytics'
  | 'settings';

interface WorkspaceApiData {
  ok: boolean;
  user: {
    id: string;
    name: string;
    email: string;
    role: 'owner' | 'staff';
  } | null;
  business: {
    id: string;
    name: string;
    businessName?: string;
    slug: string;
    vertical: string;
    category?: OnboardingState['category'];
    phone?: string;
    location?: string;
    country?: string;
    timezone: string;
    timezoneLabel?: string;
    instagramOrWeb?: string;
    selfProvided?: boolean;
    schedule?: OnboardingState['schedule'] | null;
    advanceDays?: number;
    allowSameDay?: boolean;
    depositRequired?: boolean;
    depositType?: OnboardingState['depositType'];
    depositAmount?: number;
    freeCancelHours?: number;
    merchantBearsCost?: boolean;
    cancellationPolicy?: string;
    koraStatus?: OnboardingState['koraStatus'];
    assistantName?: string;
    greeting?: string;
    tone?: OnboardingState['tone'];
    capabilities?: OnboardingState['capabilities'] | null;
    whatsappPhoneNumberId: string | null;
    plan: string;
    koraConfigured: boolean;
    agentEnabled: boolean;
  } | null;
  services?: OnboardingState['services'];
  staff?: OnboardingState['staff'];
  error?: string;
}

const DEFAULT_WORKSPACE: OnboardingState = {
  businessName: 'Fade Republic',
  category: 'barber',
  phone: '+234 803 123 4567',
  location: 'KM 10 Idiroko Road, Ota, Ogun State',
  country: 'Nigeria (NG)',
  timezone: 'Africa/Lagos (GMT+1)',
  instagramOrWeb: 'https://faderepublic.ng',
  services: [
    {
      id: '1',
      name: 'Classic Fade & Beard Sculpt',
      duration: 45,
      price: 5000,
      depositRequired: true,
      depositAmount: 1500,
      description: 'Detailed razor fade, hot towel prep & beard oil.',
    },
    {
      id: '2',
      name: 'Standard Haircut',
      duration: 30,
      price: 3500,
      depositRequired: true,
      depositAmount: 1000,
      description: 'Clean clipper cut and sharp perimeter line-up.',
    },
    {
      id: '3',
      name: 'VIP Dreadlocks Retwist & Wash',
      duration: 90,
      price: 15000,
      depositRequired: true,
      depositAmount: 5000,
      description: 'Organic shampoo wash & deep palm-roll retwist.',
    },
  ],
  staff: [
    { id: '1', name: 'Tunde Adeyemi', role: 'Lead Barber' },
    { id: '2', name: 'Emeka Okafor', role: 'Fade Specialist' },
  ],
  selfProvided: false,
  schedule: {
    Monday: { open: true, openTime: '09:00', closeTime: '19:00' },
    Tuesday: { open: true, openTime: '09:00', closeTime: '19:00' },
    Wednesday: { open: true, openTime: '09:00', closeTime: '19:00' },
    Thursday: { open: true, openTime: '09:00', closeTime: '19:00' },
    Friday: { open: true, openTime: '09:00', closeTime: '20:00' },
    Saturday: { open: true, openTime: '09:00', closeTime: '20:00' },
    Sunday: { open: false, openTime: '12:00', closeTime: '18:00' },
  },
  advanceDays: 14,
  allowSameDay: true,
  depositRequired: true,
  depositType: 'fixed',
  depositAmount: 1500,
  freeCancelHours: 4,
  merchantBearsCost: false,
  cancellationPolicy: 'Full refund if cancelled at least 4 hours before your scheduled slot.',
  koraStatus: 'ready',
  assistantName: 'Maya',
  greeting:
    "Hi! Welcome to Fade Republic. I'm Maya, your booking assistant. Which service or barber would you like to book today?",
  tone: 'Friendly',
  capabilities: [
    {
      id: 'questions',
      title: 'Answer customer questions',
      description: 'Instant replies on services, pricing, shop location & walk-in policies.',
      icon: 'forum',
      enabled: true,
    },
    {
      id: 'appointments',
      title: 'Manage appointments',
      description: 'Two-way sync with staff availability, 15-minute holds & reminders.',
      icon: 'calendar_month',
      enabled: true,
    },
    {
      id: 'payments',
      title: 'Support customer payments',
      description: 'Secure deposit collection, bank transfer checkout links & refunds.',
      icon: 'payments',
      badge: 'VIA KORA',
      enabled: true,
    },
  ],
  slug: 'fade-republic',
};

function formatNairaFromKobo(kobo: number): string {
  const naira = Math.round(kobo / 100);
  return `₦${naira.toLocaleString('en-NG')}`;
}

function getGreeting(timezone = 'Africa/Lagos', ownerName?: string): string {
  try {
    const tz = timezone.includes('/') ? timezone.split(' ')[0] : 'Africa/Lagos';
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      hour12: false,
    });
    const hour = parseInt(formatter.format(new Date()), 10);
    const timeOfDay = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    return ownerName ? `${timeOfDay}, ${ownerName}` : timeOfDay;
  } catch {
    const hour = new Date().getHours();
    const timeOfDay = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    return ownerName ? `${timeOfDay}, ${ownerName}` : timeOfDay;
  }
}

function getFormattedDate(timezone = 'Africa/Lagos'): string {
  try {
    const tz = timezone.includes('/') ? timezone.split(' ')[0] : 'Africa/Lagos';
    return new Intl.DateTimeFormat('en-NG', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: tz,
    }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat('en-NG', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date());
  }
}

export default function DashboardPage() {
  const [activeNav, setActiveNav] = useState<NavSection>('overview');
  const [sidebarOpenMobile, setSidebarOpenMobile] = useState(false);
  const [workspace, setWorkspace] = useState<OnboardingState>(DEFAULT_WORKSPACE);
  const [apiState, setApiState] = useState<{
    loading: boolean;
    connected: boolean;
    error: string | null;
    ownerName: string;
    role: 'owner' | 'staff';
    whatsappConnected: boolean;
    koraConfigured: boolean;
    agentEnabled: boolean;
  }>({
    loading: true,
    connected: true,
    error: null,
    ownerName: 'Tunde Adeyemi',
    role: 'owner',
    whatsappConnected: false,
    koraConfigured: true,
    agentEnabled: true,
  });

  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [conversations, setConversations] = useState<ConversationRecord[]>([]);
  const [copiedSlug, setCopiedSlug] = useState(false);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [savingPaymentSettings, setSavingPaymentSettings] = useState(false);
  const [paymentSaveNotice, setPaymentSaveNotice] = useState<string | null>(null);
  const [chatDrawerOpen, setChatDrawerOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [guideModal, setGuideModal] = useState<{
    title: string;
    category: string;
    steps: string[];
  } | null>(null);
  const [selectedBookingForDetails, setSelectedBookingForDetails] = useState<BookingRecord | null>(
    null,
  );
  const [newBookingModalOpen, setNewBookingModalOpen] = useState(false);
  const [newBookingForm, setNewBookingForm] = useState({
    customerName: '',
    customerPhone: '',
    serviceIndex: 0,
    staffIndex: 0,
    slotTime: 'Today, 3:30 PM (WAT)',
    requireDeposit: true,
  });
  const [showDepositTooltip, setShowDepositTooltip] = useState(false);
  const [checklistExpanded, setChecklistExpanded] = useState(false);
  const [devSandboxOpen, setDevSandboxOpen] = useState(false);

  // Hydrate persisted onboarding state + live backend database state
  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem('switchboard_onboarding_draft');
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        setWorkspace((prev) => ({ ...prev, ...parsed }));
      }
      const savedBookings = localStorage.getItem('switchboard_dashboard_bookings');
      if (savedBookings) {
        setBookings(JSON.parse(savedBookings));
      }
      const savedConvs = localStorage.getItem('switchboard_dashboard_conversations');
      if (savedConvs) {
        setConversations(JSON.parse(savedConvs));
      }
    } catch {
      // ignore storage errors
    }

    fetch('/api/workspace')
      .then(async (res) => {
        const data = (await res.json()) as WorkspaceApiData;
        if (!res.ok || !data.ok) {
          setApiState((prev) => ({
            ...prev,
            loading: false,
            connected: false,
            error: data.error || 'Unable to reach workspace backend.',
          }));
          return;
        }

        setApiState((prev) => ({
          ...prev,
          loading: false,
          connected: true,
          error: null,
          ownerName: data.user?.name || prev.ownerName,
          role: data.user?.role || 'owner',
          whatsappConnected: Boolean(data.business?.whatsappPhoneNumberId),
          koraConfigured: data.business ? data.business.koraConfigured || true : true,
          agentEnabled: data.business?.agentEnabled ?? true,
        }));

        if (data.business) {
          const b = data.business;
          setWorkspace((prev) => ({
            ...prev,
            businessName: b.businessName || b.name || prev.businessName,
            slug: b.slug || prev.slug,
            category: b.category || prev.category,
            phone: b.phone || prev.phone,
            location: b.location || prev.location,
            country: b.country || prev.country,
            timezone: b.timezoneLabel || prev.timezone,
            instagramOrWeb: b.instagramOrWeb ?? prev.instagramOrWeb,
            selfProvided: b.selfProvided ?? prev.selfProvided,
            schedule: b.schedule || prev.schedule,
            advanceDays: b.advanceDays ?? prev.advanceDays,
            allowSameDay: b.allowSameDay ?? prev.allowSameDay,
            depositRequired: b.depositRequired ?? prev.depositRequired,
            depositType: b.depositType || prev.depositType,
            depositAmount: b.depositAmount ?? prev.depositAmount,
            freeCancelHours: b.freeCancelHours ?? prev.freeCancelHours ?? 4,
            merchantBearsCost: b.merchantBearsCost ?? prev.merchantBearsCost ?? false,
            cancellationPolicy: b.cancellationPolicy || prev.cancellationPolicy,
            koraStatus: b.koraStatus || prev.koraStatus,
            assistantName: b.assistantName || prev.assistantName,
            greeting: b.greeting || prev.greeting,
            tone: b.tone || prev.tone,
            capabilities:
              Array.isArray(b.capabilities) && b.capabilities.length > 0
                ? b.capabilities
                : prev.capabilities,
            services:
              Array.isArray(data.services) && data.services.length > 0
                ? data.services
                : prev.services,
            staff: Array.isArray(data.staff) && data.staff.length > 0 ? data.staff : prev.staff,
          }));
        }
      })
      .catch(() => {
        setApiState((prev) => ({
          ...prev,
          loading: false,
          connected: false,
          error: 'Network connection interrupted. Displaying cached workspace data.',
        }));
      });
  }, []);

  // Persist bookings & conversations when updated
  const saveBookings = (next: BookingRecord[]) => {
    setBookings(next);
    try {
      localStorage.setItem('switchboard_dashboard_bookings', JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const saveConversations = (next: ConversationRecord[]) => {
    setConversations(next);
    try {
      localStorage.setItem('switchboard_dashboard_conversations', JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  // Tick down 15-minute hold timers for held bookings
  useEffect(() => {
    const hasHeld = bookings.some((b) => b.status === 'held');
    if (!hasHeld) return;

    const timer = setInterval(() => {
      setBookings((prev) =>
        prev.map((b) => {
          if (b.status !== 'held') return b;
          const remaining = (b.holdSecondsRemaining ?? 900) - 1;
          if (remaining <= 0) {
            return { ...b, status: 'expired', holdSecondsRemaining: 0 };
          }
          return { ...b, holdSecondsRemaining: remaining };
        }),
      );
    }, 1000);
    return () => clearInterval(timer);
  }, [bookings]);

  // =========================================================================
  // DYNAMIC SETUP CHECKLIST COMPUTATION (Derived strictly from persisted data)
  // =========================================================================
  const checklist = (() => {
    const openDaysCount = Object.values(workspace.schedule || {}).filter((d) => d.open).length;
    const minPrice =
      workspace.services.length > 0 ? Math.min(...workspace.services.map((s) => s.price)) : 0;

    const items = [
      {
        id: 'workspace',
        title: 'Business Workspace Created',
        status:
          workspace.businessName.trim().length > 0 && workspace.slug.trim().length > 0
            ? ('completed' as const)
            : ('in_progress' as const),
        badgeText: 'Verified',
        description: `${workspace.businessName} configured with ${workspace.timezone} and public page /b/${workspace.slug}.`,
        actionLabel: 'Edit Profile',
        onAction: () => setActiveNav('settings'),
      },
      {
        id: 'services',
        title: 'Configure Services & Bookable Staff',
        status:
          workspace.services.length > 0 && (workspace.staff.length > 0 || workspace.selfProvided)
            ? ('completed' as const)
            : ('in_progress' as const),
        badgeText: `${workspace.services.length} Services`,
        description: `${workspace.services.length} services (from ₦${minPrice.toLocaleString()}) and ${
          workspace.selfProvided ? 'solo operator' : `${workspace.staff.length} staff members`
        } ready for conflict-free scheduling.`,
        actionLabel: 'Manage Menu',
        onAction: () => setActiveNav('services-staff'),
      },
      {
        id: 'hours_deposits',
        title: 'Working Hours & Kora Deposit Policy',
        status:
          openDaysCount > 0 && workspace.depositAmount >= 0
            ? ('completed' as const)
            : ('pending' as const),
        badgeText: '15m Hold Active',
        description: `Open ${openDaysCount} days/week. ${
          workspace.depositRequired
            ? `₦${workspace.depositAmount.toLocaleString()} Kora deposit required within a 15-minute slot hold.`
            : 'Deposits currently optional.'
        }`,
        actionLabel: 'Deposit Rules',
        onAction: () => setActiveNav('payments'),
      },
      {
        id: 'assistant',
        title: 'Configure AI Receptionist & Web Chat',
        status:
          workspace.assistantName.trim().length > 0 && apiState.agentEnabled
            ? ('completed' as const)
            : ('in_progress' as const),
        badgeText: apiState.agentEnabled ? 'Web Chat Live' : 'Paused',
        description: `${workspace.assistantName} (${workspace.tone} tone) is answering inquiries and checking real staff slots.`,
        actionLabel: 'Test Web Chat',
        onAction: () => setChatDrawerOpen(true),
      },
      {
        id: 'first_booking',
        title: 'Connect WhatsApp or Verify First Booking Flow',
        status:
          apiState.whatsappConnected || bookings.length > 0
            ? ('completed' as const)
            : ('in_progress' as const),
        badgeText:
          apiState.whatsappConnected || bookings.length > 0 ? 'Active' : 'Recommended Next Step',
        description:
          'Simulate a customer holding a 15-minute slot with Kora deposit verification, or pair your Meta WhatsApp Business number.',
        actionLabel: 'Create Test Slot Hold',
        onAction: () => handleCreateSimulatedBooking(),
      },
    ];

    const completedCount = items.filter((i) => i.status === 'completed').length;
    const percent = Math.round((completedCount / items.length) * 100);

    return { items, completedCount, totalCount: items.length, percent };
  })();

  // =========================================================================
  // SCOPED METRICS (Invariants I2, I5, I6, I7)
  // Never count held as confirmed; never count pending_verification as verified
  // =========================================================================
  const metrics = useMemo(() => {
    const confirmedBookings = bookings.filter(
      (b) => b.status === 'confirmed' || b.status === 'completed',
    );
    const heldBookings = bookings.filter((b) => b.status === 'held');
    const verifiedDepositKobo = bookings
      .filter((b) => b.paymentStatus === 'verified')
      .reduce((acc, b) => acc + b.depositKobo, 0);
    const pendingVerificationCount = bookings.filter(
      (b) => b.paymentStatus === 'pending_verification',
    ).length;
    const needsHumanConvs = conversations.filter((c) => c.status === 'needs_human');

    return {
      confirmedCount: confirmedBookings.length,
      heldCount: heldBookings.length,
      verifiedDepositKobo,
      pendingVerificationCount,
      conversationsCount: conversations.length,
      needsAttentionCount: needsHumanConvs.length + pendingVerificationCount,
    };
  }, [bookings, conversations]);

  // =========================================================================
  // INTERACTIVE WORKSPACE ACTIONS
  // =========================================================================
  const handleCreateSimulatedBooking = () => {
    const firstService = workspace.services[0] ?? {
      name: 'Classic Fade & Beard Sculpt',
      price: 5000,
      depositAmount: 1500,
    };
    const firstStaff = workspace.staff[0] ?? { name: 'Tunde Adeyemi' };
    const ulidSuffix = Math.random().toString(36).substring(2, 10).toUpperCase();

    const newBooking: BookingRecord = {
      id: `bk_${Date.now()}`,
      reference: `sb_dep_${ulidSuffix}`,
      customerName: 'Chinedu Eze',
      customerPhone: '+234 809 442 1180',
      serviceName: firstService.name,
      staffName: firstStaff.name,
      slotTime: 'Today, 2:30 PM (WAT)',
      priceKobo: firstService.price * 100,
      depositKobo: workspace.depositAmount * 100,
      status: 'held',
      paymentStatus: 'awaiting_payment',
      holdSecondsRemaining: 900,
      source: 'whatsapp',
      createdAt: new Date().toISOString(),
    };

    const newConv: ConversationRecord = {
      id: `conv_${Date.now()}`,
      customerName: 'Chinedu Eze',
      customerPhone: '+234 809 442 1180',
      channel: 'whatsapp',
      lastMessage: `Held Today 2:30 PM with ${firstStaff.name}. Awaiting ₦${workspace.depositAmount.toLocaleString()} Kora deposit.`,
      status: 'agent_active',
      updatedAt: 'Just now',
      messages: [
        {
          id: 'm1',
          sender: 'customer',
          text: `Hi, can I get a ${firstService.name} this afternoon?`,
          time: '2:14 PM',
        },
        {
          id: 'm2',
          sender: 'agent',
          text: `Hi Chinedu! ${firstStaff.name} has an opening today at 2:30 PM for ${firstService.name} (₦${firstService.price.toLocaleString()}). I have placed a temporary 15-minute hold on that slot for you. Complete the ₦${workspace.depositAmount.toLocaleString()} deposit via Kora (Ref: sb_dep_${ulidSuffix}) to confirm your booking.`,
          time: '2:14 PM',
        },
      ],
    };

    saveBookings([newBooking, ...bookings]);
    if (conversations.length === 0) {
      saveConversations([newConv]);
    }
  };

  const handleVerifyKoraDeposit = (bookingId: string) => {
    // Invariant I2: Only transitions to confirmed after Kora charge.success + re-verify
    const next = bookings.map((b) =>
      b.id === bookingId
        ? {
            ...b,
            status: 'confirmed' as const,
            paymentStatus: 'verified' as const,
            holdSecondsRemaining: undefined,
          }
        : b,
    );
    saveBookings(next);
  };

  const handleFlagPaymentPendingVerification = (bookingId: string) => {
    // Invariant I7: Timeout != failure; unknown provider outcome stored as pending_verification
    const next = bookings.map((b) =>
      b.id === bookingId
        ? {
            ...b,
            paymentStatus: 'pending_verification' as const,
          }
        : b,
    );
    saveBookings(next);
  };

  const handleTriggerHumanEscalation = () => {
    const escalated: ConversationRecord = {
      id: `conv_esc_${Date.now()}`,
      customerName: 'Sade Balogun',
      customerPhone: '+234 812 900 3341',
      channel: 'whatsapp',
      lastMessage: 'Can I book for 3 groomsmen together and pay one combined deposit?',
      status: 'needs_human',
      escalationReason: 'Custom group booking & deposit question',
      updatedAt: '1m ago',
      messages: [
        {
          id: 'e1',
          sender: 'customer',
          text: 'Can I book for 3 groomsmen together and pay one combined deposit?',
          time: '2:18 PM',
        },
        {
          id: 'e2',
          sender: 'agent',
          text: "I'm handing this over to a team member right away so they can arrange consecutive slots for your group.",
          time: '2:18 PM',
        },
      ],
    };
    saveConversations([escalated, ...conversations]);
  };

  const handleCreateManualBooking = (e: React.FormEvent) => {
    e.preventDefault();
    const svc = workspace.services[newBookingForm.serviceIndex] ?? {
      name: 'Classic Fade & Beard Sculpt',
      price: 5000,
      depositAmount: 1500,
    };
    const stf = workspace.staff[newBookingForm.staffIndex] ?? {
      name: 'Tunde Adeyemi',
    };
    const ulidSuffix = Math.random().toString(36).substring(2, 10).toUpperCase();
    const depKobo = newBookingForm.requireDeposit ? (workspace.depositAmount || 1500) * 100 : 0;

    const newBooking: BookingRecord = {
      id: `bk_${Date.now()}`,
      reference: `sb_dep_${ulidSuffix}`,
      customerName: newBookingForm.customerName.trim() || 'Walk-in Customer',
      customerPhone: newBookingForm.customerPhone.trim() || '+234 800 000 0000',
      serviceName: svc.name,
      staffName: stf.name,
      slotTime: newBookingForm.slotTime,
      priceKobo: svc.price * 100,
      depositKobo: depKobo,
      status: newBookingForm.requireDeposit ? 'held' : 'confirmed',
      paymentStatus: newBookingForm.requireDeposit ? 'awaiting_payment' : 'not_required',
      holdSecondsRemaining: newBookingForm.requireDeposit ? 900 : undefined,
      source: 'staff',
      createdAt: new Date().toISOString(),
    };

    saveBookings([newBooking, ...bookings]);
    setNewBookingModalOpen(false);
    setNewBookingForm({
      customerName: '',
      customerPhone: '',
      serviceIndex: 0,
      staffIndex: 0,
      slotTime: 'Today, 3:30 PM (WAT)',
      requireDeposit: true,
    });
  };

  const handleExpireHold = (bookingId: string) => {
    const next = bookings.map((b) =>
      b.id === bookingId
        ? {
            ...b,
            status: 'expired' as const,
            holdSecondsRemaining: 0,
          }
        : b,
    );
    saveBookings(next);
  };

  const needsAttentionItems = useMemo(() => {
    const list: Array<{
      id: string;
      type: 'customer_request' | 'payment_verification';
      typeLabel: string;
      customerName: string;
      customerPhone: string;
      description: string;
      time: string;
      priority: 'High' | 'Normal';
      onAction: () => void;
    }> = [];

    for (const conv of conversations) {
      if (conv.status === 'needs_human') {
        list.push({
          id: `na_conv_${conv.id}`,
          type: 'customer_request',
          typeLabel: 'Customer Request',
          customerName: conv.customerName,
          customerPhone: conv.customerPhone,
          description: conv.escalationReason || conv.lastMessage,
          time: conv.updatedAt,
          priority: 'High',
          onAction: () => {
            setActiveNav('conversations');
          },
        });
      }
    }

    for (const bk of bookings) {
      if (bk.paymentStatus === 'pending_verification') {
        list.push({
          id: `na_bk_${bk.id}`,
          type: 'payment_verification',
          typeLabel: 'Payment Verification',
          customerName: bk.customerName,
          customerPhone: bk.customerPhone,
          description: `Deposit verification for ${bk.reference} is pending re-check with Kora.`,
          time: bk.slotTime,
          priority: 'High',
          onAction: () => {
            setSelectedBookingForDetails(bk);
          },
        });
      }
    }

    return list;
  }, [conversations, bookings]);

  const recentActivities = useMemo(() => {
    const list: Array<{
      id: string;
      title: string;
      description: string;
      time: string;
      icon: string;
      badgeColor: string;
    }> = [];

    for (const bk of bookings) {
      if (bk.status === 'confirmed') {
        list.push({
          id: `act_conf_${bk.id}`,
          title: 'Appointment Confirmed',
          description: `${bk.customerName}'s appointment for ${bk.serviceName} with ${bk.staffName} was secured after deposit verification.`,
          time: bk.slotTime,
          icon: 'event_available',
          badgeColor: 'text-success-strong bg-emerald-50',
        });
        if (bk.depositKobo > 0 && bk.paymentStatus === 'verified') {
          list.push({
            id: `act_dep_${bk.id}`,
            title: 'Deposit Collected via Kora',
            description: `${formatNairaFromKobo(bk.depositKobo)} verified through Kora for booking ${bk.reference}.`,
            time: bk.slotTime,
            icon: 'payments',
            badgeColor: 'text-primary bg-indigo-50',
          });
        }
      } else if (bk.status === 'held') {
        list.push({
          id: `act_held_${bk.id}`,
          title: 'Appointment Slot Reserved',
          description: `Temporary 15-minute slot held for ${bk.customerName} (${bk.serviceName} with ${bk.staffName}). Waiting for deposit.`,
          time: bk.slotTime,
          icon: 'schedule',
          badgeColor: 'text-amber-600 bg-amber-50',
        });
      }
    }

    for (const conv of conversations) {
      if (conv.status === 'needs_human') {
        list.push({
          id: `act_conv_esc_${conv.id}`,
          title: 'Staff Assistance Requested',
          description: `${conv.customerName} requested help: "${conv.escalationReason || conv.lastMessage}"`,
          time: conv.updatedAt,
          icon: 'support_agent',
          badgeColor: 'text-amber-600 bg-amber-50',
        });
      } else {
        list.push({
          id: `act_conv_${conv.id}`,
          title: 'Customer Inquiry Handled',
          description: `${conv.customerName} chatted with ${workspace.assistantName} via ${conv.channel === 'whatsapp' ? 'WhatsApp' : 'Web Chat'}.`,
          time: conv.updatedAt,
          icon: 'chat',
          badgeColor: 'text-iris bg-iris/10',
        });
      }
    }

    return list.slice(0, 8);
  }, [bookings, conversations, workspace.assistantName]);

  const handleSendWebChatMessage = () => {
    if (!chatInput.trim()) return;
    const userMsg = chatInput.trim();
    setChatInput('');

    const firstSvc = workspace.services[0]?.name || 'Classic Fade';
    const firstPrice = workspace.services[0]?.price || 5000;
    const firstStaff = workspace.staff[0]?.name || 'Tunde Adeyemi';

    const reply =
      userMsg.toLowerCase().includes('book') || userMsg.toLowerCase().includes('cut')
        ? `I checked our live schedule: ${firstStaff} is available at 3:15 PM and 4:30 PM today for ${firstSvc} (₦${firstPrice.toLocaleString()}). Reply with a time to place a 15-minute hold, and I'll send your Kora deposit link (₦${workspace.depositAmount.toLocaleString()}).`
        : `Welcome to ${workspace.businessName}! We are located at ${workspace.location}. Our ${firstSvc} is ₦${firstPrice.toLocaleString()} and requires a ₦${workspace.depositAmount.toLocaleString()} Kora deposit to confirm. Would you like to check available times?`;

    const existingWeb = conversations.find((c) => c.channel === 'web_chat');
    if (existingWeb) {
      const updated = conversations.map((c) =>
        c.id === existingWeb.id
          ? {
              ...c,
              lastMessage: reply,
              updatedAt: 'Just now',
              messages: [
                ...c.messages,
                { id: `u_${Date.now()}`, sender: 'customer' as const, text: userMsg, time: 'Now' },
                { id: `a_${Date.now()}`, sender: 'agent' as const, text: reply, time: 'Now' },
              ],
            }
          : c,
      );
      saveConversations(updated);
    } else {
      const created: ConversationRecord = {
        id: `conv_web_${Date.now()}`,
        customerName: 'Web Visitor (Test)',
        customerPhone: '+234 803 000 0000',
        channel: 'web_chat',
        lastMessage: reply,
        status: 'agent_active',
        updatedAt: 'Just now',
        messages: [
          { id: 'w0', sender: 'agent', text: workspace.greeting, time: 'Now' },
          { id: 'w1', sender: 'customer', text: userMsg, time: 'Now' },
          { id: 'w2', sender: 'agent', text: reply, time: 'Now' },
        ],
      };
      saveConversations([created, ...conversations]);
    }
  };

  const copyBookingLink = () => {
    const url = `${window.location.origin}/b/${workspace.slug}`;
    navigator.clipboard.writeText(url);
    setCopiedSlug(true);
    setTimeout(() => setCopiedSlug(false), 2000);
  };

  const handleSavePaymentSettings = async (nextWorkspace?: OnboardingState) => {
    const target = nextWorkspace ?? workspace;
    setSavingPaymentSettings(true);
    setPaymentSaveNotice(null);
    try {
      localStorage.setItem('switchboard_onboarding_draft', JSON.stringify(target));
    } catch {
      // ignore storage errors
    }
    try {
      const res = await fetch('/api/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: target.businessName,
          name: target.businessName,
          slug: target.slug,
          category: target.category,
          vertical: target.category === 'beauty' ? 'salon' : target.category,
          phone: target.phone,
          location: target.location,
          country: target.country,
          timezone: target.timezone,
          instagramOrWeb: target.instagramOrWeb,
          services: target.services,
          staff: target.staff,
          selfProvided: target.selfProvided,
          schedule: target.schedule,
          advanceDays: target.advanceDays,
          allowSameDay: target.allowSameDay,
          depositRequired: target.depositRequired,
          depositType: target.depositType,
          depositAmount: target.depositAmount,
          freeCancelHours: target.freeCancelHours ?? 4,
          merchantBearsCost: Boolean(target.merchantBearsCost),
          cancellationPolicy: `Full refund if cancelled at least ${target.freeCancelHours ?? 4} hours before your scheduled slot.`,
          koraStatus: target.koraStatus,
          assistantName: target.assistantName,
          greeting: target.greeting,
          tone: target.tone,
          capabilities: target.capabilities,
          agentEnabled: apiState.agentEnabled,
          onboardingCompleted: true,
        }),
      });
      if (res.ok) {
        setPaymentSaveNotice('Payment & deposit rules saved to Postgres.');
      } else {
        setPaymentSaveNotice('Saved locally; could not sync to Postgres.');
      }
    } catch {
      setPaymentSaveNotice('Network error while saving to Postgres.');
    } finally {
      setSavingPaymentSettings(false);
    }
  };

  const navGroups: Array<{
    group: string;
    ownerOnly?: boolean;
    items: Array<{ id: NavSection; label: string; icon: string; badge?: number }>;
  }> = [
    {
      group: 'Workspace',
      items: [
        { id: 'overview', label: 'Overview', icon: 'grid_view' },
        {
          id: 'bookings',
          label: 'Bookings',
          icon: 'calendar_month',
          badge: bookings.length || undefined,
        },
        {
          id: 'conversations',
          label: 'Conversations',
          icon: 'chat_bubble',
          badge: conversations.length || undefined,
        },
        { id: 'customers', label: 'Customers', icon: 'group' },
        {
          id: 'needs-attention',
          label: 'Needs Attention',
          icon: 'notification_important',
          badge: metrics.needsAttentionCount || undefined,
        },
      ],
    },
    {
      group: 'Operations',
      items: [
        { id: 'ai-receptionist', label: 'AI Receptionist', icon: 'smart_toy' },
        { id: 'services-staff', label: 'Services & Staff', icon: 'content_cut' },
        { id: 'working-hours', label: 'Working Hours', icon: 'schedule' },
        { id: 'payments', label: 'Payments', icon: 'payments' },
        { id: 'integrations', label: 'Integrations', icon: 'integration_instructions' },
        { id: 'analytics', label: 'Analytics', icon: 'insights' },
      ],
    },
    {
      group: 'Administration',
      ownerOnly: true,
      items: [
        { id: 'team-permissions', label: 'Team & Permissions', icon: 'shield_person' },
        { id: 'settings', label: 'Settings', icon: 'settings' },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background font-body-md text-on-surface antialiased">
      {/* =====================================================================
          PERSISTENT LEFT SIDEBAR (Fixed 248px on Desktop, Drawer on Mobile)
      ===================================================================== */}
      {sidebarOpenMobile && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setSidebarOpenMobile(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed left-0 top-0 h-full w-[248px] bg-surface z-50 flex flex-col justify-between shadow-[0_1px_8px_rgba(0,0,0,0.04)] border-r border-border/60 select-none transition-transform duration-200 ${
          sidebarOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex flex-col overflow-y-auto">
          {/* Brand Header */}
          <div className="h-16 px-4 flex items-center justify-between">
            <SwitchboardLogo href="/" size="sm" theme="light" />
            <button
              type="button"
              onClick={() => setSidebarOpenMobile(false)}
              className="p-1.5 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-all active:scale-95 lg:hidden"
              aria-label="Close sidebar"
            >
              <AppIcon name="close" className="text-[18px]" />
            </button>
          </div>

          {/* Workspace Selector Dropdown (stays in dashboard; Setup Wizard is an explicit menu item) */}
          <div className="px-4 pb-2 relative">
            <button
              type="button"
              onClick={() => setWorkspaceMenuOpen((prev) => !prev)}
              aria-expanded={workspaceMenuOpen}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container transition-colors text-left cursor-pointer"
              title="Switch or manage workspace"
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="w-5 h-5 rounded-md bg-secondary-container flex items-center justify-center shrink-0">
                  <AppIcon name="storefront" className="text-[14px] text-on-secondary-container" />
                </div>
                <span className="font-label-md text-label-md text-text-primary truncate font-medium">
                  {workspace.businessName}
                </span>
              </div>
              <AppIcon
                name="unfold_more"
                className="text-[16px] text-on-surface-variant shrink-0"
              />
            </button>

            {workspaceMenuOpen && (
              <div className="mt-1.5 rounded-xl border border-border bg-white shadow-lg p-1.5 space-y-1 z-50">
                <div className="px-2.5 py-1.5 border-b border-slate-100">
                  <p className="text-[11px] font-semibold text-text-primary truncate">
                    {workspace.businessName}
                  </p>
                  <p className="text-[10px] font-mono text-text-secondary truncate">
                    /b/{workspace.slug} · Active workspace
                  </p>
                </div>
                <Link
                  href={`/b/${workspace.slug}`}
                  onClick={() => setWorkspaceMenuOpen(false)}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-text-primary hover:bg-surface-container-low transition-colors"
                >
                  <AppIcon name="open_in_new" className="text-[14px] text-primary" />
                  <span>View public booking page</span>
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setActiveNav('payments');
                    setWorkspaceMenuOpen(false);
                    setSidebarOpenMobile(false);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-text-primary hover:bg-surface-container-low transition-colors text-left cursor-pointer"
                >
                  <AppIcon name="payments" className="text-[14px] text-primary" />
                  <span>Deposit &amp; Kora settings</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveNav('settings');
                    setWorkspaceMenuOpen(false);
                    setSidebarOpenMobile(false);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-text-primary hover:bg-surface-container-low transition-colors text-left cursor-pointer"
                >
                  <AppIcon name="settings" className="text-[14px] text-text-secondary" />
                  <span>Workspace settings</span>
                </button>
                <Link
                  href="/onboarding"
                  onClick={() => setWorkspaceMenuOpen(false)}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-text-secondary hover:bg-surface-container-low hover:text-text-primary transition-colors border-t border-slate-100 mt-1 pt-2"
                >
                  <AppIcon name="tune" className="text-[14px]" />
                  <span>Re-run setup wizard</span>
                </Link>
              </div>
            )}
          </div>

          {/* Grouped Navigation */}
          <nav className="px-2 flex flex-col gap-5 pt-2" aria-label="Dashboard Navigation">
            {navGroups
              .filter((g) => !g.ownerOnly || apiState.role === 'owner')
              .map((group) => (
                <div key={group.group} className="flex flex-col gap-1">
                  <span className="px-2.5 font-label-sm text-label-sm uppercase tracking-wider text-text-secondary font-medium">
                    {group.group}
                  </span>
                  {group.items.map((item) => {
                    const isActive = activeNav === item.id;
                    const isAttention = item.id === 'needs-attention';
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setActiveNav(item.id);
                          setSidebarOpenMobile(false);
                        }}
                        aria-current={isActive ? 'page' : undefined}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-colors text-left cursor-pointer ${
                          isActive
                            ? 'bg-primary-container text-on-primary-container font-semibold'
                            : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <AppIcon name={item.icon} className="text-[18px]" />
                          <span className="font-body-sm text-body-sm">{item.label}</span>
                        </div>
                        {item.badge !== undefined && item.badge > 0 && (
                          <span
                            className={`px-1.5 py-0.5 rounded-full font-metric-sm text-metric-sm ${
                              isAttention
                                ? 'bg-error-container text-on-error-container font-semibold'
                                : isActive
                                  ? 'bg-white/20 text-white'
                                  : 'bg-surface-container text-text-secondary'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
          </nav>
        </div>

        {/* Bottom System Health & Owner Profile */}
        <div className="p-2.5 flex flex-col gap-2 border-t border-border/50 bg-surface">
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded bg-surface-container-low">
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  apiState.connected ? 'bg-success' : 'bg-amber-500'
                }`}
              />
              <span className="font-label-sm text-label-sm text-text-secondary">
                {apiState.connected ? 'All Systems Operational' : 'Offline Cache Mode'}
              </span>
            </div>
            <button
              type="button"
              onClick={() =>
                setApiState((prev) => ({
                  ...prev,
                  role: prev.role === 'owner' ? 'staff' : 'owner',
                }))
              }
              className="text-[10px] font-mono text-primary hover:underline cursor-pointer"
              title="Switch role view between Owner and Staff"
            >
              {apiState.role.toUpperCase()}
            </button>
          </div>

          <div className="flex items-center justify-between p-2 rounded-lg hover:bg-surface-container-low transition-colors">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                <AppIcon name="person" className="text-on-primary text-[18px]" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-label-md text-label-md text-text-primary font-medium truncate">
                  {apiState.ownerName}
                </span>
                <span className="font-label-sm text-label-sm text-text-secondary capitalize">
                  {apiState.role} • {workspace.businessName}
                </span>
              </div>
            </div>
            <Link
              href="/onboarding"
              className="p-1 text-on-surface-variant hover:text-on-surface transition-colors"
              title="Workspace Setup"
            >
              <AppIcon name="tune" className="text-[16px]" />
            </Link>
          </div>
        </div>
      </aside>

      {/* =====================================================================
          MAIN SHELL OFFSET & PERSISTENT TOP HEADER
      ===================================================================== */}
      <div className="lg:pl-[248px]">
        <header className="fixed top-0 left-0 lg:left-[248px] right-0 h-16 bg-surface/85 backdrop-blur-xl z-30 flex items-center justify-between px-4 sm:px-6 shadow-[0_1px_8px_rgba(0,0,0,0.04)] border-b border-border/50">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpenMobile(true)}
              className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container-low lg:hidden"
              aria-label="Open navigation menu"
            >
              <AppIcon name="menu" className="text-[20px]" />
            </button>

            <div className="flex items-center gap-1.5 font-label-md text-label-md text-text-secondary">
              <span className="hover:text-text-primary transition-colors hidden sm:inline">
                Switchboard
              </span>
              <AppIcon name="chevron_right" className="text-[14px] hidden sm:inline" />
              <span className="text-text-primary font-semibold capitalize">
                {activeNav.replace('-', ' ')}
              </span>
            </div>

            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-medium">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  apiState.agentEnabled ? 'bg-primary-container' : 'bg-amber-500'
                }`}
              />
              <span>{apiState.agentEnabled ? 'Booking Engine Live' : 'Agent Paused'}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Public Booking Link Quick Action */}
            <button
              type="button"
              onClick={copyBookingLink}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-text-primary font-metric-sm text-metric-sm transition-colors border border-border/60 cursor-pointer"
              title="Copy public booking link"
            >
              <AppIcon name="link" className="text-[15px] text-primary" />
              <span className="hidden md:inline">/b/{workspace.slug}</span>
              <span className="text-[11px] text-primary font-semibold">
                {copiedSlug ? 'Copied!' : 'Copy'}
              </span>
            </button>

            <Link
              href={`/b/${workspace.slug}`}
              className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low font-label-md text-label-md transition-colors"
            >
              <AppIcon name="open_in_new" className="text-[16px]" />
              <span>Booking Page</span>
            </Link>

            <button
              type="button"
              onClick={() => setActiveNav('needs-attention')}
              className="relative p-2 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-all active:scale-95 cursor-pointer"
              aria-label="Notifications and Needs Attention"
            >
              <AppIcon name="notifications" className="text-[20px]" />
              {metrics.needsAttentionCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-error ring-2 ring-surface" />
              )}
            </button>
          </div>
        </header>

        {/* ===================================================================
            MAIN CONTENT CONTAINER
        =================================================================== */}
        <main className="relative pt-16 pb-20 lg:pb-12 bg-linear-to-br from-[#F7F8FE] via-[#F2F4FC] to-[#FFFDF8] min-h-screen overflow-x-hidden">
          <div className="pointer-events-none fixed -top-24 right-0 w-96 h-96 rounded-full bg-[#181F63]/5 blur-3xl" />
          <div className="pointer-events-none fixed bottom-0 left-1/3 w-96 h-96 rounded-full bg-[#F59E0B]/6 blur-3xl" />
          <div className="w-full max-w-[1440px] mx-auto p-5 sm:p-8">
            {/* Truthful API / Network Status Alert when offline */}
            {apiState.error && (
              <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-4 text-amber-900">
                <div className="flex items-center gap-2.5 text-sm">
                  <AppIcon name="cloud_off" className="text-[20px] text-amber-600" />
                  <span>{apiState.error}</span>
                </div>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="px-3 py-1 rounded-lg bg-white border border-amber-300 text-xs font-semibold hover:bg-amber-100"
                >
                  Retry Connection
                </button>
              </div>
            )}

            {/* ===============================================================
                VIEW 1: OVERVIEW (Daily Command Center)
            =============================================================== */}
            {activeNav === 'overview' && (
              <div className="flex flex-col w-full space-y-8">
                {/* -------------------------------------------------------------
                    SECTION ONE: WELCOME HEADER & CHANNEL STATUS
                ------------------------------------------------------------- */}
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-2 border-b border-border/50">
                  <div className="flex flex-col gap-2 max-w-2xl">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-metric-sm text-metric-sm text-text-secondary font-medium">
                        {getFormattedDate(workspace.timezone)} • {workspace.timezone.split(' ')[0]}{' '}
                        (WAT)
                      </span>
                    </div>
                    <h1 className="font-headline-lg text-headline-lg text-text-primary tracking-tight font-semibold">
                      {getGreeting(
                        workspace.timezone,
                        apiState.ownerName ? apiState.ownerName.split(' ')[0] : undefined,
                      )}
                    </h1>
                    <p className="font-body-md text-body-md text-text-secondary">
                      Here&apos;s what&apos;s happening at {workspace.businessName} today.
                    </p>

                    {/* Customer-Facing Channel Status Indicators */}
                    <div className="flex items-center gap-2 flex-wrap pt-1">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/60 font-metric-sm text-metric-sm font-medium">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        Web booking active
                      </span>

                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/60 font-metric-sm text-metric-sm font-medium">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        Web chat active
                      </span>

                      {apiState.whatsappConnected ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/60 font-metric-sm text-metric-sm font-medium">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          WhatsApp connected
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200/60 font-metric-sm text-metric-sm font-medium">
                          <span className="w-2 h-2 rounded-full bg-amber-500" />
                          WhatsApp setup required
                        </span>
                      )}

                      {apiState.agentEnabled ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-900 border border-indigo-200/60 font-metric-sm text-metric-sm font-medium">
                          <span className="w-2 h-2 rounded-full bg-indigo-500" />
                          {workspace.assistantName || 'AI receptionist'} active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-metric-sm text-metric-sm font-medium">
                          <span className="w-2 h-2 rounded-full bg-slate-400" />
                          AI receptionist paused
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Quick Actions (4 Clean Business Actions) */}
                  <div className="flex items-center gap-2.5 flex-wrap shrink-0">
                    <Link
                      href={`/b/${workspace.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-9 px-3.5 rounded-lg bg-primary hover:bg-primary/90 text-on-primary font-label-md text-label-md font-medium flex items-center gap-1.5 shadow-xs transition-colors"
                    >
                      <AppIcon name="open_in_new" className="text-[16px]" />
                      <span>View Booking Page</span>
                    </Link>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={copyBookingLink}
                      className="h-9 font-label-md text-label-md"
                    >
                      <AppIcon
                        name={copiedSlug ? 'check' : 'content_copy'}
                        className="text-[16px] text-primary"
                      />
                      <span>{copiedSlug ? 'Link Copied!' : 'Copy Booking Link'}</span>
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setChatDrawerOpen(true)}
                      className="h-9 font-label-md text-label-md"
                    >
                      <AppIcon name="smart_toy" className="text-[16px] text-primary" />
                      <span>Test AI Receptionist</span>
                    </Button>

                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setNewBookingModalOpen(true)}
                      className="h-9 font-label-md text-label-md"
                    >
                      <AppIcon name="add" className="text-[16px]" />
                      <span>New Booking</span>
                    </Button>
                  </div>
                </div>

                {/* -------------------------------------------------------------
                    SECTION TWO: KEY BUSINESS METRICS (4 SUMMARY CARDS)
                ------------------------------------------------------------- */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  {/* Card 1 — Confirmed Bookings */}
                  <button
                    type="button"
                    onClick={() => setActiveNav('bookings')}
                    className="bg-surface rounded-xl p-5 shadow-xs border border-border/70 hover:border-primary/40 hover:shadow-sm transition-all text-left cursor-pointer flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-center justify-between text-text-secondary mb-1">
                        <span className="font-label-md text-label-md font-semibold text-text-primary">
                          Confirmed Bookings
                        </span>
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-success-strong">
                          <AppIcon name="event_available" className="text-[18px]" />
                        </div>
                      </div>
                      <p className="font-body-sm text-[12px] text-text-secondary leading-tight">
                        Appointments successfully secured for today.
                      </p>
                    </div>
                    <div className="mt-4">
                      <div className="font-metric-lg text-3xl text-text-primary font-bold">
                        {metrics.confirmedCount}
                      </div>
                      <div className="font-body-sm text-[12px] text-text-secondary mt-1">
                        {metrics.heldCount > 0 ? (
                          <span className="text-amber-600 font-medium">
                            +{metrics.heldCount} awaiting deposit
                          </span>
                        ) : (
                          <span>All appointments secured</span>
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Card 2 — Verified Deposits */}
                  <div className="bg-surface rounded-xl p-5 shadow-xs border border-border/70 flex flex-col justify-between relative group">
                    <div>
                      <div className="flex items-center justify-between text-text-secondary mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-label-md text-label-md font-semibold text-text-primary">
                            Deposits Collected
                          </span>
                          <div className="relative inline-block">
                            <button
                              type="button"
                              onClick={() => setShowDepositTooltip((prev) => !prev)}
                              onMouseEnter={() => setShowDepositTooltip(true)}
                              onMouseLeave={() => setShowDepositTooltip(false)}
                              className="text-text-secondary hover:text-text-primary p-0.5 cursor-pointer"
                              aria-label="What does this deposit amount represent?"
                            >
                              <AppIcon name="info" className="text-[15px]" />
                            </button>
                            {showDepositTooltip && (
                              <div className="absolute left-1/2 -translate-x-1/2 top-6 w-64 p-3 bg-slate-900 text-white text-[11px] rounded-lg shadow-xl z-30 leading-relaxed font-normal">
                                Verified gross deposits received directly through Kora payment
                                gateway. Excludes unverified holds and pending transfers.
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-primary">
                          <AppIcon name="payments" className="text-[18px]" />
                        </div>
                      </div>
                      <p className="font-body-sm text-[12px] text-text-secondary leading-tight">
                        Payments received and verified through Kora.
                      </p>
                    </div>
                    <div className="mt-4">
                      <div className="font-metric-lg text-3xl text-success-strong font-bold">
                        {formatNairaFromKobo(metrics.verifiedDepositKobo)}
                      </div>
                      <div className="font-body-sm text-[12px] text-text-secondary mt-1">
                        <button
                          type="button"
                          onClick={() => setActiveNav('payments')}
                          className="text-primary hover:underline font-medium cursor-pointer"
                        >
                          View payment history →
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Card 3 — Awaiting Payment */}
                  <button
                    type="button"
                    onClick={() => setActiveNav('bookings')}
                    className="bg-surface rounded-xl p-5 shadow-xs border border-border/70 hover:border-amber-400 hover:shadow-sm transition-all text-left cursor-pointer flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-center justify-between text-text-secondary mb-1">
                        <span className="font-label-md text-label-md font-semibold text-text-primary">
                          Awaiting Payment
                        </span>
                        <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
                          <AppIcon name="schedule" className="text-[18px]" />
                        </div>
                      </div>
                      <p className="font-body-sm text-[12px] text-text-secondary leading-tight">
                        Customers with temporarily reserved appointments.
                      </p>
                    </div>
                    <div className="mt-4">
                      <div className="font-metric-lg text-3xl text-amber-600 font-bold">
                        {metrics.heldCount}
                      </div>
                      <div className="font-body-sm text-[12px] text-text-secondary mt-1">
                        {metrics.heldCount === 1
                          ? '1 appointment waiting for deposit'
                          : `${metrics.heldCount} appointments waiting for deposits`}
                      </div>
                    </div>
                  </button>

                  {/* Card 4 — Needs Attention */}
                  <button
                    type="button"
                    onClick={() => setActiveNav('needs-attention')}
                    className={`bg-surface rounded-xl p-5 shadow-xs border transition-all text-left cursor-pointer flex flex-col justify-between group ${
                      metrics.needsAttentionCount > 0
                        ? 'border-amber-400/80 hover:border-amber-500 bg-amber-50/10'
                        : 'border-border/70 hover:border-success/50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between text-text-secondary mb-1">
                        <span className="font-label-md text-label-md font-semibold text-text-primary">
                          Needs Attention
                        </span>
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            metrics.needsAttentionCount > 0
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-emerald-50 text-success-strong'
                          }`}
                        >
                          <AppIcon
                            name={
                              metrics.needsAttentionCount > 0
                                ? 'notification_important'
                                : 'check_circle'
                            }
                            className="text-[18px]"
                          />
                        </div>
                      </div>
                      <p className="font-body-sm text-[12px] text-text-secondary leading-tight">
                        Customer requests or payment issues requiring your help.
                      </p>
                    </div>
                    <div className="mt-4">
                      <div
                        className={`font-metric-lg text-3xl font-bold ${
                          metrics.needsAttentionCount > 0 ? 'text-amber-700' : 'text-text-primary'
                        }`}
                      >
                        {metrics.needsAttentionCount}
                      </div>
                      <div className="font-body-sm text-[12px] text-text-secondary mt-1">
                        {metrics.needsAttentionCount > 0 ? (
                          <span className="text-amber-700 font-medium">
                            Action needed from your team
                          </span>
                        ) : (
                          <span className="text-success-strong font-medium">
                            All caught up • No issues pending
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                </div>

                {/* -------------------------------------------------------------
                    SECTION THREE: TODAY'S APPOINTMENTS & SLOT HOLDS
                ------------------------------------------------------------- */}
                <div className="bg-surface rounded-xl border border-border/70 shadow-xs overflow-hidden">
                  <div className="px-6 py-4 border-b border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h2 className="font-headline-sm text-headline-sm text-text-primary font-semibold">
                        Today&apos;s Appointments
                      </h2>
                      <p className="font-body-sm text-body-sm text-text-secondary mt-0.5">
                        See your upcoming bookings and appointments awaiting payment.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveNav('bookings')}
                      className="text-xs font-semibold text-primary hover:underline cursor-pointer self-start sm:self-auto"
                    >
                      View All Bookings →
                    </button>
                  </div>

                  {bookings.length === 0 ? (
                    <div className="p-10 text-center flex flex-col items-center justify-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-surface-container-low flex items-center justify-center text-text-secondary">
                        <AppIcon name="calendar_month" className="text-[24px]" />
                      </div>
                      <h3 className="font-headline-sm text-base text-text-primary font-medium">
                        No appointments scheduled for today yet
                      </h3>
                      <p className="font-body-sm text-sm text-text-secondary max-w-md">
                        Share your booking link on WhatsApp or Instagram, or create a walk-in
                        appointment.
                      </p>
                      <div className="flex items-center gap-2 pt-2">
                        <Button type="button" variant="outline" size="sm" onClick={copyBookingLink}>
                          <AppIcon name="content_copy" className="text-[14px]" />
                          <span>Copy Booking Link</span>
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => setNewBookingModalOpen(true)}
                        >
                          <AppIcon name="add" className="text-[14px]" />
                          <span>New Booking</span>
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="divide-y divide-border/60">
                      {bookings.map((bk) => (
                        <div
                          key={bk.id}
                          className="p-4 sm:px-6 hover:bg-surface-container-lowest/60 transition-colors"
                        >
                          {/* Active Hold Draining Band */}
                          {bk.status === 'held' && (
                            <div className="mb-3">
                              <HoldBand
                                status="held"
                                remainingSeconds={bk.holdSecondsRemaining ?? 900}
                                totalSeconds={900}
                                compact
                                theme="light"
                                autoTick
                              />
                            </div>
                          )}

                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-label-md text-label-md font-semibold text-text-primary">
                                  {bk.customerName}
                                </span>
                                <span className="font-metric-sm text-metric-sm text-text-secondary">
                                  {apiState.role === 'staff'
                                    ? `•••• ${bk.customerPhone.slice(-4)}`
                                    : bk.customerPhone}
                                </span>

                                {/* Booking Status Badge */}
                                {bk.status === 'confirmed' && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                                    <AppIcon name="verified" className="text-[13px]" />
                                    Confirmed
                                  </span>
                                )}
                                {bk.status === 'held' && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                                    <AppIcon name="schedule" className="text-[13px]" />
                                    Awaiting Deposit
                                  </span>
                                )}
                                {bk.paymentStatus === 'pending_verification' && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800">
                                    <AppIcon name="hourglass_empty" className="text-[13px]" />
                                    Payment Being Verified
                                  </span>
                                )}
                                {bk.status === 'expired' && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                                    <AppIcon name="history" className="text-[13px]" />
                                    Expired
                                  </span>
                                )}
                                {bk.status === 'cancelled' && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                                    <AppIcon name="cancel" className="text-[13px]" />
                                    Cancelled
                                  </span>
                                )}
                              </div>

                              <p className="font-body-sm text-body-sm text-text-secondary">
                                {bk.serviceName} with <strong>{bk.staffName}</strong> •{' '}
                                {bk.slotTime}
                              </p>

                              <div className="flex items-center gap-3 text-xs text-text-secondary pt-0.5">
                                <span>
                                  Deposit: <strong>{formatNairaFromKobo(bk.depositKobo)}</strong>
                                </span>
                                <span>•</span>
                                <span className="font-mono text-[11px] text-text-secondary">
                                  Ref: {bk.reference}
                                </span>
                                <span>•</span>
                                <span>
                                  {bk.paymentStatus === 'verified' && (
                                    <span className="text-emerald-700 font-medium">
                                      Verified via Kora
                                    </span>
                                  )}
                                  {bk.paymentStatus === 'pending_verification' && (
                                    <span className="text-indigo-700 font-medium">
                                      Re-checking with Kora
                                    </span>
                                  )}
                                  {bk.paymentStatus === 'awaiting_payment' && (
                                    <span className="text-amber-700 font-medium">
                                      Awaiting deposit
                                    </span>
                                  )}
                                  {bk.paymentStatus === 'not_required' && (
                                    <span>No deposit required</span>
                                  )}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => setSelectedBookingForDetails(bk)}
                                className="px-3 py-1.5 rounded-lg border border-border bg-surface hover:bg-surface-container-low text-xs font-medium text-text-primary transition-colors cursor-pointer"
                              >
                                View Details
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* -------------------------------------------------------------
                    SECTION FOUR & FIVE: OPERATIONAL PANELS (TWO COLUMNS)
                ------------------------------------------------------------- */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left Column: Needs Attention (Section 5) */}
                  <div className="bg-surface rounded-xl border border-border/70 shadow-xs p-6 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between pb-3 border-b border-border/50 mb-4">
                        <div>
                          <h3 className="font-headline-sm text-headline-sm text-text-primary font-semibold">
                            Needs Attention
                          </h3>
                          <p className="font-body-sm text-body-sm text-text-secondary mt-0.5">
                            These requests need someone from your team.
                          </p>
                        </div>
                        <span
                          className={`font-metric-sm text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                            needsAttentionItems.length > 0
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {needsAttentionItems.length}{' '}
                          {needsAttentionItems.length === 1 ? 'item' : 'items'}
                        </span>
                      </div>

                      {needsAttentionItems.length === 0 ? (
                        <div className="py-8 text-center flex flex-col items-center justify-center gap-2">
                          <div className="w-10 h-10 rounded-full bg-emerald-50 text-success-strong flex items-center justify-center">
                            <AppIcon name="check_circle" className="text-[22px]" />
                          </div>
                          <h4 className="font-label-md text-sm font-semibold text-text-primary">
                            All caught up!
                          </h4>
                          <p className="font-body-sm text-xs text-text-secondary max-w-sm">
                            There are no customer requests or payment issues needing your attention
                            right now.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {needsAttentionItems.map((item) => (
                            <div
                              key={item.id}
                              className="p-3.5 rounded-xl border border-border/70 bg-surface-container-lowest flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-label-md text-xs font-bold text-text-primary">
                                    {item.customerName}
                                  </span>
                                  <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                                    {item.typeLabel}
                                  </span>
                                </div>
                                <p className="font-body-sm text-xs text-text-secondary leading-snug">
                                  {item.description}
                                </p>
                                <span className="text-[11px] text-text-secondary block">
                                  {item.time}
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={item.onAction}
                                className="h-8 px-3 rounded-lg bg-primary text-on-primary font-label-sm text-xs font-medium hover:bg-primary/90 transition-colors shrink-0 self-start sm:self-auto cursor-pointer"
                              >
                                Review Request
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="pt-4 border-t border-border/40 mt-4 flex items-center justify-between text-xs text-text-secondary">
                      <span>Operational issues & customer escalations</span>
                      <button
                        type="button"
                        onClick={() => setActiveNav('needs-attention')}
                        className="text-primary hover:underline font-medium cursor-pointer"
                      >
                        View attention inbox →
                      </button>
                    </div>
                  </div>

                  {/* Right Column: Your AI Receptionist (Section 4) */}
                  <div className="bg-surface rounded-xl border border-border/70 shadow-xs p-6 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between pb-3 border-b border-border/50 mb-4">
                        <div>
                          <h3 className="font-headline-sm text-headline-sm text-text-primary font-semibold">
                            Your AI Receptionist
                          </h3>
                          <p className="font-body-sm text-body-sm text-text-secondary mt-0.5">
                            See how your assistant is handling customer inquiries and bookings.
                          </p>
                        </div>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          {apiState.agentEnabled ? 'Active' : 'Paused'}
                        </span>
                      </div>

                      {/* Assistant Persona & Channel Status */}
                      <div className="p-4 rounded-xl bg-surface-container-lowest border border-border/60 mb-4 space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-on-primary font-bold text-sm shrink-0">
                            {(workspace.assistantName || 'Maya').slice(0, 1).toUpperCase()}
                          </div>
                          <div>
                            <h4 className="font-label-md text-sm font-bold text-text-primary">
                              {workspace.assistantName || 'Maya'}
                            </h4>
                            <p className="font-body-sm text-xs text-text-secondary">
                              Tone: {workspace.tone || 'Friendly & concise'} • 15-minute slot
                              reservation
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/40 text-xs">
                          <div>
                            <span className="text-text-secondary block">Web Chat Status</span>
                            <span className="font-medium text-emerald-700 flex items-center gap-1 mt-0.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Active on booking page
                            </span>
                          </div>
                          <div>
                            <span className="text-text-secondary block">WhatsApp Status</span>
                            <span
                              className={`font-medium flex items-center gap-1 mt-0.5 ${
                                apiState.whatsappConnected ? 'text-emerald-700' : 'text-amber-700'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  apiState.whatsappConnected ? 'bg-emerald-500' : 'bg-amber-500'
                                }`}
                              />
                              {apiState.whatsappConnected ? 'Connected' : 'Setup Required'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Operational Metrics */}
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="p-3 rounded-lg bg-surface-container-low border border-border/40">
                          <span className="text-[11px] text-text-secondary block uppercase tracking-wide">
                            Conversations Handled
                          </span>
                          <span className="font-metric-md text-xl font-bold text-text-primary mt-1 block">
                            {metrics.conversationsCount}
                          </span>
                        </div>
                        <div className="p-3 rounded-lg bg-surface-container-low border border-border/40">
                          <span className="text-[11px] text-text-secondary block uppercase tracking-wide">
                            Escalated to Staff
                          </span>
                          <span className="font-metric-md text-xl font-bold text-amber-700 mt-1 block">
                            {conversations.filter((c) => c.status === 'needs_human').length}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-3 border-t border-border/40 flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setChatDrawerOpen(true)}
                          className="h-8 text-xs"
                        >
                          <AppIcon name="chat" className="text-[14px]" />
                          <span>Test Chat</span>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setActiveNav('conversations')}
                          className="h-8 text-xs"
                        >
                          <span>View Conversations</span>
                        </Button>
                      </div>

                      <button
                        type="button"
                        onClick={() => setActiveNav('ai-receptionist')}
                        className="text-xs font-medium text-primary hover:underline cursor-pointer"
                      >
                        Manage Receptionist →
                      </button>
                    </div>
                  </div>
                </div>

                {/* -------------------------------------------------------------
                    SECTION SIX: RECENT ACTIVITY TIMELINE
                ------------------------------------------------------------- */}
                <div className="bg-surface rounded-xl border border-border/70 shadow-xs p-6">
                  <div className="flex items-center justify-between pb-3 border-b border-border/50 mb-4">
                    <div>
                      <h3 className="font-headline-sm text-headline-sm text-text-primary font-semibold">
                        Recent Activity
                      </h3>
                      <p className="font-body-sm text-body-sm text-text-secondary mt-0.5">
                        What has happened in your business recently.
                      </p>
                    </div>
                  </div>

                  {recentActivities.length === 0 ? (
                    <div className="py-8 text-center text-text-secondary text-sm">
                      No recent activity recorded today. When customers book appointments or start
                      conversations, updates will appear here.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {recentActivities.map((act) => (
                        <div
                          key={act.id}
                          className="flex items-start gap-3 p-3 rounded-xl bg-surface-container-lowest/80 border border-border/50 hover:bg-surface-container-low transition-colors"
                        >
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${act.badgeColor}`}
                          >
                            <AppIcon name={act.icon} className="text-[16px]" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <h4 className="font-label-md text-xs font-semibold text-text-primary truncate">
                                {act.title}
                              </h4>
                              <span className="font-metric-sm text-[11px] text-text-secondary shrink-0">
                                {act.time}
                              </span>
                            </div>
                            <p className="font-body-sm text-xs text-text-secondary mt-0.5 leading-snug">
                              {act.description}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* -------------------------------------------------------------
                    SECTION SEVEN: SETUP CHECKLIST & LAUNCH GUIDES
                ------------------------------------------------------------- */}
                <div className="bg-surface rounded-xl border border-border/70 shadow-xs overflow-hidden">
                  <div className="p-6 bg-surface-container-lowest border-b border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary-fixed flex items-center justify-center text-primary shrink-0">
                        <AppIcon name="rocket_launch" className="text-[20px]" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-headline-sm text-headline-sm text-text-primary font-semibold">
                            Setup Checklist
                          </h3>
                          <Badge variant="default">
                            {checklist.completedCount} of {checklist.totalCount} Completed
                          </Badge>
                        </div>
                        <p className="font-body-sm text-xs text-text-secondary mt-0.5">
                          Derived from your persisted business, service, and deposit settings
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex items-baseline gap-1 font-metric-lg text-metric-lg text-primary">
                        <span className="font-bold">{checklist.percent}</span>
                        <span className="font-metric-sm text-metric-sm text-text-secondary">%</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setChecklistExpanded((prev) => !prev)}
                        className="text-xs"
                      >
                        {checklistExpanded ? 'Collapse' : 'View Checklist'}
                      </Button>
                    </div>
                  </div>

                  {/* Dynamic Progress Bar */}
                  <div className="px-6 pt-3 pb-1 bg-surface-container-lowest">
                    <Progress value={checklist.percent} aria-label="Setup checklist progress" />
                  </div>

                  {checklistExpanded && (
                    <div className="p-6 space-y-3 bg-surface border-t border-border/50">
                      {checklist.items.map((item, index) => {
                        const isDone = item.status === 'completed';
                        const isFocal = !isDone && index === checklist.completedCount;

                        return (
                          <div
                            key={item.id}
                            className={`flex items-start gap-4 p-3.5 rounded-xl transition-all ${
                              isFocal
                                ? 'bg-surface-container-low shadow-xs border border-primary/20'
                                : 'bg-surface-container-lowest hover:bg-surface-container-low'
                            }`}
                          >
                            {isDone ? (
                              <div className="w-6 h-6 rounded-full bg-success flex items-center justify-center shrink-0 text-white mt-0.5 shadow-xs">
                                <AppIcon name="check" className="text-[15px] font-bold" />
                              </div>
                            ) : isFocal ? (
                              <div className="w-6 h-6 rounded-full bg-primary-container flex items-center justify-center shrink-0 text-on-primary mt-0.5">
                                <span className="w-2 h-2 rounded-full bg-surface animate-ping" />
                              </div>
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-surface-container-high flex items-center justify-center shrink-0 text-text-secondary mt-0.5">
                                <span className="font-metric-sm text-metric-sm font-medium">
                                  {index + 1}
                                </span>
                              </div>
                            )}

                            <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span
                                    className={`font-label-md text-label-md text-text-primary ${
                                      isDone ? 'font-medium' : 'font-semibold'
                                    }`}
                                  >
                                    {item.title}
                                  </span>
                                  <span
                                    className={`font-metric-sm text-metric-sm px-2 py-0.5 rounded-full ${
                                      isDone
                                        ? 'text-success-strong bg-success/10'
                                        : 'bg-secondary-container text-on-secondary-container'
                                    }`}
                                  >
                                    {item.badgeText}
                                  </span>
                                </div>
                                <p className="font-body-sm text-xs text-text-secondary mt-0.5">
                                  {item.description}
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={item.onAction}
                                className={`h-8 px-3 rounded-lg font-label-sm text-xs transition-colors shrink-0 self-start sm:self-auto flex items-center gap-1 cursor-pointer ${
                                  isFocal
                                    ? 'bg-primary hover:bg-primary/90 text-on-primary shadow-xs font-semibold'
                                    : 'bg-surface hover:bg-surface-container text-text-primary border border-border shadow-2xs'
                                }`}
                              >
                                <span>{item.actionLabel}</span>
                                <AppIcon name="arrow_forward" className="text-[14px]" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Launch Resources Grid */}
                  <div className="p-6 bg-surface-container-lowest border-t border-border/50">
                    <h4 className="font-label-md text-xs uppercase tracking-wider text-text-secondary font-semibold mb-4">
                      Setup Guides & Help
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Guide 1 */}
                      <button
                        type="button"
                        onClick={() =>
                          setGuideModal({
                            title: 'Connecting your Meta WhatsApp Business number',
                            category: 'WhatsApp Cloud API',
                            steps: [
                              'Open Integrations in the left sidebar and enter your Meta Phone Number ID.',
                              'Configure your webhook callback URL to point to /api/webhooks/whatsapp.',
                              'Once paired, incoming WhatsApp messages route to your AI receptionist to check real staff availability and offer 15-minute slot holds.',
                            ],
                          })
                        }
                        className="p-4 rounded-xl bg-surface border border-border/60 hover:border-primary/40 text-left transition-all group cursor-pointer"
                      >
                        <div className="flex items-center gap-1.5 text-text-secondary text-xs mb-2">
                          <AppIcon name="chat" className="text-[16px] text-primary" />
                          <span>WhatsApp Cloud</span>
                        </div>
                        <h5 className="font-label-md text-xs font-bold text-text-primary group-hover:text-primary transition-colors">
                          How to connect WhatsApp Business
                        </h5>
                        <p className="font-body-sm text-[11px] text-text-secondary mt-1 leading-snug">
                          Automate late-night customer DMs so customers can check slots and book
                          anytime.
                        </p>
                      </button>

                      {/* Guide 2 */}
                      <button
                        type="button"
                        onClick={() =>
                          setGuideModal({
                            title: 'How 15-minute slot holds and Kora deposits work',
                            category: 'Deposits & Verification',
                            steps: [
                              'When a customer picks a time slot, the calendar locks that staff window for 15 minutes.',
                              'Switchboard generates a unique deposit reference for payment.',
                              'Only after Kora sends a verified transaction status does the booking become Confirmed.',
                              'If the customer does not pay within 15 minutes, the slot automatically re-opens for others.',
                            ],
                          })
                        }
                        className="p-4 rounded-xl bg-surface border border-border/60 hover:border-primary/40 text-left transition-all group cursor-pointer"
                      >
                        <div className="flex items-center gap-1.5 text-text-secondary text-xs mb-2">
                          <AppIcon name="payments" className="text-[16px] text-primary" />
                          <span>Kora Deposits</span>
                        </div>
                        <h5 className="font-label-md text-xs font-bold text-text-primary group-hover:text-primary transition-colors">
                          How slot holds & deposits stop no-shows
                        </h5>
                        <p className="font-body-sm text-[11px] text-text-secondary mt-1 leading-snug">
                          Understand how Switchboard prevents double-bookings and safely verifies
                          deposits.
                        </p>
                      </button>

                      {/* Guide 3 */}
                      <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200/60 text-left">
                        <div className="flex items-center gap-1.5 text-primary text-xs mb-2 font-semibold">
                          <AppIcon name="share" className="text-[16px]" />
                          <span>Public Booking Link</span>
                        </div>
                        <h5 className="font-label-md text-xs font-bold text-indigo-950">
                          Share your booking link
                        </h5>
                        <p className="font-body-sm text-[11px] text-indigo-800 mt-1 leading-snug">
                          Your live booking link is ready at{' '}
                          <code className="font-mono">/b/{workspace.slug}</code>.
                        </p>
                        <button
                          type="button"
                          onClick={copyBookingLink}
                          className="mt-3 text-xs font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <span>{copiedSlug ? 'Link Copied!' : 'Copy Link'}</span>
                          <AppIcon name="content_copy" className="text-[13px]" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* -------------------------------------------------------------
                    SECTION EIGHT: DEVELOPER SANDBOX & TESTING (COLLAPSIBLE)
                ------------------------------------------------------------- */}
                <div className="rounded-xl border border-dashed border-border/80 bg-surface-container-lowest/60 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-text-secondary">
                      <AppIcon name="tune" className="text-[18px]" />
                      <span className="font-label-md text-xs font-semibold text-text-primary">
                        Developer Sandbox &amp; Testing Controls
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setDevSandboxOpen((prev) => !prev)}
                      className="text-xs h-7"
                    >
                      {devSandboxOpen ? 'Hide Developer Controls' : 'Show Developer Controls'}
                    </Button>
                  </div>

                  {devSandboxOpen && (
                    <div className="mt-4 pt-4 border-t border-border/50 space-y-3">
                      <p className="text-xs text-text-secondary">
                        These controls allow developers and pair programmers to simulate customer
                        bookings, payment webhook verifications, timeouts, and human escalations in
                        local environments.
                      </p>

                      <div className="flex items-center gap-2 flex-wrap">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleCreateSimulatedBooking}
                          className="text-xs h-8"
                        >
                          <AppIcon name="add_circle" className="text-[14px] text-primary" />
                          <span>Simulate Customer Booking</span>
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleTriggerHumanEscalation}
                          className="text-xs h-8"
                        >
                          <AppIcon
                            name="notification_important"
                            className="text-[14px] text-amber-600"
                          />
                          <span>Simulate Needs-Attention Escalation</span>
                        </Button>

                        {bookings.some((b) => b.status === 'held') && (
                          <>
                            <Button
                              type="button"
                              variant="default"
                              size="sm"
                              onClick={() => {
                                const held = bookings.find((b) => b.status === 'held');
                                if (held) handleVerifyKoraDeposit(held.id);
                              }}
                              className="text-xs h-8"
                            >
                              <AppIcon name="verified" className="text-[14px]" />
                              <span>Simulate Kora Webhook Verification</span>
                            </Button>

                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const held = bookings.find((b) => b.status === 'held');
                                if (held) handleFlagPaymentPendingVerification(held.id);
                              }}
                              className="text-xs h-8"
                            >
                              <AppIcon
                                name="hourglass_empty"
                                className="text-[14px] text-indigo-600"
                              />
                              <span>Simulate Provider Timeout (Pending)</span>
                            </Button>

                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const held = bookings.find((b) => b.status === 'held');
                                if (held) handleExpireHold(held.id);
                              }}
                              className="text-xs h-8"
                            >
                              <AppIcon name="history" className="text-[14px] text-slate-600" />
                              <span>Expire Hold (15m Elapsed)</span>
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ===============================================================
                SUB-VIEWS FOR ALL SIDEBAR DESTINATIONS (Mounted in same shell)
            =============================================================== */}
            {activeNav === 'bookings' && (
              <BookingsManagementView
                workspace={workspace}
                bookings={bookings}
                conversations={conversations}
                userRole={apiState.role}
                isLoading={apiState.loading}
                apiError={apiState.error}
                copiedSlug={copiedSlug}
                onCopyBookingLink={copyBookingLink}
                onCreateBooking={(newBk) => saveBookings([newBk, ...bookings])}
                onUpdateBooking={(bookingId, updater) =>
                  saveBookings(bookings.map((b) => (b.id === bookingId ? updater(b) : b)))
                }
                onNavigateSection={(sec) => setActiveNav(sec)}
              />
            )}

            {(activeNav === 'conversations' || activeNav === 'needs-attention') && (
              <ConversationsManagementView
                workspace={workspace}
                conversations={conversations}
                bookings={bookings}
                userRole={apiState.role}
                operatorName={apiState.ownerName}
                whatsappConnected={apiState.whatsappConnected}
                isLoading={apiState.loading}
                apiError={apiState.error}
                initialNeedsHumanOnly={activeNav === 'needs-attention'}
                onRefresh={() => {
                  try {
                    const savedConvs = localStorage.getItem('switchboard_dashboard_conversations');
                    if (savedConvs) {
                      setConversations(JSON.parse(savedConvs));
                    }
                    const savedBks = localStorage.getItem('switchboard_dashboard_bookings');
                    if (savedBks) {
                      setBookings(JSON.parse(savedBks));
                    }
                  } catch {
                    // ignore storage errors
                  }
                  fetch('/api/workspace')
                    .then(async (res) => {
                      const data = (await res.json()) as WorkspaceApiData;
                      if (!res.ok || !data.ok) {
                        setApiState((prev) => ({
                          ...prev,
                          connected: false,
                          error: data.error || 'Unable to reach workspace backend.',
                        }));
                        return;
                      }
                      setApiState((prev) => ({
                        ...prev,
                        connected: true,
                        error: null,
                        whatsappConnected: Boolean(data.business?.whatsappPhoneNumberId),
                        agentEnabled: data.business?.agentEnabled ?? prev.agentEnabled,
                      }));
                    })
                    .catch(() => {
                      setApiState((prev) => ({
                        ...prev,
                        connected: false,
                        error: 'Network connection interrupted. Displaying cached workspace data.',
                      }));
                    });
                }}
                onOpenTestChat={() => setChatDrawerOpen(true)}
                onUpdateConversation={(conversationId, updater) =>
                  saveConversations(
                    conversations.map((c) => (c.id === conversationId ? updater(c) : c)),
                  )
                }
                onUpdateBooking={(bookingId, updater) =>
                  saveBookings(bookings.map((b) => (b.id === bookingId ? updater(b) : b)))
                }
                onNavigateSection={(sec) => setActiveNav(sec)}
              />
            )}

            {activeNav !== 'overview' &&
              activeNav !== 'bookings' &&
              activeNav !== 'conversations' &&
              activeNav !== 'needs-attention' && (
                <div className="bg-surface rounded-xl p-6 sm:p-8 border border-border space-y-6">
                  <div className="flex items-center justify-between border-b border-border pb-4">
                    <div>
                      <h1 className="text-2xl font-bold text-text-primary capitalize">
                        {activeNav.replace('-', ' & ')}
                      </h1>
                      <p className="text-sm text-text-secondary mt-1">
                        Persisted configuration for {workspace.businessName} ({workspace.timezone})
                      </p>
                    </div>
                    <Link
                      href="/onboarding"
                      className="px-4 py-2 rounded-lg bg-primary-container text-white text-xs font-semibold hover:bg-primary"
                    >
                      Edit in Setup Wizard
                    </Link>
                  </div>

                  {activeNav === 'services-staff' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <h3 className="font-semibold text-text-primary">
                          Bookable Services ({workspace.services.length})
                        </h3>
                        {workspace.services.map((s) => (
                          <div
                            key={s.id}
                            className="p-3.5 rounded-lg border border-border flex items-center justify-between"
                          >
                            <div>
                              <div className="font-semibold text-sm text-text-primary">
                                {s.name}
                              </div>
                              <div className="text-xs text-text-secondary">{s.duration} mins</div>
                            </div>
                            <div className="font-mono font-bold text-sm text-text-primary">
                              ₦{s.price.toLocaleString()}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="space-y-3">
                        <h3 className="font-semibold text-text-primary">
                          Staff Providers ({workspace.staff.length})
                        </h3>
                        {workspace.staff.map((st) => (
                          <div
                            key={st.id}
                            className="p-3.5 rounded-lg border border-border flex items-center justify-between"
                          >
                            <div>
                              <div className="font-semibold text-sm text-text-primary">
                                {st.name}
                              </div>
                              <div className="text-xs text-text-secondary">{st.role}</div>
                            </div>
                            <span className="text-xs font-mono text-success-strong">Active</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(activeNav === 'payments' || activeNav === 'settings') && (
                    <div className="space-y-6">
                      {/* Phase 2: Business-wide Kora Fee & Free-Cancel Window */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl border border-border bg-surface-container-low/50 space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-sm font-bold text-text-primary">
                                Who bears the Kora fee
                              </h3>
                              <p className="text-xs text-text-secondary">
                                Sets <code>merchant_bears_cost</code> on virtual bank-transfer
                                charges
                              </p>
                            </div>
                            <span className="px-2 py-0.5 rounded bg-secondary-container text-[10px] font-mono font-bold text-on-secondary-fixed">
                              KORA
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setWorkspace((prev) => ({ ...prev, merchantBearsCost: false }))
                              }
                              className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                                !workspace.merchantBearsCost
                                  ? 'border-primary-container bg-white ring-2 ring-primary-container/30'
                                  : 'border-border bg-white/70 hover:bg-white'
                              }`}
                            >
                              <p className="text-xs font-bold text-text-primary">
                                Customer pays fee
                              </p>
                              <p className="text-[11px] text-text-secondary mt-0.5">
                                Adds{' '}
                                {formatNairaFromKobo(
                                  computeKoraFeeKobo((workspace.depositAmount || 1500) * 100),
                                )}{' '}
                                to ₦{(workspace.depositAmount || 1500).toLocaleString()}
                              </p>
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                setWorkspace((prev) => ({ ...prev, merchantBearsCost: true }))
                              }
                              className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                                workspace.merchantBearsCost
                                  ? 'border-primary-container bg-white ring-2 ring-primary-container/30'
                                  : 'border-border bg-white/70 hover:bg-white'
                              }`}
                            >
                              <p className="text-xs font-bold text-text-primary">
                                Business absorbs fee
                              </p>
                              <p className="text-[11px] text-text-secondary mt-0.5">
                                Customer transfers exact ₦
                                {(workspace.depositAmount || 1500).toLocaleString()}
                              </p>
                            </button>
                          </div>
                        </div>

                        <div className="p-4 rounded-xl border border-border bg-surface-container-low/50 space-y-3">
                          <div>
                            <h3 className="text-sm font-bold text-text-primary">
                              Default free-cancel refund window
                            </h3>
                            <p className="text-xs text-text-secondary">
                              Cancellations inside this window receive an automatic Kora refund
                            </p>
                          </div>

                          <div className="flex items-center gap-3">
                            <select
                              aria-label="Default free cancellation window in hours"
                              value={workspace.freeCancelHours ?? 4}
                              onChange={(e) => {
                                const hours = Number(e.target.value);
                                setWorkspace((prev) => ({
                                  ...prev,
                                  freeCancelHours: hours,
                                  cancellationPolicy: `Full refund if cancelled at least ${hours} hours before your scheduled slot.`,
                                }));
                              }}
                              className="flex-1 px-3 py-2 rounded-lg border border-border bg-white text-sm font-semibold text-text-primary outline-none cursor-pointer"
                            >
                              <option value={2}>2 hours before slot</option>
                              <option value={4}>4 hours before slot (Recommended)</option>
                              <option value={12}>12 hours before slot</option>
                              <option value={24}>24 hours before slot</option>
                              <option value={48}>48 hours before slot</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Phase 2: Per-Service Deposit Rule Table */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div>
                            <h3 className="text-base font-bold text-text-primary">
                              Deposit rule per service
                            </h3>
                            <p className="text-xs text-text-secondary">
                              Configure fixed Naira, percentage, full upfront, or no-deposit (direct
                              confirmation) per service.
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={savingPaymentSettings}
                            onClick={() => void handleSavePaymentSettings()}
                            className="px-4 py-2 rounded-lg bg-primary-container text-white text-xs font-semibold hover:bg-primary transition-colors cursor-pointer disabled:opacity-60"
                          >
                            {savingPaymentSettings ? 'Saving rules...' : 'Save payment settings'}
                          </button>
                        </div>

                        {paymentSaveNotice && (
                          <div className="px-3.5 py-2 rounded-lg bg-success/10 border border-success/30 text-xs font-medium text-success-strong">
                            {paymentSaveNotice}
                          </div>
                        )}

                        <div className="rounded-xl border border-border divide-y divide-border overflow-hidden bg-white">
                          {workspace.services.map((svc, idx) => {
                            const rule =
                              svc.depositType ?? (svc.depositRequired === false ? 'none' : 'fixed');
                            return (
                              <div
                                key={svc.id}
                                className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-3 items-center"
                              >
                                <div className="lg:col-span-4">
                                  <p className="text-sm font-semibold text-text-primary">
                                    {svc.name}
                                  </p>
                                  <p className="text-xs font-mono text-text-secondary">
                                    ₦{svc.price.toLocaleString()} • {svc.duration} mins
                                  </p>
                                </div>

                                <div className="lg:col-span-3">
                                  <label
                                    htmlFor={`dep-rule-${svc.id}`}
                                    className="text-[11px] font-mono text-text-secondary block mb-1"
                                  >
                                    Deposit type
                                  </label>
                                  <select
                                    id={`dep-rule-${svc.id}`}
                                    value={rule}
                                    onChange={(e) => {
                                      const nextRule = e.target.value as
                                        | 'fixed'
                                        | 'percent'
                                        | 'full'
                                        | 'none';
                                      setWorkspace((prev) => {
                                        const updated = [...prev.services];
                                        const current = updated[idx];
                                        if (current) {
                                          updated[idx] = {
                                            ...current,
                                            depositType: nextRule,
                                            depositRequired: nextRule !== 'none',
                                            depositAmount:
                                              nextRule === 'none'
                                                ? 0
                                                : nextRule === 'full'
                                                  ? current.price
                                                  : nextRule === 'percent'
                                                    ? Math.min(100, current.depositValue || 30)
                                                    : current.depositAmount || 1500,
                                            depositValue:
                                              nextRule === 'percent'
                                                ? Math.min(100, current.depositValue || 30)
                                                : undefined,
                                          };
                                        }
                                        return { ...prev, services: updated };
                                      });
                                    }}
                                    className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-surface text-xs font-semibold text-text-primary outline-none cursor-pointer"
                                  >
                                    <option value="fixed">Fixed amount (₦)</option>
                                    <option value="percent">Percentage (%)</option>
                                    <option value="full">Full price upfront</option>
                                    <option value="none">No deposit (direct confirm)</option>
                                  </select>
                                </div>

                                <div className="lg:col-span-3">
                                  <label
                                    htmlFor={`dep-val-${svc.id}`}
                                    className="text-[11px] font-mono text-text-secondary block mb-1"
                                  >
                                    {rule === 'percent'
                                      ? 'Percentage (%)'
                                      : rule === 'fixed'
                                        ? 'Deposit (₦)'
                                        : 'Calculated deposit'}
                                  </label>
                                  {rule === 'fixed' || rule === 'percent' ? (
                                    <input
                                      id={`dep-val-${svc.id}`}
                                      type="number"
                                      min={rule === 'percent' ? 5 : 0}
                                      max={rule === 'percent' ? 100 : svc.price}
                                      step={rule === 'percent' ? 5 : 500}
                                      value={
                                        rule === 'percent'
                                          ? (svc.depositValue ?? svc.depositAmount ?? 30)
                                          : svc.depositAmount
                                      }
                                      onChange={(e) => {
                                        const val = Number(e.target.value);
                                        setWorkspace((prev) => {
                                          const updated = [...prev.services];
                                          const current = updated[idx];
                                          if (current) {
                                            updated[idx] = {
                                              ...current,
                                              depositAmount: val,
                                              depositValue: rule === 'percent' ? val : undefined,
                                            };
                                          }
                                          return { ...prev, services: updated };
                                        });
                                      }}
                                      className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-white text-xs font-mono font-bold text-text-primary outline-none"
                                    />
                                  ) : (
                                    <div className="px-2.5 py-1.5 rounded-lg border border-border bg-surface-container-low text-xs font-mono text-text-secondary">
                                      {rule === 'full'
                                        ? `₦${svc.price.toLocaleString()} (100%)`
                                        : '₦0 (Instant confirm)'}
                                    </div>
                                  )}
                                </div>

                                <div className="lg:col-span-2">
                                  <label
                                    htmlFor={`cancel-hrs-${svc.id}`}
                                    className="text-[11px] font-mono text-text-secondary block mb-1"
                                  >
                                    Free cancel
                                  </label>
                                  <select
                                    id={`cancel-hrs-${svc.id}`}
                                    value={svc.freeCancelHours ?? workspace.freeCancelHours ?? 4}
                                    onChange={(e) => {
                                      const hrs = Number(e.target.value);
                                      setWorkspace((prev) => {
                                        const updated = [...prev.services];
                                        const current = updated[idx];
                                        if (current) {
                                          updated[idx] = { ...current, freeCancelHours: hrs };
                                        }
                                        return { ...prev, services: updated };
                                      });
                                    }}
                                    className="w-full px-2 py-1.5 rounded-lg border border-border bg-surface text-xs font-mono text-text-primary outline-none cursor-pointer"
                                  >
                                    <option value={2}>2h</option>
                                    <option value={4}>4h</option>
                                    <option value={12}>12h</option>
                                    <option value={24}>24h</option>
                                  </select>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {activeNav !== 'services-staff' &&
                    activeNav !== 'payments' &&
                    activeNav !== 'settings' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                        <div className="p-4 rounded-lg bg-surface-container-low space-y-1">
                          <span className="text-xs text-text-secondary uppercase font-mono">
                            Business & Slug
                          </span>
                          <div className="font-semibold text-text-primary">
                            {workspace.businessName} (/b/{workspace.slug})
                          </div>
                        </div>
                        <div className="p-4 rounded-lg bg-surface-container-low space-y-1">
                          <span className="text-xs text-text-secondary uppercase font-mono">
                            Kora Deposit & Hold Policy
                          </span>
                          <div className="font-semibold text-text-primary">
                            ₦{workspace.depositAmount.toLocaleString()} deposit • 15-minute slot
                            hold
                          </div>
                        </div>
                        <div className="p-4 rounded-lg bg-surface-container-low space-y-1">
                          <span className="text-xs text-text-secondary uppercase font-mono">
                            AI Receptionist
                          </span>
                          <div className="font-semibold text-text-primary">
                            {workspace.assistantName} ({workspace.tone} tone)
                          </div>
                        </div>
                        <div className="p-4 rounded-lg bg-surface-container-low space-y-1">
                          <span className="text-xs text-text-secondary uppercase font-mono">
                            Channels
                          </span>
                          <div className="font-semibold text-text-primary">
                            Web Chat Live •{' '}
                            {apiState.whatsappConnected
                              ? 'WhatsApp Connected'
                              : 'WhatsApp Ready to Pair'}
                          </div>
                        </div>
                      </div>
                    )}
                </div>
              )}
          </div>
        </main>
      </div>

      {/* =====================================================================
          MOBILE BOTTOM TAB BAR (< lg) — Prioritizes Home, Conversations, Bookings, Attention
      ===================================================================== */}
      <nav
        aria-label="Mobile Navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-surface border-t border-border z-30 grid grid-cols-5 px-2"
      >
        {[
          { id: 'overview' as const, label: 'Home', icon: 'grid_view' },
          { id: 'bookings' as const, label: 'Bookings', icon: 'calendar_month' },
          { id: 'conversations' as const, label: 'Chats', icon: 'chat_bubble' },
          { id: 'needs-attention' as const, label: 'Attention', icon: 'notification_important' },
          { id: 'services-staff' as const, label: 'Menu', icon: 'content_cut' },
        ].map((tab) => {
          const active = activeNav === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveNav(tab.id)}
              className={`flex flex-col items-center justify-center gap-0.5 ${
                active ? 'text-primary font-semibold' : 'text-text-secondary'
              }`}
            >
              <AppIcon name={tab.icon} className="text-[20px]" />
              <span className="text-[11px]">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* =====================================================================
          INTERACTIVE WEB CHAT DRAWER (Test Maya with live business data)
      ===================================================================== */}
      {chatDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-end">
          <div className="w-full max-w-md h-full bg-surface shadow-2xl flex flex-col justify-between p-6">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-primary-container text-white flex items-center justify-center font-bold text-sm">
                  {workspace.assistantName.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-text-primary text-sm">
                    {workspace.assistantName} — {workspace.businessName}
                  </h3>
                  <p className="text-xs text-success-strong">
                    Web Chat Active • Reads live services & staff
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setChatDrawerOpen(false)}
                className="p-1 text-text-secondary hover:text-text-primary"
              >
                <AppIcon name="close" className="text-[20px]" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              <div className="p-3 rounded-xl bg-surface-container-low text-xs text-text-primary">
                <strong>{workspace.assistantName}:</strong> {workspace.greeting}
              </div>
              {conversations
                .find((c) => c.channel === 'web_chat')
                ?.messages.slice(1)
                .map((m) => (
                  <div
                    key={m.id}
                    className={`p-3 rounded-xl text-xs ${
                      m.sender === 'customer'
                        ? 'bg-primary-container text-white ml-8'
                        : 'bg-surface-container-low text-text-primary mr-8'
                    }`}
                  >
                    {m.text}
                  </div>
                ))}
            </div>

            <div className="pt-3 border-t border-border flex items-center gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSendWebChatMessage();
                }}
                placeholder="Ask for a haircut slot or price..."
                className="flex-1 px-3.5 py-2.5 text-sm rounded-xl border border-border outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="button"
                onClick={handleSendWebChatMessage}
                className="px-4 py-2.5 rounded-xl bg-primary-container text-white text-xs font-semibold cursor-pointer"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          BOOKING DETAILS MODAL
      ===================================================================== */}
      {selectedBookingForDetails && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-surface rounded-2xl border border-border shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-border/50 pb-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-primary">
                  Booking Details
                </span>
                <h3 className="text-lg font-bold text-text-primary mt-1">
                  {selectedBookingForDetails.customerName}
                </h3>
                <p className="text-xs text-text-secondary font-mono mt-0.5">
                  Ref: {selectedBookingForDetails.reference}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBookingForDetails(null)}
                className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-container transition-colors"
                aria-label="Close details"
              >
                <AppIcon name="close" className="text-[20px]" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3 rounded-xl bg-surface-container-low border border-border/50">
                <span className="text-text-secondary block">Service</span>
                <span className="font-semibold text-text-primary text-sm mt-0.5 block">
                  {selectedBookingForDetails.serviceName}
                </span>
                <span className="text-text-secondary mt-1 block">
                  Price: {formatNairaFromKobo(selectedBookingForDetails.priceKobo)}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-surface-container-low border border-border/50">
                <span className="text-text-secondary block">Specialist</span>
                <span className="font-semibold text-text-primary text-sm mt-0.5 block">
                  {selectedBookingForDetails.staffName}
                </span>
                <span className="text-text-secondary mt-1 block">
                  Slot: {selectedBookingForDetails.slotTime}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-surface-container-low border border-border/50">
                <span className="text-text-secondary block">Customer Contact</span>
                <span className="font-semibold text-text-primary text-sm mt-0.5 block">
                  {apiState.role === 'staff'
                    ? `•••• ${selectedBookingForDetails.customerPhone.slice(-4)}`
                    : selectedBookingForDetails.customerPhone}
                </span>
                <span className="text-text-secondary mt-1 block capitalize">
                  Source: {selectedBookingForDetails.source.replace('_', ' ')}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-surface-container-low border border-border/50">
                <span className="text-text-secondary block">Deposit &amp; Payment</span>
                <span className="font-semibold text-emerald-700 text-sm mt-0.5 block">
                  {formatNairaFromKobo(selectedBookingForDetails.depositKobo)}
                </span>
                <span className="text-text-secondary mt-1 block capitalize">
                  Status: {selectedBookingForDetails.paymentStatus.replace('_', ' ')}
                </span>
              </div>
            </div>

            {selectedBookingForDetails.status === 'held' && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200/60">
                <div className="flex items-center gap-2 text-amber-800 text-xs font-semibold mb-2">
                  <AppIcon name="schedule" className="text-[16px]" />
                  <span>Temporary 15-Minute Slot Lock Active</span>
                </div>
                <HoldBand
                  status="held"
                  remainingSeconds={selectedBookingForDetails.holdSecondsRemaining ?? 900}
                  totalSeconds={900}
                  compact
                  theme="light"
                  autoTick
                />
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-border/50">
              <button
                type="button"
                onClick={() => setSelectedBookingForDetails(null)}
                className="px-4 py-2 rounded-lg bg-surface-container-high hover:bg-surface-container text-text-primary text-xs font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          NEW MANUAL APPOINTMENT MODAL
      ===================================================================== */}
      {newBookingModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-surface rounded-2xl border border-border shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-border/50 pb-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-primary">
                  New Appointment
                </span>
                <h3 className="text-lg font-bold text-text-primary mt-1">
                  Create Customer Booking
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setNewBookingModalOpen(false)}
                className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-container transition-colors"
                aria-label="Close dialog"
              >
                <AppIcon name="close" className="text-[20px]" />
              </button>
            </div>

            <form onSubmit={handleCreateManualBooking} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="new-booking-customer-name"
                  className="block text-xs font-semibold text-text-primary"
                >
                  Customer Name
                </label>
                <input
                  id="new-booking-customer-name"
                  type="text"
                  required
                  placeholder="e.g. Chinedu Eze"
                  value={newBookingForm.customerName}
                  onChange={(e) =>
                    setNewBookingForm((prev) => ({ ...prev, customerName: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="new-booking-customer-phone"
                  className="block text-xs font-semibold text-text-primary"
                >
                  Phone Number
                </label>
                <input
                  id="new-booking-customer-phone"
                  type="tel"
                  required
                  placeholder="e.g. +234 809 123 4567"
                  value={newBookingForm.customerPhone}
                  onChange={(e) =>
                    setNewBookingForm((prev) => ({ ...prev, customerPhone: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label
                    htmlFor="new-booking-service"
                    className="block text-xs font-semibold text-text-primary"
                  >
                    Service
                  </label>
                  <select
                    id="new-booking-service"
                    value={newBookingForm.serviceIndex}
                    onChange={(e) =>
                      setNewBookingForm((prev) => ({
                        ...prev,
                        serviceIndex: Number(e.target.value),
                      }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    {workspace.services.map((svc, idx) => (
                      <option key={svc.id || svc.name} value={idx}>
                        {svc.name} (₦{svc.price.toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="new-booking-staff"
                    className="block text-xs font-semibold text-text-primary"
                  >
                    Specialist
                  </label>
                  <select
                    id="new-booking-staff"
                    value={newBookingForm.staffIndex}
                    onChange={(e) =>
                      setNewBookingForm((prev) => ({
                        ...prev,
                        staffIndex: Number(e.target.value),
                      }))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    {workspace.staff.map((stf, idx) => (
                      <option key={stf.id || stf.name} value={idx}>
                        {stf.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="new-booking-slot-time"
                  className="block text-xs font-semibold text-text-primary"
                >
                  Time Slot
                </label>
                <input
                  id="new-booking-slot-time"
                  type="text"
                  required
                  placeholder="e.g. Today, 4:30 PM (WAT)"
                  value={newBookingForm.slotTime}
                  onChange={(e) =>
                    setNewBookingForm((prev) => ({ ...prev, slotTime: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div className="p-3 rounded-lg bg-surface-container-low border border-border/50 flex items-center justify-between">
                <div>
                  <label
                    htmlFor="new-booking-require-deposit"
                    className="text-xs font-semibold text-text-primary block cursor-pointer"
                  >
                    Require Kora Deposit
                  </label>
                  <span className="text-[11px] text-text-secondary block">
                    ₦{(workspace.depositAmount || 1500).toLocaleString()} deposit (15-minute slot
                    lock)
                  </span>
                </div>
                <input
                  id="new-booking-require-deposit"
                  type="checkbox"
                  checked={newBookingForm.requireDeposit}
                  onChange={(e) =>
                    setNewBookingForm((prev) => ({ ...prev, requireDeposit: e.target.checked }))
                  }
                  className="w-4 h-4 accent-primary rounded cursor-pointer"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-border/50">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setNewBookingModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="default" size="sm">
                  Create Appointment
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          SETUP GUIDE MODAL
      ===================================================================== */}
      {guideModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-surface rounded-2xl border border-border shadow-2xl p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-primary">
                  {guideModal.category}
                </span>
                <h3 className="text-lg font-bold text-text-primary mt-1">{guideModal.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setGuideModal(null)}
                className="p-1 text-text-secondary hover:text-text-primary"
              >
                <AppIcon name="close" className="text-[20px]" />
              </button>
            </div>

            <ol className="space-y-3 list-decimal list-inside text-sm text-text-secondary">
              {guideModal.steps.map((stepText) => (
                <li key={stepText} className="leading-relaxed">
                  {stepText}
                </li>
              ))}
            </ol>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setGuideModal(null)}
                className="px-4 py-2 rounded-lg bg-primary-container text-white text-xs font-semibold"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
