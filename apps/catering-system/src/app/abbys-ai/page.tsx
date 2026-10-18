import { Suspense } from 'react';
import { AbbysAiPageComponent } from './AbbysAiPageComponent';
import { LoadingPage } from '@/components/layout/loading-page';

export default function AbbysAiPage() {
  return (
    <Suspense fallback={<LoadingPage title="Loading Abby's AI..." />}>
      <AbbysAiPageComponent />
    </Suspense>
  );
}
