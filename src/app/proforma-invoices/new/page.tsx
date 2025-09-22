
"use client";

import { Suspense } from 'react';
import { NewProformaInvoicePageComponent } from './new-proforma-invoice-page-component';
import { LoadingPage } from '@/components/layout/loading-page';

export default function NewProformaInvoicePage() {
  return (
    <Suspense fallback={<LoadingPage title="Loading Invoice Form..." />}>
      <NewProformaInvoicePageComponent />
    </Suspense>
  );
}
