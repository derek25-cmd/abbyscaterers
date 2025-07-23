
"use client";

import dynamic from 'next/dynamic';
import { LoadingPage } from '@/components/layout/loading-page';

const DailyMenuListTable = dynamic(() =>
  import('@/components/daily-menus/daily-menu-list-table').then(mod => mod.DailyMenuListTable),
  {
    ssr: false,
    loading: () => <LoadingPage title="Loading Bookings..." message="Organizing all your events and bookings." />
  }
);

export function DailyMenusPageContent() {
  return <DailyMenuListTable />;
}
