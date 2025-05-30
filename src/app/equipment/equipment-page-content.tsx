
"use client";

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

const EquipmentListTable = dynamic(() =>
  import('@/components/equipment/equipment-list-table').then(mod => mod.EquipmentListTable),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-10 w-64" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-40" />
          </div>
        </div>
        <Skeleton className="h-96 w-full rounded-md border" />
        <div className="flex items-center justify-end space-x-2 py-4">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>
    )
  }
);

export function EquipmentPageContent() {
  return <EquipmentListTable />;
}
