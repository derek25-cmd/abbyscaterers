
import { Suspense } from 'react';
import { AttendancePageComponent } from './AttendancePageComponent';
import { LoadingPage } from '@/components/layout/loading-page';

export default function AttendancePage() {
  return (
    <Suspense fallback={<LoadingPage title="Loading Attendance..." />}>
      <AttendancePageComponent />
    </Suspense>
  );
}
