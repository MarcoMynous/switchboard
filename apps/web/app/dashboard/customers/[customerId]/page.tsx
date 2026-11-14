'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { AppIcon } from '@/components/AppIcon';
import { CustomerProfileView } from '@/components/dashboard/customers/CustomerProfileView';
import { useDashboard } from '@/components/dashboard/DashboardContext';
import { Button } from '@/components/ui/button';
import type { CustomerDirectoryRecord } from '@/lib/customers-server';

export default function CustomerDetailPage() {
  const params = useParams<{ customerId: string }>();
  const router = useRouter();
  const customerId = params?.customerId ?? '';
  const { workspace, apiState, setActiveNav, setNewBookingModalOpen } = useDashboard();

  const [customer, setCustomer] = useState<CustomerDirectoryRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (!customerId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/customers/${encodeURIComponent(customerId)}?slug=${encodeURIComponent(workspace.slug)}`,
      );
      const data = (await res.json()) as {
        ok: boolean;
        customer?: CustomerDirectoryRecord;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.customer) {
        setError(data.error || "We couldn't load this customer profile.");
        return;
      }
      setCustomer(data.customer);
    } catch {
      setError("We couldn't load this customer profile.");
    } finally {
      setLoading(false);
    }
  }, [customerId, workspace.slug]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard/customers"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
        >
          <AppIcon name="arrow_back" className="text-[16px]" />
          <span>Back to All Customers</span>
        </Link>
      </div>

      {loading ? (
        <div className="h-96 rounded-xl bg-white border border-border animate-pulse" />
      ) : error || !customer ? (
        <div className="bg-white rounded-xl border border-border p-8 text-center space-y-3">
          <p className="text-sm font-semibold text-text-primary">
            {error || 'Customer profile not found.'}
          </p>
          <div className="flex justify-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void loadProfile()}>
              Retry
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => router.push('/dashboard/customers')}
            >
              Back to Customers
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden bg-surface">
          <CustomerProfileView
            customer={customer}
            timezone={workspace.timezone}
            userRole={apiState.role}
            canPersistEdits
            onCustomerUpdated={(updated) => setCustomer(updated)}
            onOpenExistingProfile={(existingId) =>
              router.push(`/dashboard/customers/${existingId}`)
            }
            onCreateBooking={() => setNewBookingModalOpen(true)}
            onNavigateSection={(sec) => setActiveNav(sec)}
          />
        </div>
      )}
    </div>
  );
}
