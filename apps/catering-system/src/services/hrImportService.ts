import { supabase } from '@/lib/supabase-client';
import { todayInDar } from '@/services/hrDocumentService';
import { getEmployees } from '@/services/employeeService';
import { getBalances, getLeaveTypes } from '@/services/leaveService';
import type { ContractCheckContext, OpeningCheckContext } from '@/lib/hr-import';

// The two go-live importers (Phase 5). Each file is one database call: all
// rows import, or none do (migration 20261014002000). HR roles only.

interface DbError { message: string; code?: string }
const toError = (e: DbError, fallback: string) =>
  new Error(e.code === '42501' && !/^(Only|You )/.test(e.message) ? 'You do not have permission to do that.' : e.message || fallback);

const employeeMap = async () => {
  const employees = await getEmployees();
  return new Map(employees.map((e) => [e.id, { status: e.status, name: `${e.firstName} ${e.lastName}` }]));
};

/** What the contract preview checks against. */
export const loadContractCheckContext = async (): Promise<ContractCheckContext> => {
  const [employees, active] = await Promise.all([
    employeeMap(),
    supabase.from('employment_contracts').select('employee_id').eq('status', 'active'),
  ]);
  if (active.error) throw toError(active.error, 'Could not load the existing contracts.');
  return {
    employees,
    withActiveContract: new Set(((active.data ?? []) as { employee_id: string }[]).map((r) => r.employee_id)),
    today: todayInDar(),
  };
};

/** The year opening balances belong to (this year until go-live is recorded). */
export const getGoLiveYear = async (): Promise<number> => {
  const { data, error } = await supabase.rpc('hr_go_live_year');
  if (error) return Number(todayInDar().slice(0, 4));
  return data as number;
};

/** What the opening-balance preview checks against. */
export const loadOpeningCheckContext = async (): Promise<OpeningCheckContext> => {
  const goLiveYear = await getGoLiveYear();
  const [employees, types, balances] = await Promise.all([employeeMap(), getLeaveTypes(true), getBalances(goLiveYear)]);
  return {
    employees,
    leaveTypes: new Map(types.map((t) => [t.name.toLowerCase(), { id: t.id, name: t.name, tracksBalance: t.tracks_balance }])),
    goLiveYear,
    // Room left before the opening figure: entitled + carried - taken by the system.
    available: new Map(balances.map((b) => [`${b.employee_id}/${b.leave_type_id}`, b.entitled + b.carried_forward - b.taken])),
  };
};

export const importLegacyContracts = async (rows: Record<string, string>[]): Promise<{ imported: number; active: number; expired: number }> => {
  const { data, error } = await supabase.rpc('import_legacy_contracts', { p_rows: rows });
  if (error) throw toError(error, 'Could not import the contracts.');
  return data as { imported: number; active: number; expired: number };
};

export const importOpeningLeave = async (rows: Record<string, string>[]): Promise<{ imported: number }> => {
  const { data, error } = await supabase.rpc('import_opening_leave', { p_rows: rows });
  if (error) throw toError(error, 'Could not import the opening balances.');
  return data as { imported: number };
};
