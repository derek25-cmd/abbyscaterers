
"use client";

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

const DailyMenuListTable = dynamic(() =>
  import('@/components/daily-menus/daily-menu-list-table').then(mod => mod.DailyMenuListTable),
  {
    ssr: false,
    loading: () => (
       <div className="space-y-4 animate-pulse">
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-10 w-64" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-40" />
          </div>
        </div>
        <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
        </div>
      </div>
    )
  }
);

export function DailyMenusPageContent() {
  return <DailyMenuListTable />;
}
