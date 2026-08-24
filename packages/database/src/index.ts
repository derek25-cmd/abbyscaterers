import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Factory functions, not a module-level singleton (unlike
// apps/catering-system/src/lib/supabase-client.ts) — two independent Next.js
// apps must not share one client instance or one hard-coded env-var-read
// pattern.

export interface CreatePortalSupabaseClientOptions {
  url: string;
  anonKey: string;
  /**
   * Third-party auth token getter (e.g. Clerk's getToken({ template: 'supabase' })).
   * Wired via supabase-js's `accessToken` option so every request carries a
   * fresh, Supabase-verifiable JWT instead of a manually attached header.
   */
  getAccessToken: () => Promise<string | null>;
}

export function createPortalSupabaseClient(
  options: CreatePortalSupabaseClientOptions
): SupabaseClient {
  const { url, anonKey, getAccessToken } = options;
  return createClient(url, anonKey, {
    accessToken: getAccessToken,
  });
}

export interface CreateAnonSupabaseClientOptions {
  url: string;
  anonKey: string;
}

/** Unauthenticated client — for use before a user is signed in, or in RSCs that don't need a session. */
export function createAnonSupabaseClient(
  options: CreateAnonSupabaseClientOptions
): SupabaseClient {
  return createClient(options.url, options.anonKey);
}

export type { SupabaseClient };
