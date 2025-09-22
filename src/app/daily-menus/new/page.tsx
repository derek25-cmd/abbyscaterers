
import { Suspense } from 'react';
import { NewDailyMenuPageComponent } from './new-daily-menu-page-component';
import { LoadingPage } from '@/components/layout/loading-page';

export default function NewDailyMenuPage() {
  return (
    <Suspense fallback={<LoadingPage title="Loading form..." />}>
      <NewDailyMenuPageComponent />
    </Suspense>
  );
}
