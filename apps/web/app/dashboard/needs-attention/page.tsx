'use client';

import { Suspense } from 'react';
import { NeedsAttentionView } from '@/components/dashboard/needs-attention/NeedsAttentionView';

export default function NeedsAttentionPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <div className="h-12 rounded-xl bg-surface-container-low animate-pulse" />
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 rounded-xl bg-surface-container-low animate-pulse" />
            ))}
          </div>
          <div className="h-64 rounded-xl bg-surface-container-low animate-pulse" />
        </div>
      }
    >
      <NeedsAttentionView />
    </Suspense>
  );
}
