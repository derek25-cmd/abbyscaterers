import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { SupabaseClient } from '@abbyscaterers/database';
import { supabaseEnv } from './env';

/** Supabase client for server components and route handlers, as the signed-in user. */
export function getServerSupabase(): SupabaseClient {
  const { url, anonKey } = supabaseEnv();
  const cookieStore = cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server components cannot set cookies. The middleware refreshes
          // the session on every request, so this is safe to ignore.
        }
      },
    },
  });
}
