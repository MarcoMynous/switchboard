'use client';

import Link from 'next/link';
import { formatNairaFromKobo, useDashboard } from './DashboardContext';

export function PlaceholderSectionView({ title }: { title: string }) {
  const { workspace, apiState, bookings, conversations, metrics } = useDashboard();
  const scheduleEntries = Object.entries(workspace.schedule ?? {});

  return (
    <div className="bg-surface rounded-xl p-6 sm:p-8 border border-border space-y-6">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{title}</h1>
          <p className="text-sm text-text-secondary mt-1">
            Workspace configuration for {workspace.businessName} ({workspace.timezone})
          </p>
        </div>
        {!apiState.isDemo && (
          <Link
            href="/onboarding"
            className="px-4 py-2 rounded-lg bg-primary-container text-white text-xs font-semibold hover:bg-primary"
          >
            Edit in Setup Wizard
          </Link>
        )}
      </div>

      {title === 'Working Hours' && scheduleEntries.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-text-primary">
            Weekly Operating Schedule ({workspace.staff.length} Staff Members)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
            {scheduleEntries.map(([day, hours]) => (
              <div
                key={day}
                className="p-3.5 rounded-lg bg-surface-container-low border border-border/50"
              >
                <div className="font-semibold text-text-primary">{day}</div>
                <div className="text-xs text-text-secondary mt-1">
                  {hours.open ? `${hours.openTime} – ${hours.closeTime}` : 'Closed'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {title === 'Analytics' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div className="p-4 rounded-lg bg-surface-container-low space-y-1">
            <span className="text-xs text-text-secondary uppercase font-mono">Confirmed</span>
            <div className="text-xl font-bold text-text-primary">{metrics.confirmedCount}</div>
          </div>
          <div className="p-4 rounded-lg bg-surface-container-low space-y-1">
            <span className="text-xs text-text-secondary uppercase font-mono">Active Holds</span>
            <div className="text-xl font-bold text-text-primary">{metrics.heldCount}</div>
          </div>
          <div className="p-4 rounded-lg bg-surface-container-low space-y-1">
            <span className="text-xs text-text-secondary uppercase font-mono">
              Verified Deposits
            </span>
            <div className="text-xl font-bold text-text-primary">
              {formatNairaFromKobo(metrics.verifiedDepositKobo)}
            </div>
          </div>
          <div className="p-4 rounded-lg bg-surface-container-low space-y-1">
            <span className="text-xs text-text-secondary uppercase font-mono">
              Total Bookings / Chats
            </span>
            <div className="text-xl font-bold text-text-primary">
              {bookings.length} / {conversations.length}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div className="p-4 rounded-lg bg-surface-container-low space-y-1">
          <span className="text-xs text-text-secondary uppercase font-mono">
            Business &amp; Slug
          </span>
          <div className="font-semibold text-text-primary">
            {workspace.businessName} (/b/{workspace.slug})
          </div>
        </div>
        <div className="p-4 rounded-lg bg-surface-container-low space-y-1">
          <span className="text-xs text-text-secondary uppercase font-mono">
            Kora Deposit &amp; Hold Policy
          </span>
          <div className="font-semibold text-text-primary">
            {apiState.isDemo ? 'Mock Kora (Simulated) • ' : ''}₦
            {workspace.depositAmount.toLocaleString()} deposit • 15-minute slot hold
          </div>
        </div>
        <div className="p-4 rounded-lg bg-surface-container-low space-y-1">
          <span className="text-xs text-text-secondary uppercase font-mono">AI Receptionist</span>
          <div className="font-semibold text-text-primary">
            {workspace.assistantName} ({workspace.tone} tone)
          </div>
        </div>
        <div className="p-4 rounded-lg bg-surface-container-low space-y-1">
          <span className="text-xs text-text-secondary uppercase font-mono">Channels</span>
          <div className="font-semibold text-text-primary">
            Web Chat Live •{' '}
            {apiState.isDemo
              ? 'WhatsApp Simulated (Outbound Disabled)'
              : apiState.whatsappConnected
                ? 'WhatsApp Connected'
                : 'WhatsApp Ready to Pair'}
          </div>
        </div>
      </div>
    </div>
  );
}
