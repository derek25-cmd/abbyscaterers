import { supabase } from '@/lib/supabase-client';

const DEFAULT_TIMEOUT_MS = 20_000;
const UPLOAD_TIMEOUT_MS = 120_000;

/** Attaches the current browser session's access token so Route Handlers can forward it to Supabase for RLS. */
export async function authedFetch(url: string, init?: RequestInit): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = new Headers(init?.headers);
  const isUpload = init?.body instanceof FormData;
  if (!isUpload) headers.set('Content-Type', 'application/json');
  if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`);
  const signal = init?.signal ?? AbortSignal.timeout(isUpload ? UPLOAD_TIMEOUT_MS : DEFAULT_TIMEOUT_MS);
  return fetch(url, { ...init, headers, signal });
}
