
import { Suspense } from 'react';
import { PayrollPageComponent } from './PayrollPageComponent';
import { LoadingPage } from '@/components/layout/loading-page';

export default function PayrollPage() {
  return (
    <Suspense fallback={<LoadingPage title="Loading Payroll..." />}>
      <PayrollPageComponent />
    </Suspense>
  );
}
