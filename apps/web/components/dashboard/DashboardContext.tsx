'use client';

import { usePathname, useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { OnboardingState } from '@/app/onboarding/page';
import type {
  DashboardBookingRecord as BookingRecord,
  DashboardConversationRecord as ConversationRecord,
} from './bookings/BookingsManagementView';

export type NavSection =
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

export const NAV_SECTION_ROUTES: Record<NavSection, string> = {
  overview: '/dashboard',
  bookings: '/dashboard/bookings',
  conversations: '/dashboard/conversations',
  customers: '/dashboard/customers',
  'needs-attention': '/dashboard/needs-attention',
  'ai-receptionist': '/dashboard/ai-receptionist',
  'services-staff': '/dashboard/services-staff',
  'working-hours': '/dashboard/working-hours',
  payments: '/dashboard/payments',
  integrations: '/dashboard/integrations',
  'team-permissions': '/dashboard/team-permissions',
  analytics: '/dashboard/analytics',
  settings: '/dashboard/settings',
};

export function getNavSectionFromPathname(pathname: string): NavSection {
  if (pathname === '/dashboard' || pathname === '/dashboard/overview') {
    return 'overview';
  }
  const entries = Object.entries(NAV_SECTION_ROUTES) as Array<[NavSection, string]>;
  for (const [section, route] of entries) {
    if (section !== 'overview' && pathname.startsWith(route)) {
      return section;
    }
  }
  return 'overview';
}

export interface WorkspaceApiData {
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

export const DEFAULT_WORKSPACE: OnboardingState = {
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

export function formatNairaFromKobo(kobo: number): string {
  const naira = Math.round(kobo / 100);
  return `₦${naira.toLocaleString('en-NG')}`;
}

export function getGreeting(timezone = 'Africa/Lagos', ownerName?: string): string {
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

export function getFormattedDate(timezone = 'Africa/Lagos'): string {
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

export interface ApiState {
  loading: boolean;
  connected: boolean;
  error: string | null;
  ownerName: string;
  role: 'owner' | 'staff';
  whatsappConnected: boolean;
  koraConfigured: boolean;
  agentEnabled: boolean;
}

export interface GuideModalData {
  title: string;
  category: string;
  steps: string[];
}

export interface NewBookingFormState {
  customerName: string;
  customerPhone: string;
  serviceIndex: number;
  staffIndex: number;
  slotTime: string;
  requireDeposit: boolean;
}

interface DashboardContextValue {
  activeNav: NavSection;
  setActiveNav: (section: NavSection) => void;
  sidebarOpenMobile: boolean;
  setSidebarOpenMobile: (open: boolean) => void;
  workspace: OnboardingState;
  setWorkspace: React.Dispatch<React.SetStateAction<OnboardingState>>;
  apiState: ApiState;
  setApiState: React.Dispatch<React.SetStateAction<ApiState>>;
  bookings: BookingRecord[];
  conversations: ConversationRecord[];
  saveBookings: (next: BookingRecord[]) => void;
  saveConversations: (next: ConversationRecord[]) => void;
  copiedSlug: boolean;
  copyBookingLink: () => void;
  workspaceMenuOpen: boolean;
  setWorkspaceMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  savingPaymentSettings: boolean;
  paymentSaveNotice: string | null;
  handleSavePaymentSettings: (nextWorkspace?: OnboardingState) => Promise<void>;
  chatDrawerOpen: boolean;
  setChatDrawerOpen: (open: boolean) => void;
  chatInput: string;
  setChatInput: (input: string) => void;
  handleSendWebChatMessage: () => void;
  guideModal: GuideModalData | null;
  setGuideModal: (modal: GuideModalData | null) => void;
  selectedBookingForDetails: BookingRecord | null;
  setSelectedBookingForDetails: (booking: BookingRecord | null) => void;
  newBookingModalOpen: boolean;
  setNewBookingModalOpen: (open: boolean) => void;
  newBookingForm: NewBookingFormState;
  setNewBookingForm: React.Dispatch<React.SetStateAction<NewBookingFormState>>;
  handleCreateManualBooking: (e: React.FormEvent) => void;
  showDepositTooltip: boolean;
  setShowDepositTooltip: React.Dispatch<React.SetStateAction<boolean>>;
  checklistExpanded: boolean;
  setChecklistExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  devSandboxOpen: boolean;
  setDevSandboxOpen: React.Dispatch<React.SetStateAction<boolean>>;
  checklist: {
    items: Array<{
      id: string;
      title: string;
      status: 'completed' | 'in_progress' | 'pending';
      badgeText: string;
      description: string;
      actionLabel: string;
      onAction: () => void;
    }>;
    completedCount: number;
    totalCount: number;
    percent: number;
  };
  metrics: {
    confirmedCount: number;
    heldCount: number;
    verifiedDepositKobo: number;
    pendingVerificationCount: number;
    conversationsCount: number;
    needsAttentionCount: number;
  };
  needsAttentionItems: Array<{
    id: string;
    type: 'customer_request' | 'payment_verification';
    typeLabel: string;
    customerName: string;
    customerPhone: string;
    description: string;
    time: string;
    priority: 'High' | 'Normal';
    onAction: () => void;
  }>;
  recentActivities: Array<{
    id: string;
    title: string;
    description: string;
    time: string;
    icon: string;
    badgeColor: string;
  }>;
  handleCreateSimulatedBooking: () => void;
  handleVerifyKoraDeposit: (bookingId: string) => void;
  handleFlagPaymentPendingVerification: (bookingId: string) => void;
  handleTriggerHumanEscalation: () => void;
  handleExpireHold: (bookingId: string) => void;
  refreshWorkspaceData: () => void;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const activeNav = useMemo(() => getNavSectionFromPathname(pathname), [pathname]);

  const setActiveNav = useCallback(
    (section: NavSection) => {
      router.push(NAV_SECTION_ROUTES[section]);
    },
    [router],
  );

  const [sidebarOpenMobile, setSidebarOpenMobile] = useState(false);
  const [workspace, setWorkspace] = useState<OnboardingState>(DEFAULT_WORKSPACE);
  const [apiState, setApiState] = useState<ApiState>({
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
  const [guideModal, setGuideModal] = useState<GuideModalData | null>(null);
  const [selectedBookingForDetails, setSelectedBookingForDetails] = useState<BookingRecord | null>(
    null,
  );
  const [newBookingModalOpen, setNewBookingModalOpen] = useState(false);
  const [newBookingForm, setNewBookingForm] = useState<NewBookingFormState>({
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

  const refreshWorkspaceData = useCallback(() => {
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

  useEffect(() => {
    refreshWorkspaceData();
  }, [refreshWorkspaceData]);

  const saveBookings = useCallback((next: BookingRecord[]) => {
    setBookings(next);
    try {
      localStorage.setItem('switchboard_dashboard_bookings', JSON.stringify(next));
    } catch {
      // ignore
    }
  }, []);

  const saveConversations = useCallback((next: ConversationRecord[]) => {
    setConversations(next);
    try {
      localStorage.setItem('switchboard_dashboard_conversations', JSON.stringify(next));
    } catch {
      // ignore
    }
  }, []);

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

  const handleCreateSimulatedBooking = useCallback(() => {
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
  }, [bookings, conversations.length, saveBookings, saveConversations, workspace]);

  const checklist = useMemo(() => {
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
  }, [
    apiState.agentEnabled,
    apiState.whatsappConnected,
    bookings.length,
    handleCreateSimulatedBooking,
    setActiveNav,
    workspace,
  ]);

  const handleVerifyKoraDeposit = useCallback(
    (bookingId: string) => {
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
    },
    [bookings, saveBookings],
  );

  const handleFlagPaymentPendingVerification = useCallback(
    (bookingId: string) => {
      const next = bookings.map((b) =>
        b.id === bookingId
          ? {
              ...b,
              paymentStatus: 'pending_verification' as const,
            }
          : b,
      );
      saveBookings(next);
    },
    [bookings, saveBookings],
  );

  const handleTriggerHumanEscalation = useCallback(() => {
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
  }, [conversations, saveConversations]);

  const handleCreateManualBooking = useCallback(
    (e: React.FormEvent) => {
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
    },
    [
      bookings,
      newBookingForm,
      saveBookings,
      workspace.depositAmount,
      workspace.services,
      workspace.staff,
    ],
  );

  const handleExpireHold = useCallback(
    (bookingId: string) => {
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
    },
    [bookings, saveBookings],
  );

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
  }, [conversations, bookings, setActiveNav]);

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

  const handleSendWebChatMessage = useCallback(() => {
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
  }, [chatInput, conversations, saveConversations, workspace]);

  const copyBookingLink = useCallback(() => {
    const url = `${window.location.origin}/b/${workspace.slug}`;
    navigator.clipboard.writeText(url);
    setCopiedSlug(true);
    setTimeout(() => setCopiedSlug(false), 2000);
  }, [workspace.slug]);

  const handleSavePaymentSettings = useCallback(
    async (nextWorkspace?: OnboardingState) => {
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
    },
    [apiState.agentEnabled, workspace],
  );

  const value: DashboardContextValue = {
    activeNav,
    setActiveNav,
    sidebarOpenMobile,
    setSidebarOpenMobile,
    workspace,
    setWorkspace,
    apiState,
    setApiState,
    bookings,
    conversations,
    saveBookings,
    saveConversations,
    copiedSlug,
    copyBookingLink,
    workspaceMenuOpen,
    setWorkspaceMenuOpen,
    savingPaymentSettings,
    paymentSaveNotice,
    handleSavePaymentSettings,
    chatDrawerOpen,
    setChatDrawerOpen,
    chatInput,
    setChatInput,
    handleSendWebChatMessage,
    guideModal,
    setGuideModal,
    selectedBookingForDetails,
    setSelectedBookingForDetails,
    newBookingModalOpen,
    setNewBookingModalOpen,
    newBookingForm,
    setNewBookingForm,
    handleCreateManualBooking,
    showDepositTooltip,
    setShowDepositTooltip,
    checklistExpanded,
    setChecklistExpanded,
    devSandboxOpen,
    setDevSandboxOpen,
    checklist,
    metrics,
    needsAttentionItems,
    recentActivities,
    handleCreateSimulatedBooking,
    handleVerifyKoraDeposit,
    handleFlagPaymentPendingVerification,
    handleTriggerHumanEscalation,
    handleExpireHold,
    refreshWorkspaceData,
  };

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return ctx;
}
