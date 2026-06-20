import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Route Handlers run on the server and never see the browser's localStorage
 * session, so the shared `@/lib/supabase-client` singleton always falls back
 * to the `anon` role there. The marketing tables' RLS policies require
 * `authenticated`, so every route builds a client scoped to this one request,
 * forwarding the caller's bearer token so `auth.uid()` resolves correctly.
 */
export function getRouteClient(authHeader: string | null): SupabaseClient {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
    global: authHeader ? { headers: { Authorization: authHeader } } : undefined,
  });
}
