import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';
import { HOME_FOR, whoami } from '@/lib/identity';

// The middleware normally redirects / before this renders; this is the
// fallback if it did not run.
export const dynamic = 'force-dynamic';

export default async function Home() {
  const supabase = getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  redirect(HOME_FOR[await whoami(supabase)]);
}
