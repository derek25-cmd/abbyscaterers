import Image from 'next/image';
import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background">
      <Image src="/logo.png" alt="Abby's Catersmart Logo" width={200} height={50} style={{ mixBlendMode: 'darken' }} />
      <SignIn />
    </div>
  );
}
