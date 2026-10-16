import Link from 'next/link';
import { AreaPlaceholder } from '@/components/area-placeholder';
import { requireIdentity } from '@/lib/require-identity';

export const dynamic = 'force-dynamic';

export default async function EnrollPage() {
  const { email } = await requireIdentity(['hr']);
  return (
    <AreaPlaceholder
      title="Enrolment"
      phase="Phase 2"
      summary="Where HR registers employees for face attendance."
      signedInAs={email}
      planned={[
        'Record the employee’s biometric consent before anything is captured.',
        'Capture face templates (numbers only, no photos are kept) and set a fallback PIN.',
        'Issue one-time setup codes so employees can register themselves at a kiosk.',
        'See and change each employee’s face status (none, active, suspended).',
      ]}
      footer={
        <nav className="text-sm">
          <Link className="underline" href="/review">Back to review</Link>
        </nav>
      }
    />
  );
}
