import { supabase } from '@/lib/supabase-client';
import { todayInDar } from '@/services/hrDocumentService';
import type { ContractType, DisciplinaryRecord, EmploymentContract, RecognitionRecord } from '@/types';

// The records behind HR letters (Phase 4): contracts, warnings and rewards.
// They are written only by issuing (or voiding) a letter, or for contracts that
// pre-date the system, by recordLegacyContract. Everything here is HR-only,
// except pendingCashRewards / markRewardPaid which finance also uses.

interface DbError { message: string; code?: string }
const toError = (e: DbError, fallback: string) =>
  new Error(e.code === '42501' && !/^(Only|You )/.test(e.message) ? 'You do not have permission to do that.' : e.message || fallback);

// ── Contracts ──────────────────────────────────────────────────────────────

export const listContracts = async (employeeId: string): Promise<EmploymentContract[]> => {
  const { data, error } = await supabase.from('employment_contracts').select('*').eq('employee_id', employeeId).order('start_date');
  if (error) throw toError(error, 'Could not load the contracts.');
  return (data ?? []) as EmploymentContract[];
};

export const listActiveContracts = async (employeeId: string): Promise<EmploymentContract[]> =>
  (await listContracts(employeeId)).filter((c) => c.status === 'active');

export interface LegacyContractInput {
  employeeId: string;
  contractType: ContractType;
  startDate: string;
  endDate?: string | null;
  position: string;
  salary?: number | null;
  probationMonths?: number | null;
  noticeDays?: number | null;
  /** 'active' for the current contract, 'expired' for a past one kept for the record. */
  status?: 'active' | 'expired';
}

/** For staff hired before the system: records their contract without a letter, so reminders cover them. */
export const recordLegacyContract = async (input: LegacyContractInput): Promise<EmploymentContract> => {
  if (input.contractType !== 'permanent' && !input.endDate) throw new Error('Enter the end date (only a permanent contract has none).');
  if (input.endDate && input.endDate < input.startDate) throw new Error('The end date cannot be before the start date.');
  const { data, error } = await supabase.rpc('record_legacy_contract', {
    p_employee: input.employeeId, p_contract_type: input.contractType, p_start: input.startDate, p_end: input.endDate || null,
    p_position: input.position, p_salary: input.salary ?? null, p_probation_months: input.probationMonths ?? null,
    p_notice_days: input.noticeDays ?? null, p_status: input.status ?? 'active',
  });
  if (error) throw toError(error, 'Could not record the contract.');
  return data as EmploymentContract;
};

export interface ExpiringContract extends EmploymentContract { employee_name: string; days_left: number }

/** Active contracts ending within `days` (default 60), soonest first, plus any already past their end. */
export const listExpiringContracts = async (days = 60): Promise<ExpiringContract[]> => {
  const today = todayInDar();
  const until = new Date(`${today}T00:00:00Z`);
  until.setUTCDate(until.getUTCDate() + days);
  const { data, error } = await supabase
    .from('employment_contracts').select('*')
    .eq('status', 'active').not('end_date', 'is', null).lte('end_date', until.toISOString().slice(0, 10))
    .order('end_date');
  if (error) throw toError(error, 'Could not load the expiring contracts.');
  const rows = (data ?? []) as EmploymentContract[];
  const ids = [...new Set(rows.map((r) => r.employee_id))];
  const { data: people } = ids.length
    ? await supabase.from('employees').select('id, firstName, lastName').in('id', ids)
    : { data: [] };
  const name = new Map(((people ?? []) as { id: string; firstName: string; lastName: string }[]).map((p) => [p.id, `${p.firstName} ${p.lastName}`]));
  const t0 = Date.parse(`${today}T00:00:00Z`);
  return rows.map((r) => ({
    ...r,
    employee_name: name.get(r.employee_id) ?? r.employee_id,
    days_left: Math.round((Date.parse(`${r.end_date}T00:00:00Z`) - t0) / 86_400_000),
  }));
};

// ── Warnings (confidential) ────────────────────────────────────────────────

export const listWarnings = async (employeeId: string): Promise<DisciplinaryRecord[]> => {
  const { data, error } = await supabase.from('disciplinary_records').select('*').eq('employee_id', employeeId).order('incident_date', { ascending: false });
  if (error) throw toError(error, 'Could not load the warnings.');
  return (data ?? []) as DisciplinaryRecord[];
};

/** Warnings still in force today (active, and not past their expiry date). */
export const isWarningInForce = (w: Pick<DisciplinaryRecord, 'status' | 'expires_on'>, today = todayInDar()) =>
  w.status === 'active' && w.expires_on >= today;

export const countActiveWarnings = async (employeeId: string): Promise<number> =>
  (await listWarnings(employeeId)).filter((w) => isWarningInForce(w)).length;

// ── Recognition and cash rewards ───────────────────────────────────────────

export const listRecognition = async (employeeId: string): Promise<RecognitionRecord[]> => {
  const { data, error } = await supabase.from('recognition_records').select('*').eq('employee_id', employeeId).order('created_at', { ascending: false });
  if (error) throw toError(error, 'Could not load the recognition records.');
  return (data ?? []) as RecognitionRecord[];
};

export interface PendingCashReward { id: string; employee_id: string; employee_name: string; amount: number; awarded_on: string; category: string }

/** Cash rewards waiting to be paid through payroll. HR and finance. */
export const pendingCashRewards = async (): Promise<PendingCashReward[]> => {
  const { data, error } = await supabase.rpc('pending_cash_rewards');
  if (error) throw toError(error, 'Could not load the pending rewards.');
  return (data ?? []) as PendingCashReward[];
};

/** Records which payroll paid a cash reward. Payroll itself is not changed. */
export const markRewardPaid = async (rewardId: string, payrollId: string): Promise<void> => {
  if (!payrollId.trim()) throw new Error('Choose the payroll the reward was paid in.');
  const { error } = await supabase.rpc('mark_recognition_paid', { p_id: rewardId, p_payroll_id: payrollId.trim() });
  if (error) throw toError(error, 'Could not mark the reward as paid.');
};

// ── Ending employment without a letter ────────────────────────────────────

/**
 * The direct path, for cases with no letter. The database does everything the
 * termination letter does (contract terminated, later leave cancelled) and
 * returns a plain list of what changed, for showing to HR.
 */
export const endEmploymentWithoutLetter = async (employeeId: string, lastDay: string, reason: string): Promise<string[]> => {
  if (reason.trim().length < 3) throw new Error('Give the reason employment is ending.');
  const { data, error } = await supabase.rpc('end_employment_without_letter', { p_employee: employeeId, p_end_date: lastDay, p_reason: reason.trim() });
  if (error) throw toError(error, 'Could not end the employment.');
  return (data ?? []) as string[];
};

// ── Reactivating and deleting ──────────────────────────────────────────────

/**
 * Re-hire someone who has left: the only change allowed on a closed record.
 * The database clears their end date and reason (migration 20261015000000).
 */
export const reactivateEmployee = async (employeeId: string): Promise<void> => {
  const { error } = await supabase.from('employees').update({ status: 'Active' }).eq('id', employeeId);
  if (error) throw toError(error, 'Could not reactivate the employee.');
};

/** What is recorded for an employee, e.g. [{ what: 'attendance day(s)', records: 12 }]. HR only. */
export const getEmployeeHistory = async (employeeId: string): Promise<{ what: string; records: number }[]> => {
  const { data, error } = await supabase.rpc('employee_history', { p_employee: employeeId });
  if (error) throw toError(error, 'Could not check the employee\'s records.');
  return ((data ?? []) as { what: string; records: number }[]).map((r) => ({ what: r.what, records: Number(r.records) }));
};

/**
 * Deletes an employee who has no history (added by mistake, never worked).
 * Refused, with the reason, when anything is recorded for them: such people
 * are ended (Inactive) instead, so no employment record is lost.
 */
export const deleteEmployee = async (employeeId: string): Promise<void> => {
  const { error } = await supabase.rpc('delete_employee', { p_employee: employeeId });
  if (error) throw toError(error, 'Could not delete the employee.');
};
