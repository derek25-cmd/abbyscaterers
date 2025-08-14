
"use client";

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === '/') {
      router.replace('/dashboard');
    }
  }, [router, pathname]);

  if (pathname === '/') {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center bg-background p-4 text-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <h1 className="text-2xl font-semibold text-foreground">Redirecting to Dashboard...</h1>
        <p className="text-muted-foreground">Please wait while we prepare your dashboard.</p>
      </div>
    );
  }

  return null;
}
