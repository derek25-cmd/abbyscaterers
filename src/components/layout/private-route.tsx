
"use client";

import { useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { LoadingPage } from './loading-page';
import { supabase } from '@/lib/supabase-client';

export function PrivateRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  // When user briefly becomes null (token-refresh race), wait before redirecting.
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      setVerifying(true);
      // Give the Supabase client 2 seconds to complete a concurrent token refresh
      // before treating null-user as a genuine expired session.
      const timer = setTimeout(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/login');
        }
        // If session came back, the onAuthStateChange in useAuth will restore user.
        setVerifying(false);
      }, 2000);
      return () => clearTimeout(timer);
    }

    setVerifying(false);
  }, [user, loading, router]);

  if (loading || verifying) {
    return <LoadingPage title="Authenticating..." message="Please wait while we check your credentials." />;
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
