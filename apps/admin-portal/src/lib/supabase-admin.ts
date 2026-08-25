import 'server-only';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Service-role client for the two push-notification API routes — Clerk
 * sessions aren't Supabase JWTs, so these server routes can't authenticate
 * as the portal user the way client-side calls do via portal_uid(). Never
 * import this from client code; the service-role key bypasses RLS entirely.
 */
export function createSupabaseAdminClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
