'use client';

import Link from 'next/link';
import { useDashboard } from './DashboardContext';

export function PlaceholderSectionView({ title }: { title: string }) {
  const { workspace, apiState } = useDashboard();

  return (
    <div className="bg-surface rounded-xl p-6 sm:p-8 border border-border space-y-6">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{title}</h1>
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
            ₦{workspace.depositAmount.toLocaleString()} deposit • 15-minute slot hold
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
            {apiState.whatsappConnected ? 'WhatsApp Connected' : 'WhatsApp Ready to Pair'}
          </div>
        </div>
      </div>
    </div>
  );
}
