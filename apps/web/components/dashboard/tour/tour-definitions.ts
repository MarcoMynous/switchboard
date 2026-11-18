import type { NavSection } from '../DashboardContext';
import type { TourId } from './tour-storage';

export interface TourStepDefinition {
  id: string;
  /** CSS selector for the target element; omit for a centered summary/welcome step */
  target?: string;
  title: string;
  description: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  /** Optional route to navigate to before showing this step */
  route?: string;
}

export interface PageTourConfig {
  tourId: TourId;
  label: string;
  route: string;
  steps: TourStepDefinition[];
}

export const INTRO_TOUR_ID: TourId = 'intro_v1';

export const INTRO_TOUR_DESKTOP_STEPS: TourStepDefinition[] = [
  {
    id: 'workspace-switcher',
    target: '[data-tour="workspace-switcher"]',
    title: 'Your Business Workspace',
    description:
      'See your active business name here and quickly jump to your public booking page, deposit settings, or setup wizard.',
    side: 'right',
    align: 'start',
    route: '/dashboard',
  },
  {
    id: 'overview-metrics',
    target: '[data-tour="overview-metrics"]',
    title: 'Daily Overview at a Glance',
    description:
      'Track today’s confirmed bookings, verified Kora deposits, appointments waiting for payment, and items needing your attention.',
    side: 'bottom',
    align: 'center',
    route: '/dashboard',
  },
  {
    id: 'todays-appointments',
    target: '[data-tour="todays-appointments"]',
    title: 'Today’s Appointments',
    description:
      'Monitor every customer booked for today, see live deposit hold timers, and check payment or arrival status in one place.',
    side: 'top',
    align: 'center',
    route: '/dashboard',
  },
  {
    id: 'nav-bookings',
    target: '[data-tour="nav-bookings"]',
    title: 'Bookings Calendar & List',
    description:
      'View all upcoming appointments, create walk-in bookings for customers, and reschedule or cancel slots anytime.',
    side: 'right',
    align: 'center',
  },
  {
    id: 'nav-conversations',
    target: '[data-tour="nav-conversations"]',
    title: 'Customer Conversations',
    description:
      'Read live WhatsApp and web chat threads handled by your AI receptionist and step in whenever you want to reply personally.',
    side: 'right',
    align: 'center',
  },
  {
    id: 'nav-customers',
    target: '[data-tour="nav-customers"]',
    title: 'Customer Directory',
    description:
      'Look up returning customers, check their visit history, and keep helpful notes for your team.',
    side: 'right',
    align: 'center',
  },
  {
    id: 'nav-needs-attention',
    target: '[data-tour="nav-needs-attention"]',
    title: 'Needs Attention Queue',
    description:
      'Anything that needs a human decision—like special requests or pending payment checks—shows up here so nothing slips through.',
    side: 'right',
    align: 'center',
  },
  {
    id: 'nav-ai-receptionist',
    target: '[data-tour="nav-ai-receptionist"]',
    title: 'AI Receptionist Studio',
    description:
      'Customize your assistant’s name, greeting, tone, and FAQs—and test how it replies before customers chat with it.',
    side: 'right',
    align: 'center',
  },
  {
    id: 'nav-services-staff',
    target: '[data-tour="nav-services-staff"]',
    title: 'Services & Staff',
    description:
      'Add the services you offer, set prices and durations, and assign which staff members can take each booking.',
    side: 'right',
    align: 'center',
  },
  {
    id: 'nav-working-hours',
    target: '[data-tour="nav-working-hours"]',
    title: 'Working Hours',
    description:
      'Control your opening hours and availability rules so customers can only book times your shop is actually open.',
    side: 'right',
    align: 'center',
  },
  {
    id: 'public-booking-link',
    target: '[data-tour="public-booking-link"]',
    title: 'Share Your Booking Link',
    description:
      'Copy your public booking link or open your booking page to share on Instagram, WhatsApp, and Google Maps.',
    side: 'bottom',
    align: 'end',
  },
  {
    id: 'tour-complete',
    title: 'You’re Ready to Go',
    description:
      'You can replay this tour or open a quick guide for any section anytime from the Product Tour button in the top bar.',
  },
];

export const INTRO_TOUR_MOBILE_STEPS: TourStepDefinition[] = [
  {
    id: 'mobile-nav-trigger',
    target: '[data-tour="mobile-nav-trigger"]',
    title: 'Full Dashboard Menu',
    description:
      'Tap here anytime to switch between Bookings, Conversations, Customers, AI Receptionist, Services & Staff, and Settings.',
    side: 'bottom',
    align: 'start',
    route: '/dashboard',
  },
  {
    id: 'overview-metrics',
    target: '[data-tour="overview-metrics"]',
    title: 'Daily Overview at a Glance',
    description:
      'Track confirmed bookings, verified Kora deposits, pending holds, and items needing your attention.',
    side: 'bottom',
    align: 'center',
    route: '/dashboard',
  },
  {
    id: 'todays-appointments',
    target: '[data-tour="todays-appointments"]',
    title: 'Today’s Appointments',
    description:
      'Check upcoming customers for today and see which bookings have verified deposits or active holds.',
    side: 'top',
    align: 'center',
    route: '/dashboard',
  },
  {
    id: 'mobile-bottom-nav',
    target: '[data-tour="mobile-bottom-nav"]',
    title: 'Quick Bottom Navigation',
    description: 'Jump straight to Home, Bookings, Chats, Attention, or Services with one tap.',
    side: 'top',
    align: 'center',
  },
  {
    id: 'public-booking-link',
    target: '[data-tour="public-booking-link"]',
    title: 'Share Your Booking Link',
    description:
      'Copy your public booking link to share with customers on WhatsApp and social media.',
    side: 'bottom',
    align: 'end',
  },
  {
    id: 'tour-complete',
    title: 'You’re Ready to Go',
    description: 'You can replay this tour anytime from the Tour button in the top bar.',
  },
];

/**
 * Page-specific tours are only registered for pages whose core features
 * are implemented (not placeholder views).
 */
export const PAGE_TOURS: Partial<Record<NavSection, PageTourConfig>> = {
  bookings: {
    tourId: 'bookings_v1',
    label: 'Bookings Tour',
    route: '/dashboard/bookings',
    steps: [
      {
        id: 'bookings-new-btn',
        target: '[data-tour="bookings-new-btn"]',
        title: 'Create Walk-In Bookings',
        description: 'Add a booking manually when a customer walks in or calls your shop directly.',
        side: 'bottom',
        align: 'start',
      },
      {
        id: 'bookings-summary',
        target: '[data-tour="bookings-summary"]',
        title: 'Filter by Booking Status',
        description:
          'Click any summary card to filter between confirmed appointments, active holds, or bookings needing attention.',
        side: 'bottom',
        align: 'center',
      },
    ],
  },
  conversations: {
    tourId: 'conversations_v1',
    label: 'Conversations Tour',
    route: '/dashboard/conversations',
    steps: [
      {
        id: 'conversations-actions',
        target: '[data-tour="conversations-actions"]',
        title: 'Filter & Test Conversations',
        description:
          'Quickly filter chats that need a human reply or open the test drawer to preview your AI receptionist.',
        side: 'bottom',
        align: 'end',
      },
      {
        id: 'conversations-summary',
        target: '[data-tour="conversations-summary"]',
        title: 'Conversation Health',
        description:
          'See how many chats your AI is handling automatically versus how many need your personal attention.',
        side: 'bottom',
        align: 'center',
      },
    ],
  },
  customers: {
    tourId: 'customers_v1',
    label: 'Customers Tour',
    route: '/dashboard/customers',
    steps: [
      {
        id: 'customers-actions',
        target: '[data-tour="customers-actions"]',
        title: 'Search & Add Customers',
        description:
          'Find any customer by name or phone number, or add a new customer profile manually.',
        side: 'bottom',
        align: 'end',
      },
      {
        id: 'customers-summary',
        target: '[data-tour="customers-summary"]',
        title: 'Customer Insights',
        description:
          'Track total customers and recent additions across WhatsApp, web bookings, and walk-ins.',
        side: 'bottom',
        align: 'center',
      },
    ],
  },
  'ai-receptionist': {
    tourId: 'ai-receptionist_v1',
    label: 'AI Receptionist Tour',
    route: '/dashboard/ai-receptionist',
    steps: [
      {
        id: 'ai-status-card',
        target: '[data-tour="ai-status-card"]',
        title: 'Assistant Status & Controls',
        description:
          'See your assistant’s current availability, tone, and pause or resume automated replies whenever you need.',
        side: 'bottom',
        align: 'center',
      },
      {
        id: 'ai-test-btn',
        target: '[data-tour="ai-test-btn"]',
        title: 'Test Before Going Live',
        description:
          'Try asking your assistant about prices, services, or booking times to verify its answers.',
        side: 'bottom',
        align: 'end',
      },
    ],
  },
  'services-staff': {
    tourId: 'services-staff_v1',
    label: 'Services & Staff Tour',
    route: '/dashboard/services-staff',
    steps: [
      {
        id: 'services-staff-actions',
        target: '[data-tour="services-staff-actions"]',
        title: 'Add Services & Team Members',
        description:
          'Create new services with prices and durations, or add staff members who can take appointments.',
        side: 'bottom',
        align: 'end',
      },
      {
        id: 'services-staff-summary',
        target: '[data-tour="services-staff-summary"]',
        title: 'Catalog Readiness',
        description:
          'Spot any services missing pricing or staff assignments so customers can book smoothly.',
        side: 'bottom',
        align: 'center',
      },
    ],
  },
  payments: {
    tourId: 'payments_v1',
    label: 'Payments Tour',
    route: '/dashboard/payments',
    steps: [
      {
        id: 'payments-kora-settings',
        target: '[data-tour="payments-kora-settings"]',
        title: 'Deposit & Kora Fee Rules',
        description:
          'Choose whether customers pay the Kora processing fee and set your automatic free-cancellation refund window.',
        side: 'bottom',
        align: 'center',
      },
    ],
  },
};
