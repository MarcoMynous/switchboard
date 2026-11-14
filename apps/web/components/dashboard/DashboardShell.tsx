'use client';

import Link from 'next/link';
import { AppIcon } from '@/components/AppIcon';
import { HoldBand } from '@/components/HoldBand';
import { SwitchboardLogo } from '@/components/SwitchboardLogo';
import { Button } from '@/components/ui/button';
import {
  formatNairaFromKobo,
  NAV_SECTION_ROUTES,
  type NavSection,
  useDashboard,
} from './DashboardContext';

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const {
    activeNav,
    setActiveNav,
    sidebarOpenMobile,
    setSidebarOpenMobile,
    workspace,
    apiState,
    setApiState,
    bookings,
    conversations,
    metrics,
    copiedSlug,
    copyBookingLink,
    workspaceMenuOpen,
    setWorkspaceMenuOpen,
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
  } = useDashboard();

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

          {/* Workspace Selector Dropdown */}
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
                      <Link
                        key={item.id}
                        href={NAV_SECTION_ROUTES[item.id]}
                        onClick={() => setSidebarOpenMobile(false)}
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
                      </Link>
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

            {children}
          </div>
        </main>
      </div>

      {/* =====================================================================
          MOBILE BOTTOM TAB BAR (< lg)
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
            <Link
              key={tab.id}
              href={NAV_SECTION_ROUTES[tab.id]}
              className={`flex flex-col items-center justify-center gap-0.5 ${
                active ? 'text-primary font-semibold' : 'text-text-secondary'
              }`}
            >
              <AppIcon name={tab.icon} className="text-[20px]" />
              <span className="text-[11px]">{tab.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* =====================================================================
          INTERACTIVE WEB CHAT DRAWER
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
                    Web Chat Active • Reads live services &amp; staff
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
