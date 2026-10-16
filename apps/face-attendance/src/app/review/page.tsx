import Link from 'next/link';
import { AreaPlaceholder } from '@/components/area-placeholder';
import { requireIdentity } from '@/lib/require-identity';

export const dynamic = 'force-dynamic';

export default async function ReviewPage() {
  const { email } = await requireIdentity(['hr']);
  return (
    <AreaPlaceholder
      title="Attendance review"
      phase="Phase 4"
      summary="Where HR checks the clock-ins and clock-outs the kiosk was not sure about."
      signedInAs={email}
      planned={[
        'A queue of punches marked for review (weak face match, PIN used, unusual time or place).',
        'Approve or reject each punch with a note. Approved punches go into that day’s attendance automatically.',
        'Today at a glance: who has clocked in, who is late, who has not arrived.',
        'Kiosk devices and their sites (admins manage them).',
      ]}
      footer={
        <nav className="flex flex-wrap gap-4 text-sm">
          <Link className="underline" href="/enroll">Enrolment</Link>
          <Link className="underline" href="/kiosk">Open the kiosk screen (testing)</Link>
        </nav>
      }
    />
  );
}
