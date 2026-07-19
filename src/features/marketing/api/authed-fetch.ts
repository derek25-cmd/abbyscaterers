import { supabase } from "@/lib/supabase-client";

const DEFAULT_TIMEOUT_MS = 20_000;
// File uploads (e.g. the companies Excel import) carry a real payload over a
// potentially slow connection — give them much more headroom than a normal
// JSON API call so a large file on a slow network isn't aborted mid-upload.
const UPLOAD_TIMEOUT_MS = 120_000;

/** Attaches the current browser session's access token so Route Handlers can forward it to Supabase for RLS. */
export async function authedFetch(url: string, init?: RequestInit): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = new Headers(init?.headers);
  const isUpload = init?.body instanceof FormData;
  // FormData bodies need the browser to set their own multipart boundary — never override it.
  if (!isUpload) headers.set("Content-Type", "application/json");
  if (session?.access_token) headers.set("Authorization", `Bearer ${session.access_token}`);
  // Only apply the default timeout if the caller didn't already bring their own signal.
  const signal = init?.signal ?? AbortSignal.timeout(isUpload ? UPLOAD_TIMEOUT_MS : DEFAULT_TIMEOUT_MS);
  return fetch(url, { ...init, headers, signal });
}
