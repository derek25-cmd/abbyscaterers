
"use client";

import { useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { LoadingPage } from './loading-page';

export function PrivateRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return <LoadingPage title="Authenticating..." message="Please wait while we check your credentials." />;
  }

  if (!user) {
    return null; // or a redirect component
  }

  return <>{children}</>;
}
