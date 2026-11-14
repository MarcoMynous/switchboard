import { Suspense } from 'react';
import { CustomersManagementView } from '@/components/dashboard/customers/CustomersManagementView';

export default function CustomersPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <div className="h-10 w-48 rounded-lg bg-surface-container-low animate-pulse" />
          <div className="h-64 rounded-xl bg-surface-container-low animate-pulse" />
        </div>
      }
    >
      <CustomersManagementView />
    </Suspense>
  );
}
