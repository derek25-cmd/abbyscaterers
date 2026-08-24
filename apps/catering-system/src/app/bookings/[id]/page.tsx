
import { Suspense } from 'react';
import { BookingDetailsPageComponent } from './booking-details-page-component';
import { LoadingPage } from '@/components/layout/loading-page';


export async function generateStaticParams() {
  return [];
}

export default function BookingDetailsPage() {
  return (
    <Suspense fallback={<LoadingPage title="Loading Booking Details..." />}>
        <BookingDetailsPageComponent />
    </Suspense>
  );
}
