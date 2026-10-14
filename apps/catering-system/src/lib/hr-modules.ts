'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase-client';

/**
 * The HR module switch (app_settings.hr_modules, migration 20261014001900).
 *
 * It only decides what the app SHOWS: when a module is off, its menu items,
 * buttons, dashboard cards and pages are hidden and its cron does nothing.
 * The database rules apply whatever it says. Read at runtime, so switching a
 * module off or on needs no deploy.
 *
 * Never hidden, whatever the switch says: "End employment without a letter"
 * and Settings → Users & Access.
 */
export { HR_MODULES, HR_MODULE_LABELS, parseHrModules, isHrModuleOn, moduleOfDocType } from './hr-modules-core';
export type { HrModule } from './hr-modules-core';
import { HR_MODULES, parseHrModules, isHrModuleOn, type HrModule } from './hr-modules-core';

// ── Loading (one request per page load, shared by every component) ─────────
let cache: Set<HrModule> | null = null;
let inflight: Promise<Set<HrModule>> | null = null;
const listeners = new Set<(m: Set<HrModule>) => void>();

export async function loadHrModules(force = false): Promise<Set<HrModule>> {
  if (cache && !force) return cache;
  if (inflight && !force) return inflight;
  inflight = (async () => {
    const { data, error } = await supabase.from('app_settings').select('hr_modules').eq('id', true).maybeSingle();
    // Column missing (migration not applied) or not readable: show everything.
    const result = error ? new Set<HrModule>(HR_MODULES) : parseHrModules(data?.hr_modules ?? null);
    if (error && error.code !== '42703') console.error('Could not read the HR module switch:', error.message);
    cache = result;
    inflight = null;
    listeners.forEach((l) => l(result));
    return result;
  })();
  return inflight;
}

/** Saves the switch (Admin only; the database checks) and updates every screen. */
export async function saveHrModules(modules: HrModule[]): Promise<Set<HrModule>> {
  const { error } = await supabase.rpc('set_hr_modules', { p_modules: modules });
  if (error) throw new Error(error.message || 'Could not save the HR modules.');
  return loadHrModules(true);
}

/** The enabled modules, or null while they load. */
export function useHrModules(): Set<HrModule> | null {
  const [modules, setModules] = useState<Set<HrModule> | null>(cache);
  useEffect(() => {
    listeners.add(setModules);
    if (!cache) void loadHrModules();
    return () => { listeners.delete(setModules); };
  }, []);
  return modules;
}

/**
 * Whether a module is on. False while the switch loads (so nothing flashes on
 * and then disappears); use `useHrModules()` to tell "loading" from "off".
 */
export function useHrModule(name: HrModule): boolean {
  const modules = useHrModules();
  return !!modules && isHrModuleOn(modules, name);
}
