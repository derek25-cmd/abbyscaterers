import { redirect } from 'next/navigation';
import type { FaceIdentity } from '@abbyscaterers/types';
import { getServerSupabase } from './supabase/server';
import { HOME_FOR, whoami } from './identity';

/**
 * Server-side guard for a page, on top of the middleware: a page must not
 * rely on the middleware matcher being right. Redirects anyone not allowed.
 */
export async function requireIdentity(allowed: readonly FaceIdentity[]): Promise<{ identity: FaceIdentity; email: string | null }> {
  const supabase = getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const identity = await whoami(supabase);
  if (!allowed.includes(identity)) redirect(HOME_FOR[identity]);
  return { identity, email: user.email ?? null };
}
