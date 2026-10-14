import type { HrDocTypeCode } from '@/types';

/**
 * The HR module switch rules (app_settings.hr_modules, migration
 * 20261014001900), with no browser or Supabase imports, so the cron routes and
 * the tests can use them. The hook lives in ./hr-modules.
 */
export const HR_MODULES = ['audit', 'leave', 'documents', 'letters', 'candidates'] as const;
export type HrModule = (typeof HR_MODULES)[number];

export const HR_MODULE_LABELS: Record<HrModule, string> = {
  audit: 'Audit Trail',
  leave: 'Leave',
  documents: 'HR Documents (general letters, templates)',
  letters: 'Letter types (contracts, warnings, termination...)',
  candidates: 'Candidates and offers',
};

/** Modules that only work when another one is on too. */
const REQUIRES: Partial<Record<HrModule, HrModule[]>> = {
  letters: ['documents'],
  candidates: ['documents', 'letters'],
};

/**
 * The stored value as a set of modules. NULL, or anything unreadable, means
 * every module is on: the switch hides things, and failing to read it must
 * not hide the whole HR area.
 */
export function parseHrModules(value: unknown): Set<HrModule> {
  if (!Array.isArray(value)) return new Set(HR_MODULES);
  return new Set(value.filter((v): v is HrModule => (HR_MODULES as readonly string[]).includes(v as string)));
}

/** On, and everything it depends on is on. */
export function isHrModuleOn(enabled: Set<HrModule>, module: HrModule): boolean {
  return enabled.has(module) && (REQUIRES[module] ?? []).every((m) => enabled.has(m));
}

/** Which module a letter type belongs to. */
export function moduleOfDocType(docType: HrDocTypeCode): HrModule {
  if (docType === 'general_letter') return 'documents';
  if (docType === 'offer') return 'candidates';
  return 'letters';
}
