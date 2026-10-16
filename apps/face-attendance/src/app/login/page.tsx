import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoginForm } from './login-form';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-[380px]">
        <CardHeader className="text-center">
          <div className="mb-4 flex items-center justify-center">
            <Image src="/logo.png" alt="Abby's Caterers" width={200} height={97} priority style={{ mixBlendMode: 'darken' }} />
          </div>
          <CardTitle className="text-2xl font-bold">Abby&apos;s Attendance</CardTitle>
          <CardDescription>
            HR managers: sign in with your usual account. Attendance tablets: sign in with the device login.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  );
}
