import { Suspense } from 'react';
import { DataQualityPageComponent } from './DataQualityPageComponent';
import { LoadingPage } from '@/components/layout/loading-page';

export default function DataQualityPage() {
  return (
    <Suspense fallback={<LoadingPage title="Loading Data Quality..." />}>
      <DataQualityPageComponent />
    </Suspense>
  );
}
