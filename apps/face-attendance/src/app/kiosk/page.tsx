import { AreaPlaceholder } from '@/components/area-placeholder';
import { requireIdentity } from '@/lib/require-identity';

export const dynamic = 'force-dynamic';

export default async function KioskPage() {
  const { identity, email } = await requireIdentity(['device', 'hr']);
  return (
    <AreaPlaceholder
      title="Kiosk"
      phase="Phase 3"
      summary={
        identity === 'hr'
          ? 'You are viewing the kiosk screen as HR, for testing. Tablets sign in with their own device login.'
          : 'This tablet is signed in as an attendance kiosk.'
      }
      signedInAs={email}
      planned={[
        'Full-screen camera view: employees look at the tablet to clock in or out.',
        'A PIN pad as a fallback when the face is not recognised.',
        'A clear confirmation on screen: name, in or out, and the time.',
        'Self-registration with a one-time setup code from HR.',
      ]}
    />
  );
}
