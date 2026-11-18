'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  ReceptionistDaySchedule,
  ReceptionistFaqItem,
  ReceptionistServiceSummary,
  ReceptionistStaffSummary,
} from '@/app/api/ai-receptionist/route';
import { AppIcon } from '@/components/AppIcon';
import { Button } from '@/components/ui/button';
import { useDashboard } from '../DashboardContext';

type SectionTab = 'identity' | 'knowledge' | 'capabilities' | 'handoff' | 'channels' | 'test_chat';

interface AiReceptionistApiResponse {
  ok: boolean;
  role: 'owner' | 'staff';
  business: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
    location: string;
    phone: string;
    advanceDays: number;
    allowSameDay: boolean;
    depositRequired: boolean;
    depositType: string;
    defaultDepositKobo: number;
    freeCancelHours: number;
    merchantBearsCost: boolean;
    cancellationPolicy: string;
    servicesCount: number;
    staffCount: number;
    selfProvided: boolean;
    services: ReceptionistServiceSummary[];
    staff: ReceptionistStaffSummary[];
    schedule: ReceptionistDaySchedule[];
  };
  receptionist: {
    agentEnabled: boolean;
    assistantName: string;
    primaryLanguage: 'English' | 'Nigerian Pidgin';
    tone: 'Friendly' | 'Professional' | 'Casual';
    greeting: string;
    shortIntro: string;
    handoffMessage: string;
    escalationContact: string;
    faqs: ReceptionistFaqItem[];
    capabilities: Array<{
      id: string;
      title: string;
      description: string;
      icon: string;
      badge?: string;
      enabled: boolean;
    }>;
    updatedAt: string;
  };
  readiness: {
    hasBusinessProfile: boolean;
    hasServices: boolean;
    hasStaffOrSolo: boolean;
    hasWorkingHours: boolean;
    koraReady: boolean;
    webChatReady: boolean;
    whatsappConnected: boolean;
    whatsappPhoneNumberId: string | null;
    whatsappNumberLabel: string | null;
  };
  activity: {
    conversationsToday: number;
    bookingRequestsInitiated: number;
    confirmedFromAi: number;
    humanHandoffsRaised: number;
    pendingPaymentVerifications: number;
  };
  error?: string;
}

const FAQ_CATEGORIES = [
  'Services and Pricing',
  'Opening Hours',
  'Booking Policies',
  'Payment and Deposits',
  'Location and Directions',
  'General Business Information',
];

const SECTIONS: Array<{
  id: SectionTab;
  number: string;
  label: string;
  icon: string;
}> = [
  { id: 'identity', number: '1', label: 'Identity & Greeting', icon: 'badge' },
  { id: 'knowledge', number: '2', label: 'Business Knowledge', icon: 'menu_book' },
  { id: 'capabilities', number: '3', label: 'Booking Capabilities', icon: 'event_available' },
  { id: 'handoff', number: '4', label: 'Human Handoff', icon: 'support_agent' },
  { id: 'channels', number: '5', label: 'Channels', icon: 'hub' },
  { id: 'test_chat', number: '6', label: 'Test Chat', icon: 'chat' },
];

function formatDateTime(iso: string | null, timezone: string): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('en-NG', {
      timeZone: timezone || 'Africa/Lagos',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatNaira(kobo: number): string {
  return `₦${Math.round(kobo / 100).toLocaleString('en-NG')}`;
}

export function AiReceptionistView() {
  const { workspace, setActiveNav, refreshWorkspaceData } = useDashboard();

  const [activeTab, setActiveTab] = useState<SectionTab>('identity');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [data, setData] = useState<AiReceptionistApiResponse | null>(null);

  // Editable form state
  const [assistantName, setAssistantName] = useState('Maya');
  const [primaryLanguage, setPrimaryLanguage] = useState<'English' | 'Nigerian Pidgin'>('English');
  const [tone, setTone] = useState<'Friendly' | 'Professional' | 'Casual'>('Friendly');
  const [greeting, setGreeting] = useState('');
  const [shortIntro, setShortIntro] = useState('');
  const [handoffMessage, setHandoffMessage] = useState('');
  const [escalationContact, setEscalationContact] = useState('');
  const [faqs, setFaqs] = useState<ReceptionistFaqItem[]>([]);

  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);
  const [toggleFeedback, setToggleFeedback] = useState<string | null>(null);
  const [copiedPublicUrl, setCopiedPublicUrl] = useState(false);

  // FAQ form & search
  const [faqSearch, setFaqSearch] = useState('');
  const [faqCategoryFilter, setFaqCategoryFilter] = useState<string>('All');
  const [editingFaqId, setEditingFaqId] = useState<string | null>(null);
  const [faqModalOpen, setFaqModalOpen] = useState(false);
  const [faqQuestion, setFaqQuestion] = useState('');
  const [faqAnswer, setFaqAnswer] = useState('');
  const [faqCategory, setFaqCategory] = useState(
    FAQ_CATEGORIES[0] ?? 'General Business Information',
  );
  const [faqValidationError, setFaqValidationError] = useState<string | null>(null);

  // Test chat state (strictly isolated)
  const [testMessages, setTestMessages] = useState<
    Array<{
      id: string;
      sender: 'customer' | 'agent' | 'system';
      text: string;
      outcome?: string;
      matchedSource?: string;
    }>
  >([]);
  const [testInput, setTestInput] = useState('');
  const [testSending, setTestSending] = useState(false);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setAuthNotice(null);

    try {
      const url = workspace.slug
        ? `/api/ai-receptionist?slug=${encodeURIComponent(workspace.slug)}`
        : '/api/ai-receptionist';
      const res = await fetch(url);
      if (res.status === 401) {
        setAuthNotice('Sign in to configure and test your AI receptionist.');
        setData(null);
        return;
      }
      const json = (await res.json()) as AiReceptionistApiResponse;
      if (!res.ok || !json.ok) {
        setLoadError(json.error || "We couldn't load your receptionist settings.");
        return;
      }

      setData(json);
      setAssistantName(json.receptionist.assistantName);
      setPrimaryLanguage(json.receptionist.primaryLanguage);
      setTone(json.receptionist.tone);
      setGreeting(json.receptionist.greeting);
      setShortIntro(json.receptionist.shortIntro);
      setHandoffMessage(json.receptionist.handoffMessage);
      setEscalationContact(json.receptionist.escalationContact);
      setFaqs(json.receptionist.faqs);
      setDirty(false);
    } catch {
      setLoadError("We couldn't load your receptionist settings.");
    } finally {
      setLoading(false);
    }
  }, [workspace.slug]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const validationIssue = useMemo(() => {
    const trimmedName = assistantName.trim();
    const trimmedGreeting = greeting.trim();
    const trimmedHandoff = handoffMessage.trim();

    if (trimmedName.length < 2 || trimmedName.length > 40) {
      return 'Assistant name must be between 2 and 40 characters.';
    }
    if (trimmedGreeting.length < 10 || trimmedGreeting.length > 600) {
      return 'Welcome message must be between 10 and 600 characters.';
    }
    if (
      trimmedGreeting.toLowerCase().includes('confirmed without payment') ||
      trimmedGreeting.toLowerCase().includes('no deposit needed even if required') ||
      trimmedGreeting.toLowerCase().includes('guaranteed without deposit')
    ) {
      return 'Welcome message cannot override deposit or confirmation rules.';
    }
    if (trimmedHandoff.length < 10 || trimmedHandoff.length > 400) {
      return 'Handoff message must be between 10 and 400 characters.';
    }
    return null;
  }, [assistantName, greeting, handoffMessage]);

  const handleSave = async () => {
    if (data?.role !== 'owner') return;
    if (validationIssue) {
      setSaveState('error');
      setSaveError(validationIssue);
      return;
    }

    setSaveState('saving');
    setSaveError(null);
    try {
      const res = await fetch('/api/ai-receptionist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_config',
          slug: data.business.slug,
          assistantName: assistantName.trim(),
          primaryLanguage,
          tone,
          greeting: greeting.trim(),
          shortIntro: shortIntro.trim(),
          handoffMessage: handoffMessage.trim(),
          escalationContact: escalationContact.trim(),
          faqs,
        }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setSaveState('error');
        setSaveError(json.error || 'Could not save configuration.');
        return;
      }
      setSaveState('saved');
      setDirty(false);
      await loadConfig();
      refreshWorkspaceData();
    } catch {
      setSaveState('error');
      setSaveError('Network error while saving changes.');
    }
  };

  const handleToggleAgent = async () => {
    if (data?.role !== 'owner') return;
    const nextEnabled = !data.receptionist.agentEnabled;
    setToggling(true);
    setToggleFeedback(null);
    try {
      const res = await fetch('/api/ai-receptionist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle_agent',
          slug: data.business.slug,
          agentEnabled: nextEnabled,
        }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string; agentEnabled?: boolean };
      if (!res.ok || !json.ok) {
        setToggleFeedback(json.error || 'Could not change receptionist status.');
        return;
      }
      if (nextEnabled) {
        setToggleFeedback(
          data.readiness.whatsappConnected
            ? 'AI receptionist enabled (`agent_enabled = true`) for Web Chat and WhatsApp.'
            : 'AI receptionist enabled (`agent_enabled = true`) for Web Chat. Connect WhatsApp in Integrations when ready.',
        );
      } else {
        setToggleFeedback(
          'AI receptionist paused (`agent_enabled = false`). Existing bookings, 15-minute holds, and Kora payment verification remain active.',
        );
      }
      await loadConfig();
      refreshWorkspaceData();
    } catch {
      setToggleFeedback('Network error while updating receptionist status.');
    } finally {
      setToggling(false);
    }
  };

  const handleSendTestMessage = async (textOverride?: string) => {
    const msg = (textOverride ?? testInput).trim();
    if (!msg || !data) return;
    if (!textOverride) setTestInput('');
    setTestSending(true);
    setTestMessages((prev) => [...prev, { id: `u_${Date.now()}`, sender: 'customer', text: msg }]);

    try {
      const res = await fetch('/api/ai-receptionist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test_chat',
          slug: data.business.slug,
          message: msg,
          draft: {
            assistantName: assistantName.trim(),
            primaryLanguage,
            tone,
            greeting: greeting.trim(),
            handoffMessage: handoffMessage.trim(),
            escalationContact: escalationContact.trim(),
            faqs,
          },
        }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        reply?: string;
        outcome?: string;
        matchedSource?: string;
        error?: string;
      };
      if (!res.ok || !json.ok || !json.reply) {
        setTestMessages((prev) => [
          ...prev,
          {
            id: `sys_${Date.now()}`,
            sender: 'system',
            text: json.error || 'Test message failed.',
            outcome: 'Configuration issue detected',
          },
        ]);
        return;
      }
      setTestMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          sender: 'agent',
          text: json.reply as string,
          outcome: json.outcome,
          matchedSource: json.matchedSource,
        },
      ]);
    } catch {
      setTestMessages((prev) => [
        ...prev,
        {
          id: `sys_${Date.now()}`,
          sender: 'system',
          text: 'Network error while running test chat.',
        },
      ]);
    } finally {
      setTestSending(false);
    }
  };

  const handleCopyPublicLink = async () => {
    if (!data) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const link = `${origin}/b/${data.business.slug}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedPublicUrl(true);
      setTimeout(() => setCopiedPublicUrl(false), 2000);
    } catch {
      setCopiedPublicUrl(false);
    }
  };

  const filteredFaqs = useMemo(() => {
    const q = faqSearch.trim().toLowerCase();
    return faqs.filter((f) => {
      if (faqCategoryFilter !== 'All' && f.category !== faqCategoryFilter) {
        return false;
      }
      if (!q) return true;
      return (
        f.question.toLowerCase().includes(q) ||
        f.answer.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q)
      );
    });
  }, [faqCategoryFilter, faqSearch, faqs]);

  const openAddFaqModal = () => {
    setEditingFaqId(null);
    setFaqQuestion('');
    setFaqAnswer('');
    setFaqCategory(FAQ_CATEGORIES[0] ?? 'General Business Information');
    setFaqValidationError(null);
    setFaqModalOpen(true);
  };

  const openEditFaqModal = (item: ReceptionistFaqItem) => {
    setEditingFaqId(item.id);
    setFaqQuestion(item.question);
    setFaqAnswer(item.answer);
    setFaqCategory(item.category);
    setFaqValidationError(null);
    setFaqModalOpen(true);
  };

  const handleSaveFaqModal = (e: React.FormEvent) => {
    e.preventDefault();
    const q = faqQuestion.trim();
    const a = faqAnswer.trim();
    if (q.length < 3 || a.length < 3) {
      setFaqValidationError('Both question and answer must be at least 3 characters.');
      return;
    }
    const lowerAnswer = a.toLowerCase();
    if (
      lowerAnswer.includes('confirmed without payment') ||
      lowerAnswer.includes('no deposit needed even if required')
    ) {
      setFaqValidationError(
        'FAQ answer cannot contradict backend deposit or confirmation requirements.',
      );
      return;
    }

    if (editingFaqId) {
      setFaqs((prev) =>
        prev.map((f) =>
          f.id === editingFaqId
            ? {
                ...f,
                question: q,
                answer: a,
                category: faqCategory,
                updatedAt: new Date().toISOString(),
              }
            : f,
        ),
      );
    } else {
      setFaqs((prev) => [
        {
          id: `faq_${Date.now()}`,
          question: q,
          answer: a,
          category: faqCategory,
          updatedAt: new Date().toISOString(),
        },
        ...prev,
      ]);
    }
    setDirty(true);
    setSaveState('idle');
    setFaqModalOpen(false);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-14 rounded-xl bg-surface-container-low animate-pulse" />
        <div className="h-36 rounded-xl bg-surface-container-low animate-pulse" />
        <div className="h-72 rounded-xl bg-surface-container-low animate-pulse" />
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
          We couldn&apos;t load your receptionist settings.
        </h2>
        <p className="text-xs text-text-secondary">{loadError}</p>
        <Button type="button" size="sm" onClick={() => void loadConfig()}>
          Retry
        </Button>
      </div>
    );
  }

  const isOwner = data.role === 'owner';
  const timezone = data.business.timezone || 'Africa/Lagos';
  const depositNaira = Math.round(data.business.defaultDepositKobo / 100);
  const openDays = data.business.schedule.filter((d) => d.open);
  const overallStatus = !data.readiness.webChatReady
    ? { label: 'Setup Required', badge: 'bg-amber-100 text-amber-900 border-amber-300' }
    : data.receptionist.agentEnabled
      ? { label: 'Active', badge: 'bg-emerald-100 text-emerald-800 border-emerald-200' }
      : { label: 'Paused', badge: 'bg-slate-100 text-slate-700 border-slate-300' };

  const webChatStatusLabel = !data.readiness.webChatReady
    ? 'Setup Required'
    : data.receptionist.agentEnabled
      ? 'Active'
      : 'Paused';

  const whatsappStatusLabel = !data.readiness.whatsappConnected
    ? 'Setup Required'
    : data.receptionist.agentEnabled
      ? 'Active'
      : 'Connected (Paused)';

  return (
    <div data-tour="ai-receptionist-panel" className="flex flex-col w-full space-y-6 max-w-6xl">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-4 border-b border-border/50">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="font-headline-md text-2xl font-bold text-text-primary tracking-tight">
              AI Receptionist
            </h1>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${overallStatus.badge}`}
            >
              {overallStatus.label}
            </span>
            {dirty && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                Unsaved Changes
              </span>
            )}
            {saveState === 'saved' && !dirty && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                Saved
              </span>
            )}
          </div>
          <p className="text-sm text-text-secondary">
            Configure your assistant&apos;s identity, business knowledge, booking capabilities,
            human handoff rules, channels, and isolated test chat.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setActiveTab('test_chat')}
            className="h-9 text-xs"
          >
            <AppIcon name="chat" className="text-[16px]" />
            <span>Test Chat</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setActiveNav('conversations')}
            className="h-9 text-xs"
          >
            <AppIcon name="forum" className="text-[16px]" />
            <span>Conversations</span>
          </Button>
          {isOwner && (
            <Button
              type="button"
              size="sm"
              disabled={!dirty || saveState === 'saving'}
              onClick={() => void handleSave()}
              className="h-9 text-xs"
            >
              <AppIcon name="save" className="text-[16px]" />
              <span>{saveState === 'saving' ? 'Saving...' : 'Save Changes'}</span>
            </Button>
          )}
        </div>
      </div>

      {saveError && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800 flex items-center justify-between gap-3"
        >
          <span>{saveError}</span>
          <button
            type="button"
            onClick={() => setSaveError(null)}
            className="font-semibold underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {toggleFeedback && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-xs text-indigo-900 flex items-center justify-between gap-3">
          <span>{toggleFeedback}</span>
          <button
            type="button"
            onClick={() => setToggleFeedback(null)}
            className="font-semibold underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Assistant Activation & Today's Activity Summary */}
      <div className="rounded-xl border border-border/60 bg-white p-5 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary text-white flex items-center justify-center shrink-0">
              <AppIcon name="smart_toy" className="text-[24px]" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-headline-sm text-lg font-bold text-text-primary">
                  {assistantName || data.receptionist.assistantName}
                </h2>
                <span className="text-xs text-text-secondary">
                  • {tone} • {primaryLanguage}
                </span>
              </div>
              <p className="text-xs text-text-secondary">
                Business: <strong className="text-text-primary">{data.business.name}</strong> • Last
                saved {formatDateTime(data.receptionist.updatedAt, timezone)}
              </p>
              <div className="flex items-center gap-2 flex-wrap pt-1 text-xs">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${
                    data.readiness.webChatReady && data.receptionist.agentEnabled
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : data.readiness.webChatReady
                        ? 'bg-slate-100 text-slate-700 border-slate-300'
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                  }`}
                >
                  Web Chat: {webChatStatusLabel}
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${
                    data.readiness.whatsappConnected && data.receptionist.agentEnabled
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : data.readiness.whatsappConnected
                        ? 'bg-slate-100 text-slate-700 border-slate-300'
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                  }`}
                >
                  WhatsApp: {whatsappStatusLabel}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setActiveTab('channels')}
              className="h-8 text-xs"
            >
              Channel Readiness
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setActiveTab('test_chat')}
              className="h-8 text-xs"
            >
              Open Test Chat
            </Button>
            {isOwner && (
              <Button
                type="button"
                variant={data.receptionist.agentEnabled ? 'outline' : 'default'}
                size="sm"
                disabled={toggling}
                onClick={() => void handleToggleAgent()}
                className="h-8 text-xs"
              >
                {toggling
                  ? 'Updating...'
                  : data.receptionist.agentEnabled
                    ? 'Pause Receptionist'
                    : 'Enable Receptionist'}
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-border/50">
          <div className="rounded-lg bg-surface-container-lowest border border-border/40 px-3.5 py-2.5">
            <span className="text-[11px] text-text-secondary block">Conversations today</span>
            <span className="font-headline-sm text-lg font-bold text-text-primary">
              {data.activity.conversationsToday}
            </span>
          </div>
          <div className="rounded-lg bg-surface-container-lowest border border-border/40 px-3.5 py-2.5">
            <span className="text-[11px] text-text-secondary block">AI booking requests</span>
            <span className="font-headline-sm text-lg font-bold text-text-primary">
              {data.activity.bookingRequestsInitiated}
            </span>
          </div>
          <div className="rounded-lg bg-surface-container-lowest border border-border/40 px-3.5 py-2.5">
            <span className="text-[11px] text-text-secondary block">Confirmed from AI chats</span>
            <span className="font-headline-sm text-lg font-bold text-emerald-700">
              {data.activity.confirmedFromAi}
            </span>
          </div>
          <div className="rounded-lg bg-surface-container-lowest border border-border/40 px-3.5 py-2.5">
            <span className="text-[11px] text-text-secondary block">Human handoffs active</span>
            <span className="font-headline-sm text-lg font-bold text-amber-700">
              {data.activity.humanHandoffsRaised}
            </span>
          </div>
        </div>
      </div>

      {/* Six-Section Navigation */}
      <div className="md:hidden">
        <select
          aria-label="Select AI Receptionist section"
          value={activeTab}
          onChange={(e) => setActiveTab(e.target.value as SectionTab)}
          className="w-full h-10 rounded-lg border border-border bg-white px-3 text-sm font-medium text-text-primary"
        >
          {SECTIONS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.number}. {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="hidden md:flex items-center gap-1.5 border-b border-border/60 pb-2 overflow-x-auto">
        {SECTIONS.map((s) => {
          const active = activeTab === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveTab(s.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                active
                  ? 'bg-primary text-white'
                  : 'text-text-secondary hover:bg-surface-container-low hover:text-text-primary'
              }`}
            >
              <AppIcon name={s.icon} className="text-[16px]" />
              <span>
                {s.number}. {s.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* SECTION 1: Identity & Greeting */}
      {activeTab === 'identity' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-xl border border-border/60 bg-white p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-headline-sm text-base font-bold text-text-primary">
                  1. Identity &amp; Greeting
                </h3>
                <p className="text-xs text-text-secondary">
                  Configure your assistant&apos;s name, tone, supported language, and opening
                  message.
                </p>
              </div>
              {isOwner && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const defaultWelcome =
                      primaryLanguage === 'Nigerian Pidgin'
                        ? `How far! Welcome to ${data.business.name}. Na ${assistantName || 'Maya'} I be, your booking assistant. You wan book appointment or ask question?`
                        : `Hi! Welcome to ${data.business.name}. I'm ${assistantName || 'Maya'}, your booking assistant. Would you like to book an appointment or ask a question?`;
                    setGreeting(defaultWelcome);
                    setDirty(true);
                  }}
                  className="h-8 text-xs shrink-0"
                >
                  Use Default Greeting
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="ai-name" className="text-xs font-semibold text-text-primary block">
                  Assistant Name
                </label>
                <input
                  id="ai-name"
                  type="text"
                  disabled={!isOwner}
                  value={assistantName}
                  onChange={(e) => {
                    setAssistantName(e.target.value);
                    setDirty(true);
                    setSaveState('idle');
                  }}
                  maxLength={40}
                  placeholder="e.g. Maya"
                  className="w-full h-9 rounded-lg border border-border bg-white px-3 text-sm text-text-primary"
                />
                <p className="text-[11px] text-text-secondary">
                  2–40 characters ({assistantName.trim().length}/40)
                </p>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="ai-lang" className="text-xs font-semibold text-text-primary block">
                  Supported Language
                </label>
                <select
                  id="ai-lang"
                  disabled={!isOwner}
                  value={primaryLanguage}
                  onChange={(e) => {
                    setPrimaryLanguage(e.target.value as 'English' | 'Nigerian Pidgin');
                    setDirty(true);
                    setSaveState('idle');
                  }}
                  className="w-full h-9 rounded-lg border border-border bg-white px-3 text-sm text-text-primary"
                >
                  <option value="English">English (Nigerian-English friendly)</option>
                  <option value="Nigerian Pidgin">Nigerian Pidgin</option>
                </select>
                <p className="text-[11px] text-text-secondary">
                  Understands Nigerian booking phrases (&ldquo;low cut&rdquo;, &ldquo;I wan
                  book&rdquo;, &ldquo;abeg&rdquo;) in both modes.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-text-primary block">
                Communication Tone
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {(
                  [
                    {
                      id: 'Friendly',
                      desc: 'Warm, welcoming, and conversational',
                    },
                    {
                      id: 'Professional',
                      desc: 'Polite, concise, and structured',
                    },
                    {
                      id: 'Casual',
                      desc: 'Relaxed, direct, and easygoing',
                    },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    disabled={!isOwner}
                    onClick={() => {
                      setTone(option.id);
                      setDirty(true);
                      setSaveState('idle');
                    }}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      tone === option.id
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white text-text-primary border-border hover:bg-surface-container-low'
                    }`}
                  >
                    <span className="text-xs font-bold block">{option.id}</span>
                    <span
                      className={`text-[11px] mt-0.5 block ${
                        tone === option.id ? 'text-white/85' : 'text-text-secondary'
                      }`}
                    >
                      {option.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="ai-greeting"
                  className="text-xs font-semibold text-text-primary block"
                >
                  Welcome Message
                </label>
                <span className="text-[11px] text-text-secondary">
                  {greeting.trim().length}/600
                </span>
              </div>
              <textarea
                id="ai-greeting"
                rows={3}
                disabled={!isOwner}
                value={greeting}
                onChange={(e) => {
                  setGreeting(e.target.value);
                  setDirty(true);
                  setSaveState('idle');
                }}
                maxLength={600}
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary"
              />
              <p className="text-[11px] text-text-secondary">
                Shown when a customer opens Web Chat or starts a new WhatsApp conversation. Cannot
                override deposit or booking confirmation rules.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="ai-intro" className="text-xs font-semibold text-text-primary block">
                  Short Role Tagline (Optional)
                </label>
                <span className="text-[11px] text-text-secondary">
                  {shortIntro.trim().length}/200
                </span>
              </div>
              <input
                id="ai-intro"
                type="text"
                disabled={!isOwner}
                value={shortIntro}
                onChange={(e) => {
                  setShortIntro(e.target.value);
                  setDirty(true);
                  setSaveState('idle');
                }}
                maxLength={200}
                className="w-full h-9 rounded-lg border border-border bg-white px-3 text-sm text-text-primary"
              />
            </div>

            {validationIssue && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                {validationIssue}
              </div>
            )}
          </div>

          {/* Live Greeting Preview */}
          <div className="rounded-xl border border-border/60 bg-white p-5 space-y-4 h-fit">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
              Customer Welcome Preview
            </h4>
            <div className="rounded-xl bg-surface-container-lowest border border-border/50 p-4 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">
                  {assistantName.trim().slice(0, 1).toUpperCase() || 'M'}
                </div>
                <div>
                  <span className="text-xs font-semibold text-text-primary block">
                    {assistantName.trim() || 'Assistant'} • {data.business.name}
                  </span>
                  <span className="text-[11px] text-text-secondary block">
                    {tone} tone • {primaryLanguage}
                  </span>
                </div>
              </div>
              {shortIntro.trim() && (
                <p className="text-[11px] text-text-secondary italic border-l-2 border-primary/40 pl-2">
                  {shortIntro.trim()}
                </p>
              )}
              <div className="rounded-lg bg-white border border-border/50 p-3 text-xs text-text-primary leading-relaxed">
                {greeting.trim() || 'Enter a welcome message to preview how customers are greeted.'}
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setActiveTab('test_chat')}
              className="w-full h-8 text-xs"
            >
              Try in Test Chat
            </Button>
          </div>
        </div>
      )}

      {/* SECTION 2: Business Knowledge */}
      {activeTab === 'knowledge' && (
        <div className="space-y-6">
          {/* Read-Only Authoritative Summaries */}
          <div className="rounded-xl border border-border/60 bg-white p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-headline-sm text-base font-bold text-text-primary">
                  2. Business Knowledge — Authoritative Database Records (Read-Only)
                </h3>
                <p className="text-xs text-text-secondary mt-0.5">
                  {assistantName} reads prices, durations, schedules, and deposit rules directly
                  from your database records so they are never duplicated or out of sync.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveNav('services-staff')}
                  className="h-8 text-xs"
                >
                  Services &amp; Staff
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
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveNav('payments')}
                  className="h-8 text-xs"
                >
                  Payments
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Authoritative Services & Prices */}
              <div className="rounded-xl border border-border/50 bg-surface-container-lowest p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AppIcon name="content_cut" className="text-[18px] text-primary" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-text-primary">
                      Services &amp; Prices ({data.business.services.length})
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveNav('services-staff')}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Edit Catalog
                  </button>
                </div>

                {data.business.services.length === 0 ? (
                  <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    No services configured yet. Add services in Services &amp; Staff so your
                    receptionist can quote accurate prices and durations.
                  </p>
                ) : (
                  <div className="divide-y divide-border/40 rounded-lg border border-border/40 bg-white overflow-hidden">
                    {data.business.services.map((svc) => (
                      <div
                        key={svc.id}
                        className="px-3 py-2.5 flex items-center justify-between gap-2 text-xs"
                      >
                        <div>
                          <span className="font-semibold text-text-primary block">{svc.name}</span>
                          <span className="text-[11px] text-text-secondary">
                            {svc.durationMin} mins •{' '}
                            {svc.depositKobo > 0
                              ? `${formatNaira(svc.depositKobo)} deposit`
                              : 'No deposit'}
                          </span>
                        </div>
                        <span className="font-bold text-text-primary shrink-0">
                          {formatNaira(svc.priceKobo)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Authoritative Staff & Working Hours */}
              <div className="space-y-4">
                <div className="rounded-xl border border-border/50 bg-surface-container-lowest p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AppIcon name="badge" className="text-[18px] text-primary" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-text-primary">
                        Bookable Staff ({data.business.staffCount})
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveNav('services-staff')}
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      Manage Staff
                    </button>
                  </div>
                  {data.business.staff.length === 0 ? (
                    <p className="text-xs text-text-secondary">
                      {data.business.selfProvided
                        ? 'Solo operator mode enabled (owner provides services).'
                        : 'No staff members added yet.'}
                    </p>
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap">
                      {data.business.staff.map((st) => (
                        <span
                          key={st.id}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs ${
                            st.active
                              ? 'bg-white border-border/60 text-text-primary'
                              : 'bg-slate-100 border-slate-200 text-slate-500'
                          }`}
                        >
                          <span className="font-semibold">{st.name}</span>
                          <span className="text-[11px] text-text-secondary">({st.roleTitle})</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-border/50 bg-surface-container-lowest p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AppIcon name="schedule" className="text-[18px] text-primary" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-text-primary">
                        Schedule &amp; Policies ({timezone})
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveNav('working-hours')}
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      Edit Hours
                    </button>
                  </div>
                  <div className="text-xs text-text-secondary space-y-1.5">
                    <p>
                      <strong className="text-text-primary">
                        Open Days ({openDays.length}/7):
                      </strong>{' '}
                      {openDays.length > 0
                        ? openDays
                            .map((d) => `${d.day.slice(0, 3)} ${d.openTime}–${d.closeTime}`)
                            .join(', ')
                        : 'No open hours configured'}
                    </p>
                    <p>
                      <strong className="text-text-primary">Booking Window:</strong> Up to{' '}
                      {data.business.advanceDays} days ahead •{' '}
                      {data.business.allowSameDay
                        ? 'Same-day bookings allowed'
                        : 'No same-day bookings'}
                    </p>
                    <p>
                      <strong className="text-text-primary">Deposit Policy:</strong>{' '}
                      {data.business.depositRequired
                        ? `₦${depositNaira.toLocaleString('en-NG')} default Kora deposit required within a 15-minute slot hold`
                        : 'No deposit required'}
                    </p>
                    <p>
                      <strong className="text-text-primary">Cancellation Policy:</strong>{' '}
                      {data.business.cancellationPolicy}
                    </p>
                    {data.business.location && (
                      <p>
                        <strong className="text-text-primary">Location:</strong>{' '}
                        {data.business.location}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Editable FAQs */}
          <div className="rounded-xl border border-border/60 bg-white p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-headline-sm text-base font-bold text-text-primary">
                  Editable Frequently Asked Questions ({faqs.length})
                </h3>
                <p className="text-xs text-text-secondary">
                  Add approved answers for parking, directions, preparation tips, or shop rules.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  aria-label="Filter FAQs by category"
                  value={faqCategoryFilter}
                  onChange={(e) => setFaqCategoryFilter(e.target.value)}
                  className="h-8 rounded-lg border border-border bg-white px-2.5 text-xs text-text-primary"
                >
                  <option value="All">All Categories</option>
                  {FAQ_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={faqSearch}
                  onChange={(e) => setFaqSearch(e.target.value)}
                  placeholder="Search FAQs..."
                  className="h-8 rounded-lg border border-border bg-white px-3 text-xs text-text-primary"
                />
                {isOwner && (
                  <Button type="button" size="sm" onClick={openAddFaqModal} className="h-8 text-xs">
                    Add FAQ
                  </Button>
                )}
              </div>
            </div>

            {filteredFaqs.length === 0 ? (
              <div className="py-10 text-center space-y-2.5 border border-dashed border-border/60 rounded-xl">
                <AppIcon name="help_outline" className="text-[28px] text-text-secondary mx-auto" />
                <h4 className="font-headline-sm text-sm font-bold text-text-primary">
                  {faqSearch || faqCategoryFilter !== 'All'
                    ? 'No FAQs match your filter.'
                    : 'No custom FAQs added yet.'}
                </h4>
                <p className="text-xs text-text-secondary max-w-md mx-auto">
                  Add answers to common customer questions (parking, what to bring, late arrival
                  rules) so {assistantName} responds consistently.
                </p>
                {isOwner && !faqSearch && faqCategoryFilter === 'All' && (
                  <Button type="button" size="sm" onClick={openAddFaqModal} className="h-8 text-xs">
                    Add First FAQ
                  </Button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-border/50 border border-border/50 rounded-xl overflow-hidden">
                {filteredFaqs.map((faq) => (
                  <div key={faq.id} className="p-4 bg-white space-y-1.5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-[11px] font-semibold text-primary bg-primary/5 px-2 py-0.5 rounded">
                          {faq.category}
                        </span>
                        <h4 className="text-sm font-semibold text-text-primary mt-1.5">
                          {faq.question}
                        </h4>
                      </div>
                      {isOwner && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditFaqModal(faq)}
                            className="h-7 text-xs"
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setFaqs((prev) => prev.filter((item) => item.id !== faq.id));
                              setDirty(true);
                              setSaveState('idle');
                            }}
                            className="h-7 text-xs text-rose-600"
                          >
                            Delete
                          </Button>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-text-secondary leading-relaxed">{faq.answer}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 3: Booking Capabilities */}
      {activeTab === 'capabilities' && (
        <div className="space-y-5">
          <div className="rounded-xl border border-border/60 bg-white p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-headline-sm text-base font-bold text-text-primary">
                  3. Booking Capabilities &amp; Readiness
                </h3>
                <p className="text-xs text-text-secondary">
                  Readiness is computed directly from your live catalog, working hours, Kora payment
                  setup, and assistant activation state (<code>agent_enabled</code>).
                </p>
              </div>
              <span
                className={`text-xs font-semibold px-2.5 py-1 rounded-full border shrink-0 ${overallStatus.badge}`}
              >
                Assistant State: {data.receptionist.agentEnabled ? 'Enabled' : 'Paused'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                {
                  name: 'Slot Availability Search (find_slots)',
                  desc: 'Computes real bookable slots in Africa/Lagos from active staff working hours and existing bookings.',
                  state: !data.receptionist.agentEnabled
                    ? 'Paused'
                    : data.readiness.hasServices &&
                        data.readiness.hasStaffOrSolo &&
                        data.readiness.hasWorkingHours
                      ? 'Ready'
                      : 'Setup Required',
                  actionLabel: !data.readiness.hasServices
                    ? 'Add Services'
                    : !data.readiness.hasWorkingHours
                      ? 'Set Working Hours'
                      : null,
                  onAction: !data.readiness.hasServices
                    ? () => setActiveNav('services-staff')
                    : !data.readiness.hasWorkingHours
                      ? () => setActiveNav('working-hours')
                      : undefined,
                },
                {
                  name: 'Temporary Slot Holds (hold_slot — 15m Lock)',
                  desc: 'Places a 15-minute held booking protected by Postgres EXCLUDE USING gist so a staff member can never be double-booked.',
                  state: !data.receptionist.agentEnabled
                    ? 'Paused'
                    : data.readiness.hasServices &&
                        data.readiness.hasStaffOrSolo &&
                        data.readiness.hasWorkingHours
                      ? 'Ready'
                      : 'Setup Required',
                  actionLabel: !data.readiness.hasStaffOrSolo ? 'Assign Staff' : null,
                  onAction: !data.readiness.hasStaffOrSolo
                    ? () => setActiveNav('services-staff')
                    : undefined,
                },
                {
                  name: 'Kora Deposit Collection (request_deposit)',
                  desc: data.business.depositRequired
                    ? `Generates integer-kobo Kora deposit instructions (₦${depositNaira.toLocaleString('en-NG')} default) required before confirmation.`
                    : 'Deposits are currently marked optional in Payment Settings.',
                  state: !data.receptionist.agentEnabled
                    ? 'Paused'
                    : !data.business.depositRequired
                      ? 'Optional'
                      : data.readiness.koraReady
                        ? 'Ready'
                        : 'Setup Required',
                  actionLabel:
                    data.business.depositRequired && !data.readiness.koraReady
                      ? 'Configure Kora'
                      : 'Payment Rules',
                  onAction: () => setActiveNav('payments'),
                },
                {
                  name: 'Backend-Confirmed Bookings (get_booking_status)',
                  desc: 'Confirms a booking only after a Kora charge.success webhook and transaction re-verification. Ambiguous timeouts become pending_verification.',
                  state: !data.receptionist.agentEnabled
                    ? 'Paused'
                    : !data.business.depositRequired || data.readiness.koraReady
                      ? 'Ready'
                      : 'Setup Required',
                  actionLabel: null,
                },
                {
                  name: 'Business Q&A (list_services + Approved FAQs)',
                  desc: `Answers service, pricing, and policy questions using ${data.business.servicesCount} DB services and ${faqs.length} custom FAQs.`,
                  state: !data.receptionist.agentEnabled
                    ? 'Paused'
                    : data.readiness.hasBusinessProfile && data.readiness.hasServices
                      ? 'Ready'
                      : 'Setup Required',
                  actionLabel: 'Edit Knowledge',
                  onAction: () => setActiveTab('knowledge'),
                },
                {
                  name: 'Human Staff Escalation (handoff_to_staff)',
                  desc: 'Transitions conversations to needs_human and routes them to Conversations and Needs Attention.',
                  state: 'Ready',
                  actionLabel: 'Handoff Rules',
                  onAction: () => setActiveTab('handoff'),
                },
              ].map((cap) => (
                <div
                  key={cap.name}
                  className="rounded-xl border border-border/60 p-4 flex flex-col justify-between gap-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-semibold text-text-primary">{cap.name}</h4>
                      <p className="text-xs text-text-secondary mt-1 leading-relaxed">{cap.desc}</p>
                    </div>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${
                        cap.state === 'Ready'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : cap.state === 'Paused' || cap.state === 'Optional'
                            ? 'bg-slate-100 text-slate-700 border-slate-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}
                    >
                      {cap.state}
                    </span>
                  </div>
                  {cap.actionLabel && cap.onAction && (
                    <div>
                      <button
                        type="button"
                        onClick={cap.onAction}
                        className="text-xs font-semibold text-primary hover:underline"
                      >
                        {cap.actionLabel} →
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Non-Negotiable Booking Engine Guardrails */}
          <div className="rounded-xl border border-border/60 bg-white p-5 space-y-3">
            <h4 className="font-headline-sm text-sm font-bold text-text-primary">
              Enforced Booking &amp; Payment Invariants
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="rounded-lg bg-surface-container-lowest border border-border/40 p-3">
                <span className="font-semibold text-text-primary block">No Double-Booking</span>
                <span className="text-text-secondary mt-1 block">
                  Postgres <code>EXCLUDE USING gist</code> blocks overlapping held or confirmed
                  slots per staff member.
                </span>
              </div>
              <div className="rounded-lg bg-surface-container-lowest border border-border/40 p-3">
                <span className="font-semibold text-text-primary block">15-Minute Hold Window</span>
                <span className="text-text-secondary mt-1 block">
                  Unpaid holds expire automatically after 15 minutes to free up the calendar.
                </span>
              </div>
              <div className="rounded-lg bg-surface-container-lowest border border-border/40 p-3">
                <span className="font-semibold text-text-primary block">
                  Verified Kora Confirmation
                </span>
                <span className="text-text-secondary mt-1 block">
                  Confirmed only after a Kora <code>charge.success</code> webhook plus transaction
                  re-verification.
                </span>
              </div>
              <div className="rounded-lg bg-surface-container-lowest border border-border/40 p-3">
                <span className="font-semibold text-text-primary block">
                  Template-Locked Replies
                </span>
                <span className="text-text-secondary mt-1 block">
                  The assistant never free-texts &ldquo;confirmed&rdquo; unless the database booking
                  row is <code>confirmed</code>.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: Human Handoff */}
      {activeTab === 'handoff' && (
        <div className="rounded-xl border border-border/60 bg-white p-5 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-headline-sm text-base font-bold text-text-primary">
                4. Human Handoff &amp; Escalation
              </h3>
              <p className="text-xs text-text-secondary">
                When a customer needs human judgment, {assistantName} transitions the conversation
                to <code>needs_human</code>, pauses automated replies, and alerts your team.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-900 border border-amber-200 font-semibold">
                {data.activity.humanHandoffsRaised} Needs Human
              </span>
              <span className="px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-900 border border-indigo-200 font-semibold">
                {data.activity.pendingPaymentVerifications} Pending Verification
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {[
              'Customer explicitly asks to speak with a person or manager',
              'Customer disputes a payment, transfer, or asks for a refund',
              'Custom booking request or price negotiation outside catalog rules',
              'Medical, allergy, or sensitive question outside approved FAQs',
            ].map((cond) => (
              <div
                key={cond}
                className="rounded-lg border border-border/50 bg-surface-container-lowest px-3.5 py-2.5 flex items-center gap-2"
              >
                <AppIcon name="check_circle" className="text-[16px] text-primary shrink-0" />
                <span className="text-text-primary">{cond}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 pt-2">
            <div className="lg:col-span-2 space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="ai-escalation-contact"
                  className="text-xs font-semibold text-text-primary block"
                >
                  Escalation Contact (Phone / WhatsApp / Desk)
                </label>
                <input
                  id="ai-escalation-contact"
                  type="text"
                  disabled={!isOwner}
                  value={escalationContact}
                  onChange={(e) => {
                    setEscalationContact(e.target.value);
                    setDirty(true);
                    setSaveState('idle');
                  }}
                  maxLength={80}
                  placeholder="e.g. +234 803 123 4567"
                  className="w-full h-9 rounded-lg border border-border bg-white px-3 text-sm text-text-primary"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="ai-handoff-msg"
                    className="text-xs font-semibold text-text-primary block"
                  >
                    Customer Handoff Message
                  </label>
                  <span className="text-[11px] text-text-secondary">
                    {handoffMessage.trim().length}/400
                  </span>
                </div>
                <textarea
                  id="ai-handoff-msg"
                  rows={3}
                  disabled={!isOwner}
                  value={handoffMessage}
                  onChange={(e) => {
                    setHandoffMessage(e.target.value);
                    setDirty(true);
                    setSaveState('idle');
                  }}
                  maxLength={400}
                  className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary"
                />
              </div>
            </div>

            <div className="rounded-xl bg-surface-container-lowest border border-border/50 p-4 space-y-2 h-fit">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary block">
                Handoff Message Preview
              </span>
              <div className="rounded-lg bg-white border border-border/50 p-3 text-xs text-text-primary leading-relaxed">
                {handoffMessage.trim() ||
                  "I'll ask someone from the team to help with this. Your request has been passed along."}
                {escalationContact.trim()
                  ? ` Escalation contact: ${escalationContact.trim()}.`
                  : ''}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap pt-3 border-t border-border/40">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setActiveNav('conversations')}
              className="h-8 text-xs"
            >
              <AppIcon name="forum" className="text-[15px]" />
              <span>Open Conversations</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setActiveNav('needs-attention')}
              className="h-8 text-xs"
            >
              <AppIcon name="notification_important" className="text-[15px]" />
              <span>Open Needs Attention</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setActiveNav('team-permissions')}
              className="h-8 text-xs"
            >
              <AppIcon name="group" className="text-[15px]" />
              <span>Team &amp; Permissions</span>
            </Button>
          </div>
        </div>
      )}

      {/* SECTION 5: Channels */}
      {activeTab === 'channels' && (
        <div className="space-y-5">
          <div className="rounded-xl border border-border/60 bg-white p-5 space-y-4">
            <div>
              <h3 className="font-headline-sm text-base font-bold text-text-primary">
                5. Customer Channels — Web Chat &amp; WhatsApp Readiness
              </h3>
              <p className="text-xs text-text-secondary">
                Web Chat and WhatsApp share the same booking engine and Kora deposit guardrails,
                with independent channel readiness.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Web Chat Card */}
              <div className="rounded-xl border border-border/60 p-5 space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                        <AppIcon name="public" className="text-[20px]" />
                      </div>
                      <div>
                        <span className="font-semibold text-sm text-text-primary block">
                          Web Chat &amp; Public Booking Page
                        </span>
                        <span className="text-[11px] text-text-secondary">
                          Embedded on <code>/b/{data.business.slug}</code>
                        </span>
                      </div>
                    </div>
                    <span
                      className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                        data.readiness.webChatReady && data.receptionist.agentEnabled
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : data.readiness.webChatReady
                            ? 'bg-slate-100 text-slate-700 border-slate-300'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}
                    >
                      {webChatStatusLabel}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs border-t border-border/40 pt-3">
                    {[
                      {
                        label: 'Business profile & public slug',
                        ready: data.readiness.hasBusinessProfile,
                      },
                      {
                        label: `Service catalog (${data.business.servicesCount} configured)`,
                        ready: data.readiness.hasServices,
                      },
                      {
                        label: data.business.selfProvided
                          ? 'Solo provider enabled'
                          : `Active staff (${data.business.staffCount} configured)`,
                        ready: data.readiness.hasStaffOrSolo,
                      },
                      {
                        label: `Working hours (${openDays.length} open days)`,
                        ready: data.readiness.hasWorkingHours,
                      },
                      {
                        label: data.business.depositRequired
                          ? 'Kora deposit checkout ready'
                          : 'Deposits optional',
                        ready: !data.business.depositRequired || data.readiness.koraReady,
                      },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between">
                        <span className="text-text-secondary">{item.label}</span>
                        <span
                          className={`font-semibold ${
                            item.ready ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        >
                          {item.ready ? 'Ready' : 'Action needed'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap pt-3 border-t border-border/40">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void handleCopyPublicLink()}
                    className="h-8 text-xs"
                  >
                    <AppIcon name="content_copy" className="text-[14px]" />
                    <span>{copiedPublicUrl ? 'Copied Link!' : 'Copy Booking Link'}</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab('test_chat')}
                    className="h-8 text-xs"
                  >
                    Test Chat
                  </Button>
                  <Link
                    href={`/b/${data.business.slug}`}
                    target="_blank"
                    className="text-xs font-semibold text-primary hover:underline ml-auto"
                  >
                    Open Booking Page ↗
                  </Link>
                </div>
              </div>

              {/* WhatsApp Cloud API Card */}
              <div className="rounded-xl border border-border/60 p-5 space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                        <AppIcon name="chat" className="text-[20px]" />
                      </div>
                      <div>
                        <span className="font-semibold text-sm text-text-primary block">
                          WhatsApp Business (Meta Cloud API)
                        </span>
                        <span className="text-[11px] text-text-secondary">
                          {data.readiness.whatsappConnected
                            ? data.readiness.whatsappNumberLabel
                            : 'Not connected to a Meta phone number ID yet'}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                        data.readiness.whatsappConnected && data.receptionist.agentEnabled
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : data.readiness.whatsappConnected
                            ? 'bg-slate-100 text-slate-700 border-slate-300'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}
                    >
                      {whatsappStatusLabel}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs border-t border-border/40 pt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-text-secondary">Meta Phone Number ID</span>
                      <span
                        className={`font-semibold ${
                          data.readiness.whatsappConnected ? 'text-emerald-700' : 'text-amber-700'
                        }`}
                      >
                        {data.readiness.whatsappPhoneNumberId || 'Not linked'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-text-secondary">Webhook redelivery deduplication</span>
                      <span className="font-semibold text-emerald-700">Enforced</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-text-secondary">24h customer-service window</span>
                      <span className="font-semibold text-emerald-700">Tracked per thread</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap pt-3 border-t border-border/40">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveNav('integrations')}
                    className="h-8 text-xs"
                  >
                    <AppIcon name="extension" className="text-[15px]" />
                    <span>
                      {data.readiness.whatsappConnected
                        ? 'Manage in Integrations'
                        : 'Connect in Integrations'}
                    </span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveNav('conversations')}
                    className="h-8 text-xs"
                  >
                    View WhatsApp Threads
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 6: Isolated Test Chat */}
      {activeTab === 'test_chat' && (
        <div className="rounded-xl border border-border/60 bg-white overflow-hidden">
          <div className="p-4 border-b border-border/50 bg-surface-container-lowest flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-headline-sm text-base font-bold text-text-primary">
                  6. Test Chat — {assistantName.trim() || 'Assistant'}
                </h3>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200">
                  Isolated Test Mode
                </span>
                {dirty && (
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                    Testing Unsaved Draft Settings
                  </span>
                )}
              </div>
              <p className="text-xs text-text-secondary mt-0.5">
                Reads your real services, staff schedules, policies, and current draft settings
                without creating live bookings, holds, or Kora charges.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setTestMessages([])}
              className="h-8 text-xs shrink-0"
            >
              Reset Test
            </Button>
          </div>

          <div className="p-4 border-b border-border/40 flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-text-secondary">Quick scenarios:</span>
            {[
              'Hello!',
              'What services and prices do you offer?',
              'Can I book an appointment tomorrow at 2 PM?',
              'What are your opening hours and location?',
              'What is your deposit and cancellation policy?',
              'I want to speak to a human about a refund',
            ].map((prompt) => (
              <button
                key={prompt}
                type="button"
                disabled={testSending}
                onClick={() => void handleSendTestMessage(prompt)}
                className="text-xs px-2.5 py-1 rounded-lg border border-border bg-white hover:bg-surface-container-low text-text-primary"
              >
                {prompt}
              </button>
            ))}
          </div>

          <div className="p-4 space-y-3 min-h-[280px] max-h-[400px] overflow-y-auto bg-surface-container-lowest/40">
            {testMessages.length === 0 ? (
              <div className="text-center py-10 text-xs text-text-secondary space-y-1">
                <p className="font-semibold text-text-primary">
                  Send a message or click a scenario above to test {assistantName.trim() || 'Maya'}.
                </p>
                <p>
                  Language: <strong>{primaryLanguage}</strong> • Tone: <strong>{tone}</strong>
                </p>
              </div>
            ) : (
              testMessages.map((m) => (
                <div
                  key={m.id}
                  className={`flex flex-col ${
                    m.sender === 'customer' ? 'items-end' : 'items-start'
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed ${
                      m.sender === 'customer'
                        ? 'bg-primary text-white'
                        : m.sender === 'system'
                          ? 'bg-rose-50 text-rose-800 border border-rose-200'
                          : 'bg-white text-text-primary border border-border/60'
                    }`}
                  >
                    {m.text}
                  </div>
                  {(m.outcome || m.matchedSource) && (
                    <div className="flex items-center gap-2 mt-1 px-1 flex-wrap">
                      {m.outcome && (
                        <span className="text-[10px] font-semibold text-text-secondary">
                          Outcome: {m.outcome}
                        </span>
                      )}
                      {m.matchedSource && (
                        <span className="text-[10px] font-medium text-primary bg-primary/5 px-1.5 py-0.5 rounded">
                          Source: {m.matchedSource}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSendTestMessage();
            }}
            className="p-3 border-t border-border/50 bg-white flex items-center gap-2"
          >
            <input
              type="text"
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              placeholder={`Message ${assistantName.trim() || 'Maya'} in isolated test mode...`}
              className="flex-1 h-9 rounded-lg border border-border bg-white px-3 text-xs text-text-primary"
            />
            <Button type="submit" size="sm" disabled={testSending || !testInput.trim()}>
              {testSending ? 'Sending...' : 'Send'}
            </Button>
          </form>
        </div>
      )}

      {/* FAQ Add/Edit Modal */}
      {faqModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={editingFaqId ? 'Edit FAQ' : 'Add FAQ'}
        >
          <form
            onSubmit={handleSaveFaqModal}
            className="w-full max-w-md rounded-xl bg-white border border-border/70 p-5 space-y-4 shadow-xl"
          >
            <h3 className="font-headline-sm text-base font-bold text-text-primary">
              {editingFaqId ? 'Edit FAQ' : 'Add FAQ'}
            </h3>
            {faqValidationError && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                {faqValidationError}
              </div>
            )}
            <div className="space-y-1.5">
              <label htmlFor="faq-cat" className="text-xs font-semibold text-text-primary block">
                Category
              </label>
              <select
                id="faq-cat"
                value={faqCategory}
                onChange={(e) => setFaqCategory(e.target.value)}
                className="w-full h-9 rounded-lg border border-border bg-white px-3 text-xs text-text-primary"
              >
                {FAQ_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="faq-q" className="text-xs font-semibold text-text-primary block">
                Question
              </label>
              <input
                id="faq-q"
                type="text"
                required
                maxLength={240}
                value={faqQuestion}
                onChange={(e) => setFaqQuestion(e.target.value)}
                placeholder="e.g. Do you accept walk-ins?"
                className="w-full h-9 rounded-lg border border-border bg-white px-3 text-xs text-text-primary"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="faq-a" className="text-xs font-semibold text-text-primary block">
                Approved Answer
              </label>
              <textarea
                id="faq-a"
                rows={3}
                required
                maxLength={1000}
                value={faqAnswer}
                onChange={(e) => setFaqAnswer(e.target.value)}
                placeholder="e.g. Yes, depending on staff availability. Booking ahead is recommended."
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-xs text-text-primary"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setFaqModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm">
                {editingFaqId ? 'Update FAQ' : 'Add FAQ'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
