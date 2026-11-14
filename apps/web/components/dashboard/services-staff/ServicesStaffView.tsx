'use client';

import Link from 'next/link';
import { useDashboard } from '../DashboardContext';

export function ServicesStaffView() {
  const { workspace } = useDashboard();

  return (
    <div className="bg-surface rounded-xl p-6 sm:p-8 border border-border space-y-6">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Services &amp; Staff</h1>
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
                <div className="font-semibold text-sm text-text-primary">{s.name}</div>
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
                <div className="font-semibold text-sm text-text-primary">{st.name}</div>
                <div className="text-xs text-text-secondary">{st.role}</div>
              </div>
              <span className="text-xs font-mono text-success-strong">Active</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
