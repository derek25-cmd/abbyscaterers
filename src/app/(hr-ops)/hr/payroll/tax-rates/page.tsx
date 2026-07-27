
import { Suspense } from 'react';
import { TaxRatesPageComponent } from './TaxRatesPageComponent';
import { LoadingPage } from '@/components/layout/loading-page';

export default function TaxRatesPage() {
  return (
    <Suspense fallback={<LoadingPage title="Loading Tax Rates..." />}>
      <TaxRatesPageComponent />
    </Suspense>
  );
}
