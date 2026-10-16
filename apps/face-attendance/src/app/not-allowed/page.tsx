import { ShieldX } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SignOutButton } from '@/components/sign-out-button';
import { requireIdentity } from '@/lib/require-identity';

export const dynamic = 'force-dynamic';

export default async function NotAllowedPage() {
  const { email } = await requireIdentity(['none']);
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <ShieldX className="mx-auto mb-2 h-10 w-10 text-destructive" aria-hidden />
          <CardTitle>This account cannot use Abby&apos;s Attendance</CardTitle>
          <CardDescription>
            {email ? <>You are signed in as <strong>{email}</strong>. </> : null}
            Only HR managers, general managers, admins and registered attendance tablets can open this app.
            To clock in or out, use the attendance tablet at your site.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <SignOutButton />
        </CardContent>
      </Card>
    </main>
  );
}
