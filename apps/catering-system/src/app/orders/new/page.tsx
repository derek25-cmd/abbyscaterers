
import { Suspense } from 'react';
import { NewOrderPageComponent } from './new-order-page-component';
import { LoadingPage } from '@/components/layout/loading-page';

export default function NewOrderPage() {
  return (
    <Suspense fallback={<LoadingPage title="Loading form..." />}>
      <NewOrderPageComponent />
    </Suspense>
  );
}
