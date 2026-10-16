'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@abbyscaterers/database';
import { supabaseEnv } from './env';

// Unlike catering-system (localStorage session), the session lives in
// cookies so the middleware and server components can see who is signed in
// and route them before anything renders.
let client: SupabaseClient | undefined;

export function getBrowserSupabase(): SupabaseClient {
  if (!client) {
    const { url, anonKey } = supabaseEnv();
    client = createBrowserClient(url, anonKey);
  }
  return client;
}
