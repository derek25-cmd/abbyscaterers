
import { Suspense } from 'react';
import { RunPayrollPageComponent } from './RunPayrollPageComponent';
import { LoadingPage } from '@/components/layout/loading-page';

export default function RunPayrollPage() {
  return (
    <Suspense fallback={<LoadingPage title="Loading Payroll Run..." />}>
      <RunPayrollPageComponent />
    </Suspense>
  );
}
