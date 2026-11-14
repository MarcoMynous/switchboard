'use client';

import { Suspense } from 'react';
import { ServicesStaffView } from '@/components/dashboard/services-staff/ServicesStaffView';

export default function ServicesStaffPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <div className="h-14 rounded-xl bg-surface-container-low animate-pulse" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 rounded-xl bg-surface-container-low animate-pulse" />
            ))}
          </div>
          <div className="h-64 rounded-xl bg-surface-container-low animate-pulse" />
        </div>
      }
    >
      <ServicesStaffView />
    </Suspense>
  );
}
