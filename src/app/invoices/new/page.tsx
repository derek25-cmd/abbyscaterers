
import { Suspense } from 'react';
import { NewInvoicePageComponent } from './new-invoice-page-component';
import { LoadingPage } from '@/components/layout/loading-page';

export default function NewInvoicePage() {
  return (
    <Suspense fallback={<LoadingPage title="Loading Invoice Form..." />}>
      <NewInvoicePageComponent />
    </Suspense>
  );
}
