
"use client";

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Redirect root path to /login, but allow other paths to work
    if (pathname === '/') {
      router.replace('/login');
    }
  }, [router, pathname]);

  // Only show loading indicator on the root path while redirecting
  if (pathname === '/') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <h1 className="text-2xl font-semibold text-foreground">Loading Application...</h1>
        <p className="text-muted-foreground">Please wait while we prepare the login page.</p>
      </div>
    );
  }

  // For any other path, let Next.js handle rendering, so return null here.
  return null;
}
