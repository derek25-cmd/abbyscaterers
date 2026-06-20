import { supabase } from "@/lib/supabase-client";

/** Attaches the current browser session's access token so Route Handlers can forward it to Supabase for RLS. */
export async function authedFetch(url: string, init?: RequestInit): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = new Headers(init?.headers);
  // FormData bodies need the browser to set their own multipart boundary — never override it.
  if (!(init?.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (session?.access_token) headers.set("Authorization", `Bearer ${session.access_token}`);
  return fetch(url, { ...init, headers });
}
