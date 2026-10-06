'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useMemo, useRef } from 'react';
import { createPortalSupabaseClient, type SupabaseClient } from '@abbyscaterers/database';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Client-component hook returning a Supabase client whose requests carry a
 * Clerk-issued JWT (via the "supabase" JWT template), verified by Supabase's
 * third-party auth support. The client is keyed on the Clerk user id (not the
 * session object, which Clerk replaces on every token refresh) and reads the
 * latest getToken through a ref, so it stays stable for the life of a sign-in
 * instead of being rebuilt — and realtime channels torn down — on refresh.
 */
export function useSupabaseClient(): SupabaseClient {
  const { getToken, userId } = useAuth();
  const getTokenRef = useRef(getToken);
  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  return useMemo(
    () =>
      createPortalSupabaseClient({
        url: SUPABASE_URL,
        anonKey: SUPABASE_ANON_KEY,
        getAccessToken: async () => {
          try {
            return (await getTokenRef.current({ template: 'supabase' })) ?? null;
          } catch (err) {
            // Typically: no "supabase" JWT template in this Clerk instance.
            // Fall back to an anonymous request so queries fail fast under RLS
            // instead of hanging on a rejected token promise.
            console.error('[supabase-client] Clerk getToken({ template: "supabase" }) failed:', err);
            return null;
          }
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId]
  );
}
