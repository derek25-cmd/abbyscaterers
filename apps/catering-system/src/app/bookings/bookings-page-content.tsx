
"use client";

import dynamic from 'next/dynamic';
import { LoadingPage } from '@/components/layout/loading-page';

const BookingListTable = dynamic(() =>
  import('@/components/bookings/booking-list-table').then(mod => mod.BookingListTable),
  {
    ssr: false,
    loading: () => <LoadingPage title="Loading Bookings..." message="Organizing all your continuous contracts." />
  }
);

export function BookingsPageContent() {
  return <BookingListTable />;
}
