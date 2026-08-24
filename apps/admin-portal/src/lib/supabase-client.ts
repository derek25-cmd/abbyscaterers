'use client';

import { useSession } from '@clerk/nextjs';
import { useMemo } from 'react';
import { createPortalSupabaseClient, type SupabaseClient } from '@abbyscaterers/database';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Client-component hook returning a Supabase client whose requests carry a
 * Clerk-issued JWT (via the "supabase" JWT template), verified by Supabase's
 * third-party auth support. Not a singleton — each caller gets a client bound
 * to the current Clerk session, matching @abbyscaterers/database's factory
 * design (see its own comment for why).
 */
export function useSupabaseClient(): SupabaseClient {
  const { session } = useSession();

  return useMemo(
    () =>
      createPortalSupabaseClient({
        url: SUPABASE_URL,
        anonKey: SUPABASE_ANON_KEY,
        getAccessToken: async () => session?.getToken({ template: 'supabase' }) ?? null,
      }),
    [session]
  );
}
