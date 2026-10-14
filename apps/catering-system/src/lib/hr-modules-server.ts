import type { SupabaseClient } from '@supabase/supabase-js';
import { isHrModuleOn, parseHrModules, type HrModule } from '@/lib/hr-modules-core';

/**
 * For the cron routes: whether a module is switched on. If the switch cannot
 * be read (e.g. the migration is not applied yet) the job runs as before: the
 * switch only hides things, it is never a reason to skip work by accident.
 */
export async function isHrModuleOnServer(client: SupabaseClient, module: HrModule): Promise<boolean> {
  const { data, error } = await client.from('app_settings').select('hr_modules').eq('id', true).maybeSingle();
  if (error) return true;
  return isHrModuleOn(parseHrModules(data?.hr_modules ?? null), module);
}
