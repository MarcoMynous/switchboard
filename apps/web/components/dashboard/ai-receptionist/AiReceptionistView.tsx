'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReceptionistFaqItem } from '@/app/api/ai-receptionist/route';
import { AppIcon } from '@/components/AppIcon';
import { Button } from '@/components/ui/button';
import { useDashboard } from '../DashboardContext';

type SectionTab = 'overview' | 'identity' | 'knowledge' | 'capabilities' | 'handoff' | 'test_chat';

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
    depositRequired: boolean;
    defaultDepositKobo: number;
    freeCancelHours: number;
    cancellationPolicy: string;
    servicesCount: number;
    staffCount: number;
    selfProvided: boolean;
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
    koraReady: boolean;
    webChatReady: boolean;
    whatsappConnected: boolean;
    whatsappNumberLabel: string | null;
  };
  activity: {
    conversationsToday: number;
    bookingRequestsInitiated: number;
    confirmedFromAi: number;
    humanHandoffsRaised: number;
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

const TABS: Array<{ id: SectionTab; label: string; icon: string }> = [
  { id: 'overview', label: 'Overview', icon: 'dashboard' },
  { id: 'identity', label: 'Identity & Greeting', icon: 'badge' },
  { id: 'knowledge', label: 'Business Knowledge', icon: 'menu_book' },
  { id: 'capabilities', label: 'Booking Capabilities', icon: 'event_available' },
  { id: 'handoff', label: 'Human Handoff', icon: 'support_agent' },
  { id: 'test_chat', label: 'Test Chat', icon: 'chat' },
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

export function AiReceptionistView() {
  const { workspace, setActiveNav, refreshWorkspaceData } = useDashboard();

  const [activeTab, setActiveTab] = useState<SectionTab>('overview');
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
  const [capabilities, setCapabilities] = useState<
    AiReceptionistApiResponse['receptionist']['capabilities']
  >([]);

  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);
  const [toggleFeedback, setToggleFeedback] = useState<string | null>(null);

  // FAQ form & search
  const [faqSearch, setFaqSearch] = useState('');
  const [editingFaqId, setEditingFaqId] = useState<string | null>(null);
  const [faqModalOpen, setFaqModalOpen] = useState(false);
  const [faqQuestion, setFaqQuestion] = useState('');
  const [faqAnswer, setFaqAnswer] = useState('');
  const [faqCategory, setFaqCategory] = useState(
    FAQ_CATEGORIES[0] ?? 'General Business Information',
  );

  // Test chat state (strictly isolated)
  const [testMessages, setTestMessages] = useState<
    Array<{ id: string; sender: 'customer' | 'agent' | 'system'; text: string; outcome?: string }>
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
      setCapabilities(json.receptionist.capabilities);
      setDirty(false);
      setSaveState('idle');
    } catch {
      setLoadError("We couldn't load your receptionist settings.");
    } finally {
      setLoading(false);
    }
  }, [workspace.slug]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const handleSave = async () => {
    if (!data || data.role !== 'owner') return;
    setSaveState('saving');
    setSaveError(null);
    try {
      const res = await fetch('/api/ai-receptionist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_config',
          slug: data.business.slug,
          assistantName,
          primaryLanguage,
          tone,
          greeting,
          shortIntro,
          handoffMessage,
          escalationContact,
          faqs,
          capabilities,
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
    if (!data || data.role !== 'owner') return;
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
            ? 'AI receptionist enabled for WhatsApp and web chat.'
            : 'AI receptionist enabled for web chat. WhatsApp is not connected yet.',
        );
      } else {
        setToggleFeedback(
          'AI receptionist paused. Existing bookings, holds, and payment verification remain active.',
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
        }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        reply?: string;
        outcome?: string;
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

  const filteredFaqs = useMemo(() => {
    const q = faqSearch.trim().toLowerCase();
    if (!q) return faqs;
    return faqs.filter(
      (f) =>
        f.question.toLowerCase().includes(q) ||
        f.answer.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q),
    );
  }, [faqSearch, faqs]);

  const openAddFaqModal = () => {
    setEditingFaqId(null);
    setFaqQuestion('');
    setFaqAnswer('');
    setFaqCategory(FAQ_CATEGORIES[0] ?? 'General Business Information');
    setFaqModalOpen(true);
  };

  const openEditFaqModal = (item: ReceptionistFaqItem) => {
    setEditingFaqId(item.id);
    setFaqQuestion(item.question);
    setFaqAnswer(item.answer);
    setFaqCategory(item.category);
    setFaqModalOpen(true);
  };

  const handleSaveFaqModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (faqQuestion.trim().length < 3 || faqAnswer.trim().length < 3) return;
    if (editingFaqId) {
      setFaqs((prev) =>
        prev.map((f) =>
          f.id === editingFaqId
            ? {
                ...f,
                question: faqQuestion.trim(),
                answer: faqAnswer.trim(),
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
          question: faqQuestion.trim(),
          answer: faqAnswer.trim(),
          category: faqCategory,
          updatedAt: new Date().toISOString(),
        },
        ...prev,
      ]);
    }
    setDirty(true);
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
  const overallStatus = !data.readiness.webChatReady
    ? { label: 'Setup Required', badge: 'bg-amber-100 text-amber-900 border-amber-300' }
    : data.receptionist.agentEnabled
      ? { label: 'Active', badge: 'bg-emerald-100 text-emerald-800 border-emerald-200' }
      : { label: 'Paused', badge: 'bg-slate-100 text-slate-700 border-slate-300' };

  return (
    <div className="flex flex-col w-full space-y-6 max-w-6xl">
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
            Customize how your assistant welcomes customers, answers questions, and helps manage
            bookings.
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
            <span>Test Receptionist</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setActiveNav('conversations')}
            className="h-9 text-xs"
          >
            <AppIcon name="forum" className="text-[16px]" />
            <span>View Conversations</span>
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
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">
          {saveError}
        </div>
      )}

      {toggleFeedback && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-xs text-indigo-900">
          {toggleFeedback}
        </div>
      )}

      {/* Assistant Summary Card */}
      <div className="rounded-xl border border-border/60 bg-white p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary text-white flex items-center justify-center shrink-0">
            <AppIcon name="smart_toy" className="text-[24px]" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-headline-sm text-lg font-bold text-text-primary">
                {data.receptionist.assistantName}
              </h2>
              <span className="text-xs text-text-secondary">• AI Booking Receptionist</span>
            </div>
            <p className="text-xs text-text-secondary">
              Business: <strong className="text-text-primary">{data.business.name}</strong> • Last
              updated {formatDateTime(data.receptionist.updatedAt, timezone)}
            </p>
            <div className="flex items-center gap-2 flex-wrap pt-1 text-xs">
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${
                  data.readiness.webChatReady
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}
              >
                Web Chat: {data.readiness.webChatReady ? 'Available' : 'Setup Required'}
              </span>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${
                  data.readiness.whatsappConnected
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}
              >
                WhatsApp: {data.readiness.whatsappConnected ? 'Active' : 'Setup Required'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setActiveTab('identity')}
            className="h-8 text-xs"
          >
            Edit Assistant
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

      {/* Section Navigation */}
      <div className="md:hidden">
        <select
          aria-label="Select AI Receptionist section"
          value={activeTab}
          onChange={(e) => setActiveTab(e.target.value as SectionTab)}
          className="w-full h-10 rounded-lg border border-border bg-white px-3 text-sm font-medium text-text-primary"
        >
          {TABS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className="hidden md:flex items-center gap-1.5 border-b border-border/60 pb-2 overflow-x-auto">
        {TABS.map((t) => {
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                active
                  ? 'bg-primary text-white'
                  : 'text-text-secondary hover:bg-surface-container-low hover:text-text-primary'
              }`}
            >
              <AppIcon name={t.icon} className="text-[16px]" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Activity Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-border/60 bg-white p-4">
              <span className="text-xs text-text-secondary">Conversations today</span>
              <p className="font-headline-md text-2xl font-bold text-text-primary mt-1">
                {data.activity.conversationsToday}
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-white p-4">
              <span className="text-xs text-text-secondary">Booking requests initiated</span>
              <p className="font-headline-md text-2xl font-bold text-text-primary mt-1">
                {data.activity.bookingRequestsInitiated}
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-white p-4">
              <span className="text-xs text-text-secondary">Confirmed from AI chats</span>
              <p className="font-headline-md text-2xl font-bold text-text-primary mt-1">
                {data.activity.confirmedFromAi}
              </p>
            </div>
            <div className="rounded-xl border border-border/60 bg-white p-4">
              <span className="text-xs text-text-secondary">Human handoffs raised</span>
              <p className="font-headline-md text-2xl font-bold text-text-primary mt-1">
                {data.activity.humanHandoffsRaised}
              </p>
            </div>
          </div>

          {/* Customer Channels */}
          <div className="rounded-xl border border-border/60 bg-white p-5 space-y-4">
            <div>
              <h3 className="font-headline-sm text-base font-bold text-text-primary">
                Where can customers reach {data.receptionist.assistantName}?
              </h3>
              <p className="text-xs text-text-secondary">
                Manage where your receptionist is available.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-border/60 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AppIcon name="public" className="text-[20px] text-primary" />
                    <span className="font-semibold text-sm text-text-primary">Web Chat</span>
                  </div>
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                      data.readiness.webChatReady
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}
                  >
                    {data.readiness.webChatReady ? 'Active' : 'Setup Required'}
                  </span>
                </div>
                <p className="text-xs text-text-secondary">
                  Public booking page: <code>/b/{data.business.slug}</code>
                </p>
                <div className="flex items-center gap-2">
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
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Open Booking Page
                  </Link>
                </div>
              </div>

              <div className="rounded-xl border border-border/60 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AppIcon name="chat" className="text-[20px] text-emerald-600" />
                    <span className="font-semibold text-sm text-text-primary">WhatsApp</span>
                  </div>
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                      data.readiness.whatsappConnected
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}
                  >
                    {data.readiness.whatsappConnected ? 'Active' : 'Setup Required'}
                  </span>
                </div>
                <p className="text-xs text-text-secondary">
                  {data.readiness.whatsappConnected
                    ? data.readiness.whatsappNumberLabel
                    : 'Connect your business WhatsApp account to start receiving customer messages.'}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveNav('integrations')}
                  className="h-8 text-xs"
                >
                  {data.readiness.whatsappConnected ? 'Manage Integration' : 'Go to Integrations'}
                </Button>
              </div>
            </div>
          </div>

          {/* Booking Rules Summary (read-only authoritative summary) */}
          <div className="rounded-xl border border-border/60 bg-white p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-headline-sm text-base font-bold text-text-primary">
                  Booking Rules
                </h3>
                <p className="text-xs text-text-secondary">
                  These rules keep appointments and payments consistent and are enforced by the
                  backend.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveNav('payments')}
                  className="h-7 text-xs"
                >
                  Payments
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveNav('services-staff')}
                  className="h-7 text-xs"
                >
                  Services &amp; Staff
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveNav('working-hours')}
                  className="h-7 text-xs"
                >
                  Working Hours
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="rounded-lg bg-surface-container-lowest border border-border/40 p-3">
                <span className="font-semibold text-text-primary block">Temporary Hold</span>
                <span className="text-text-secondary mt-1 block">15 minutes</span>
              </div>
              <div className="rounded-lg bg-surface-container-lowest border border-border/40 p-3">
                <span className="font-semibold text-text-primary block">Deposit Policy</span>
                <span className="text-text-secondary mt-1 block">
                  {data.business.depositRequired
                    ? `₦${depositNaira.toLocaleString('en-NG')} required before confirmation`
                    : 'No deposit required'}
                </span>
              </div>
              <div className="rounded-lg bg-surface-container-lowest border border-border/40 p-3">
                <span className="font-semibold text-text-primary block">Confirmation</span>
                <span className="text-text-secondary mt-1 block">
                  Only after verified Kora payment for deposit-required bookings
                </span>
              </div>
              <div className="rounded-lg bg-surface-container-lowest border border-border/40 p-3">
                <span className="font-semibold text-text-primary block">Availability</span>
                <span className="text-text-secondary mt-1 block">
                  Calculated from staff schedules and existing bookings
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Identity & Greeting */}
      {activeTab === 'identity' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-xl border border-border/60 bg-white p-5 space-y-4">
            <div>
              <h3 className="font-headline-sm text-base font-bold text-text-primary">
                How should your receptionist introduce itself?
              </h3>
              <p className="text-xs text-text-secondary">
                Give your assistant a name and choose how it communicates with customers.
              </p>
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
                  }}
                  maxLength={40}
                  className="w-full h-9 rounded-lg border border-border bg-white px-3 text-sm text-text-primary"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="ai-lang" className="text-xs font-semibold text-text-primary block">
                  Primary Language
                </label>
                <select
                  id="ai-lang"
                  disabled={!isOwner}
                  value={primaryLanguage}
                  onChange={(e) => {
                    setPrimaryLanguage(e.target.value as 'English' | 'Nigerian Pidgin');
                    setDirty(true);
                  }}
                  className="w-full h-9 rounded-lg border border-border bg-white px-3 text-sm text-text-primary"
                >
                  <option value="English">English</option>
                  <option value="Nigerian Pidgin">Nigerian Pidgin</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-text-primary block">
                Communication Tone
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                {(['Friendly', 'Professional', 'Casual'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    disabled={!isOwner}
                    onClick={() => {
                      setTone(option);
                      setDirty(true);
                    }}
                    className={`px-3.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                      tone === option
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white text-text-primary border-border hover:bg-surface-container-low'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="ai-greeting"
                className="text-xs font-semibold text-text-primary block"
              >
                Welcome Message
              </label>
              <textarea
                id="ai-greeting"
                rows={3}
                disabled={!isOwner}
                value={greeting}
                onChange={(e) => {
                  setGreeting(e.target.value);
                  setDirty(true);
                }}
                maxLength={600}
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="ai-intro" className="text-xs font-semibold text-text-primary block">
                Short Introduction (Optional)
              </label>
              <input
                id="ai-intro"
                type="text"
                disabled={!isOwner}
                value={shortIntro}
                onChange={(e) => {
                  setShortIntro(e.target.value);
                  setDirty(true);
                }}
                maxLength={200}
                className="w-full h-9 rounded-lg border border-border bg-white px-3 text-sm text-text-primary"
              />
            </div>
          </div>

          {/* Preview */}
          <div className="rounded-xl border border-border/60 bg-white p-5 space-y-3 h-fit">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
              Web Chat Welcome Preview
            </h4>
            <div className="rounded-xl bg-surface-container-lowest border border-border/50 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-[11px] font-bold">
                  {assistantName.slice(0, 1).toUpperCase() || 'A'}
                </div>
                <span className="text-xs font-semibold text-text-primary">
                  {assistantName || 'Assistant'} • {tone}
                </span>
              </div>
              <div className="rounded-lg bg-white border border-border/50 p-3 text-xs text-text-primary leading-relaxed">
                {greeting || 'Enter a welcome message to preview how customers are greeted.'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Business Knowledge */}
      {activeTab === 'knowledge' && (
        <div className="space-y-5">
          <div className="rounded-xl border border-border/60 bg-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-headline-sm text-base font-bold text-text-primary">
                Authoritative Business Records
              </h3>
              <p className="text-xs text-text-secondary mt-0.5">
                {assistantName} reads directly from your saved business profile:{' '}
                <strong className="text-text-primary">
                  {data.business.servicesCount} services
                </strong>
                ,{' '}
                <strong className="text-text-primary">
                  {data.business.selfProvided
                    ? 'solo operator'
                    : `${data.business.staffCount} staff`}
                </strong>
                , working hours, and deposit rules.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setActiveNav('services-staff')}
              className="h-8 text-xs shrink-0"
            >
              Manage Services &amp; Staff
            </Button>
          </div>

          <div className="rounded-xl border border-border/60 bg-white p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-headline-sm text-base font-bold text-text-primary">
                  Frequently Asked Questions
                </h3>
                <p className="text-xs text-text-secondary">
                  Add helpful answers to questions your customers ask frequently.
                </p>
              </div>
              <div className="flex items-center gap-2">
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
                  {faqSearch ? 'No FAQs match your search.' : 'No FAQs added yet.'}
                </h4>
                <p className="text-xs text-text-secondary max-w-md mx-auto">
                  Add answers to common customer questions to help your receptionist respond
                  accurately.
                </p>
                {isOwner && !faqSearch && (
                  <Button type="button" size="sm" onClick={openAddFaqModal} className="h-8 text-xs">
                    Add FAQ
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

      {/* Tab 4: Booking Capabilities */}
      {activeTab === 'capabilities' && (
        <div className="rounded-xl border border-border/60 bg-white p-5 space-y-4">
          <div>
            <h3 className="font-headline-sm text-base font-bold text-text-primary">
              What can your receptionist help customers do?
            </h3>
            <p className="text-xs text-text-secondary">
              Backend booking and Kora verification rules always govern what is confirmed.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                name: 'Answer Business Questions',
                desc: 'Uses approved services, working hours, policies, and FAQs.',
                state: data.receptionist.agentEnabled ? 'Ready' : 'Disabled',
              },
              {
                name: 'Find Available Appointments',
                desc: 'Requests live available slots from the booking engine.',
                state:
                  data.readiness.hasServices && data.readiness.hasStaffOrSolo
                    ? 'Ready'
                    : 'Setup Required',
              },
              {
                name: 'Hold Appointment Slots',
                desc: 'Places conflict-free 15-minute holds enforced by Postgres.',
                state:
                  data.readiness.hasServices && data.readiness.hasStaffOrSolo
                    ? 'Ready'
                    : 'Setup Required',
              },
              {
                name: 'Request Deposits',
                desc: 'Shares Kora deposit instructions when deposits are required.',
                state: data.readiness.koraReady ? 'Ready' : 'Setup Required',
              },
              {
                name: 'Confirm Bookings',
                desc: 'Communicates confirmation only after verified Kora payment.',
                state: data.readiness.koraReady ? 'Ready' : 'Setup Required',
              },
              {
                name: 'Escalate to Human Staff',
                desc: 'Hands over requests to Conversations and Needs Attention.',
                state: 'Ready',
              },
            ].map((cap) => (
              <div
                key={cap.name}
                className="rounded-xl border border-border/60 p-4 flex items-start justify-between gap-3"
              >
                <div>
                  <h4 className="text-sm font-semibold text-text-primary">{cap.name}</h4>
                  <p className="text-xs text-text-secondary mt-1">{cap.desc}</p>
                </div>
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${
                    cap.state === 'Ready'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : cap.state === 'Disabled'
                        ? 'bg-slate-100 text-slate-700 border-slate-200'
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                  }`}
                >
                  {cap.state}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 5: Human Handoff */}
      {activeTab === 'handoff' && (
        <div className="rounded-xl border border-border/60 bg-white p-5 space-y-5">
          <div>
            <h3 className="font-headline-sm text-base font-bold text-text-primary">
              When should {assistantName} ask for help?
            </h3>
            <p className="text-xs text-text-secondary">
              Customer requests that need human judgment are passed to Conversations and Needs
              Attention.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {[
              'Customer explicitly requests a person',
              'Customer disputes a payment or asks for a refund',
              'Booking change requires staff approval',
              'Answer is not covered by approved business information',
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label
                htmlFor="ai-escalation-contact"
                className="text-xs font-semibold text-text-primary block"
              >
                Escalation Contact
              </label>
              <input
                id="ai-escalation-contact"
                type="text"
                disabled={!isOwner}
                value={escalationContact}
                onChange={(e) => {
                  setEscalationContact(e.target.value);
                  setDirty(true);
                }}
                className="w-full h-9 rounded-lg border border-border bg-white px-3 text-sm text-text-primary"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="ai-handoff-msg"
              className="text-xs font-semibold text-text-primary block"
            >
              Handoff Message
            </label>
            <textarea
              id="ai-handoff-msg"
              rows={2}
              disabled={!isOwner}
              value={handoffMessage}
              onChange={(e) => {
                setHandoffMessage(e.target.value);
                setDirty(true);
              }}
              maxLength={400}
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-border/40">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setActiveNav('conversations')}
              className="h-8 text-xs"
            >
              Open Conversations
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setActiveNav('needs-attention')}
              className="h-8 text-xs"
            >
              Open Needs Attention
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setActiveNav('team-permissions')}
              className="h-8 text-xs"
            >
              Team &amp; Permissions
            </Button>
          </div>
        </div>
      )}

      {/* Tab 6: Isolated Test Chat */}
      {activeTab === 'test_chat' && (
        <div className="rounded-xl border border-border/60 bg-white overflow-hidden">
          <div className="p-4 border-b border-border/50 bg-surface-container-lowest flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-headline-sm text-base font-bold text-text-primary">
                  Test your receptionist
                </h3>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200">
                  Isolated Test Mode
                </span>
              </div>
              <p className="text-xs text-text-secondary mt-0.5">
                Test sessions never create real customer bookings, payments, or conversation
                metrics.
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
              'What services and prices do you offer?',
              'Can I book an appointment tomorrow at 2 PM?',
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

          <div className="p-4 space-y-3 min-h-[260px] max-h-[380px] overflow-y-auto bg-surface-container-lowest/40">
            {testMessages.length === 0 ? (
              <div className="text-center py-10 text-xs text-text-secondary">
                Send a message or choose a scenario above to test {assistantName}.
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
                  {m.outcome && (
                    <span className="text-[10px] font-semibold text-text-secondary mt-1 px-1">
                      Outcome: {m.outcome}
                    </span>
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
              placeholder={`Message ${assistantName} in test mode...`}
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
