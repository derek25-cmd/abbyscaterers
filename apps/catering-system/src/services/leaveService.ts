import { supabase } from '@/lib/supabase-client';
import { LeaveRequestSchema } from '@/lib/schemas';
import { validate } from '@/lib/service-validation';
import { DEFAULT_WORKING_WEEK, balanceRemaining, workingDatesBetween } from '@/lib/leave';
import { getEmployeeDirectory } from '@/services/employeeService';
import type {
  LeaveBalance, LeaveRequest, LeaveRequestStatus, LeaveRequestView, LeaveSettings, LeaveType, PublicHoliday,
} from '@/types';

// Rules are enforced by the database (supabase/migrations/20261020000*): the
// triggers and functions there write the days, the balance and the attendance
// rows. This file only calls them and turns their refusals into readable
// errors. Every function throws an Error whose message is safe to show.

// ── Errors ─────────────────────────────────────────────────────────────────

interface DbError { message: string; code?: string; details?: string | null; hint?: string | null }

/** Approval stopped because attendance is already recorded on some of the days. */
export class LeaveConflictError extends Error {
  /** Days in the way, with the status recorded on each. */
  conflicts: { date: string; status: string }[];
  /** True when every conflict is an Absent row, which the approver may choose to replace. */
  onlyAbsent: boolean;

  constructor(message: string, conflicts: { date: string; status: string }[], onlyAbsent: boolean) {
    super(message);
    this.name = 'LeaveConflictError';
    this.conflicts = conflicts;
    this.onlyAbsent = onlyAbsent;
  }
}

function toError(error: DbError, fallback: string): Error {
  // 42501 = refused by row-level security / role check.
  if (error.code === '42501' && !/^(Only|You can only)/.test(error.message)) {
    return new Error('You do not have permission to do that.');
  }
  return new Error(error.message || fallback);
}

function parseConflicts(details?: string | null): { date: string; status: string }[] {
  if (!details) return [];
  try {
    const parsed = JSON.parse(details);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ── Reference data ─────────────────────────────────────────────────────────

export const getLeaveTypes = async (includeInactive = false): Promise<LeaveType[]> => {
  let query = supabase.from('leave_types').select('*').order('sort_order').order('name');
  if (!includeInactive) query = query.eq('is_active', true);
  const { data, error } = await query;
  if (error) throw toError(error, 'Could not load the leave types.');
  return (data ?? []) as LeaveType[];
};

export const saveLeaveType = async (type: Partial<LeaveType> & { name: string }): Promise<void> => {
  const { id, ...fields } = type;
  const { data, error } = id
    ? await supabase.from('leave_types').update(fields).eq('id', id).select('id')
    : await supabase.from('leave_types').insert([fields]).select('id');
  if (error) throw toError(error, 'Could not save the leave type.');
  if (!data?.length) throw new Error('The leave type was not saved. You may not have permission.');
};

export const getLeaveSettings = async (): Promise<LeaveSettings> => {
  const { data, error } = await supabase.from('leave_settings').select('working_days').eq('id', 1).maybeSingle();
  if (error || !data) return { working_days: [...DEFAULT_WORKING_WEEK] };
  return { working_days: data.working_days as number[] };
};

export const setWorkingWeek = async (days: number[]): Promise<void> => {
  if (days.length === 0) throw new Error('Choose at least one working day.');
  const { data, error } = await supabase.from('leave_settings').update({ working_days: days }).eq('id', 1).select('id');
  if (error) throw toError(error, 'Could not save the working week.');
  if (!data?.length) throw new Error('The working week was not saved. You may not have permission.');
};

export const getPublicHolidays = async (year?: number): Promise<PublicHoliday[]> => {
  let query = supabase.from('public_holidays').select('id, holiday_date, name').order('holiday_date');
  if (year) query = query.gte('holiday_date', `${year}-01-01`).lte('holiday_date', `${year}-12-31`);
  const { data, error } = await query;
  if (error) throw toError(error, 'Could not load the public holidays.');
  return (data ?? []) as PublicHoliday[];
};

export const addPublicHoliday = async (holidayDate: string, name: string): Promise<void> => {
  if (!holidayDate || !name.trim()) throw new Error('Enter the date and the name of the holiday.');
  const { error } = await supabase.from('public_holidays').insert([{ holiday_date: holidayDate, name: name.trim() }]);
  if (error) {
    if (error.code === '23505') throw new Error('That date is already in the holiday list.');
    throw toError(error, 'Could not add the holiday.');
  }
};

export const deletePublicHoliday = async (id: string): Promise<void> => {
  const { data, error } = await supabase.from('public_holidays').delete().eq('id', id).select('id');
  if (error) throw toError(error, 'Could not remove the holiday.');
  if (!data?.length) throw new Error('The holiday was not removed. You may not have permission.');
};

// ── Requests ───────────────────────────────────────────────────────────────

export interface ApplyForLeaveInput {
  employee_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  reason?: string;
  attachment_path?: string | null;
}

/**
 * Files a request. It is always created as pending; the day count, balance
 * check, overlap check and attachment rule are applied by the database, which
 * returns a clear message when something is wrong.
 */
export const applyForLeave = async (input: ApplyForLeaveInput): Promise<LeaveRequest> => {
  const valid = validate(LeaveRequestSchema, input);
  const { data, error } = await supabase
    .from('leave_requests')
    .insert([{
      employee_id: valid.employee_id,
      leave_type_id: valid.leave_type_id,
      start_date: valid.start_date,
      end_date: valid.end_date,
      reason: valid.reason?.trim() || null,
      attachment_path: valid.attachment_path || null,
    }])
    .select()
    .single();
  if (error) throw toError(error, 'Could not submit the leave request.');
  return data as LeaveRequest;
};

export interface RequestFilters {
  status?: LeaveRequestStatus;
  leaveTypeId?: string;
  employeeId?: string;
  /** Requests that overlap [from, to]. */
  from?: string;
  to?: string;
}

export const getRequests = async (filters: RequestFilters = {}): Promise<LeaveRequestView[]> => {
  let query = supabase.from('leave_requests').select('*').order('created_at', { ascending: false });
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.leaveTypeId) query = query.eq('leave_type_id', filters.leaveTypeId);
  if (filters.employeeId) query = query.eq('employee_id', filters.employeeId);
  if (filters.from) query = query.gte('end_date', filters.from);
  if (filters.to) query = query.lte('start_date', filters.to);

  const [{ data, error }, types, directory] = await Promise.all([query, getLeaveTypes(true), getEmployeeDirectory()]);
  if (error) throw toError(error, 'Could not load the leave requests.');

  const typeName = new Map(types.map((t) => [t.id, t.name]));
  const people = new Map(directory.map((e) => [e.id, e]));
  return ((data ?? []) as LeaveRequest[]).map((r) => {
    const e = people.get(r.employee_id);
    return {
      ...r,
      employee_name: e ? `${e.firstName} ${e.lastName}` : 'Unknown employee',
      department: e?.department,
      leave_type_name: typeName.get(r.leave_type_id) ?? 'Leave',
    };
  });
};

export const getRequestsByIds = async (ids: string[]): Promise<LeaveRequestView[]> => {
  if (ids.length === 0) return [];
  const [{ data, error }, types, directory] = await Promise.all([
    supabase.from('leave_requests').select('*').in('id', ids), getLeaveTypes(true), getEmployeeDirectory(),
  ]);
  if (error) throw toError(error, 'Could not load the leave requests.');
  const typeName = new Map(types.map((t) => [t.id, t.name]));
  const people = new Map(directory.map((e) => [e.id, e]));
  return ((data ?? []) as LeaveRequest[]).map((r) => {
    const e = people.get(r.employee_id);
    return {
      ...r,
      employee_name: e ? `${e.firstName} ${e.lastName}` : 'Unknown employee',
      department: e?.department,
      leave_type_name: typeName.get(r.leave_type_id) ?? 'Leave',
    };
  });
};

/**
 * Approve or reject. Throws LeaveConflictError when attendance is already
 * recorded on some of the days; pass replaceAbsent = true to overwrite Absent
 * rows (the audit trail records each one).
 */
export const reviewRequest = async (
  id: string,
  decision: 'approved' | 'rejected',
  note?: string,
  replaceAbsent = false,
): Promise<LeaveRequest> => {
  const { data, error } = await supabase.rpc('review_leave_request', {
    p_id: id, p_decision: decision, p_note: note?.trim() || null, p_replace_absent: replaceAbsent,
  });
  if (error) {
    const conflicts = parseConflicts(error.details);
    if (conflicts.length > 0) {
      throw new LeaveConflictError(error.message, conflicts, error.hint === 'ONLY_ABSENT');
    }
    throw toError(error, 'Could not save the decision.');
  }
  return data as LeaveRequest;
};

export const cancelRequest = async (id: string, note?: string): Promise<LeaveRequest> => {
  const { data, error } = await supabase.rpc('cancel_leave_request', { p_id: id, p_note: note?.trim() || null });
  if (error) throw toError(error, 'Could not cancel the leave request.');
  return data as LeaveRequest;
};

// ── Balances ───────────────────────────────────────────────────────────────

export interface BalanceRow extends LeaveBalance {
  employee_name: string;
  department?: string;
  leave_type_name: string;
  remaining: number;
}

/** Balance rows for a year, optionally for one employee. */
export const getBalances = async (year: number, employeeId?: string): Promise<BalanceRow[]> => {
  let query = supabase.from('leave_balances').select('*').eq('year', year);
  if (employeeId) query = query.eq('employee_id', employeeId);
  const [{ data, error }, types, directory] = await Promise.all([query, getLeaveTypes(true), getEmployeeDirectory()]);
  if (error) throw toError(error, 'Could not load the leave balances.');

  const typeName = new Map(types.map((t) => [t.id, t.name]));
  const people = new Map(directory.map((e) => [e.id, e]));
  return ((data ?? []) as LeaveBalance[]).map((b) => {
    const e = people.get(b.employee_id);
    return {
      ...b,
      employee_name: e ? `${e.firstName} ${e.lastName}` : 'Unknown employee',
      department: e?.department,
      leave_type_name: typeName.get(b.leave_type_id) ?? 'Leave',
      remaining: balanceRemaining(b),
    };
  });
};

/**
 * One employee's position for every leave type that has a balance, including
 * types with no balance row yet (shown at the full entitlement, which is what
 * the database will create on the first request).
 */
export const getEmployeeBalances = async (employeeId: string, year: number) => {
  const [types, rows] = await Promise.all([getLeaveTypes(), getBalances(year, employeeId)]);
  const byType = new Map(rows.map((r) => [r.leave_type_id, r]));
  return types
    .filter((t) => t.tracks_balance)
    .map((t) => {
      const row = byType.get(t.id);
      const entitled = row?.entitled ?? t.days_per_year;
      const carried = row?.carried_forward ?? 0;
      const taken = row?.taken ?? 0;
      return { type: t, entitled, carried_forward: carried, taken, remaining: balanceRemaining({ entitled, carried_forward: carried, taken }) };
    });
};

/** Creates the year's balances for every active employee. Safe to repeat. Returns rows added. */
export const openLeaveYear = async (year: number): Promise<number> => {
  const { data, error } = await supabase.rpc('open_leave_year', { p_year: year });
  if (error) throw toError(error, 'Could not set up the leave year.');
  return (data as number) ?? 0;
};

export const adjustBalance = async (id: string, patch: { entitled?: number; carried_forward?: number }): Promise<void> => {
  const { data, error } = await supabase.from('leave_balances').update(patch).eq('id', id).select('id');
  if (error) throw toError(error, 'Could not change the balance.');
  if (!data?.length) throw new Error('The balance was not changed. You may not have permission.');
};

// ── Unpaid leave report (for payroll) ──────────────────────────────────────

export interface UnpaidLeaveRow {
  employee_id: string;
  employee_name: string;
  department?: string;
  /** Working days of unpaid leave inside the period. */
  days: number;
  requests: { id: string; leave_type_name: string; start_date: string; end_date: string; days_in_period: number }[];
}

/**
 * Approved unpaid leave inside a payroll period, per employee. Payroll is not
 * changed automatically: this is the list HR uses when running it.
 */
export const getUnpaidLeaveReport = async (periodStart: string, periodEnd: string): Promise<UnpaidLeaveRow[]> => {
  const [types, settings, holidays] = await Promise.all([getLeaveTypes(true), getLeaveSettings(), getPublicHolidays()]);
  const unpaidIds = types.filter((t) => !t.is_paid).map((t) => t.id);
  if (unpaidIds.length === 0) return [];

  const { data, error } = await supabase
    .from('leave_requests').select('*')
    .eq('status', 'approved').in('leave_type_id', unpaidIds)
    .lte('start_date', periodEnd).gte('end_date', periodStart);
  if (error) throw toError(error, 'Could not load the unpaid leave.');

  const directory = await getEmployeeDirectory();
  const people = new Map(directory.map((e) => [e.id, e]));
  const typeName = new Map(types.map((t) => [t.id, t.name]));
  const holidayDates = holidays.map((h) => h.holiday_date);

  const byEmployee = new Map<string, UnpaidLeaveRow>();
  for (const r of (data ?? []) as LeaveRequest[]) {
    const from = r.start_date > periodStart ? r.start_date : periodStart;
    const to = r.end_date < periodEnd ? r.end_date : periodEnd;
    const inPeriod = workingDatesBetween(from, to, holidayDates, settings.working_days).length;
    if (inPeriod === 0) continue;
    const e = people.get(r.employee_id);
    const row = byEmployee.get(r.employee_id) ?? {
      employee_id: r.employee_id,
      employee_name: e ? `${e.firstName} ${e.lastName}` : 'Unknown employee',
      department: e?.department,
      days: 0,
      requests: [],
    };
    row.days += inPeriod;
    row.requests.push({
      id: r.id, leave_type_name: typeName.get(r.leave_type_id) ?? 'Unpaid',
      start_date: r.start_date, end_date: r.end_date, days_in_period: inPeriod,
    });
    byEmployee.set(r.employee_id, row);
  }
  return [...byEmployee.values()].sort((a, b) => a.employee_name.localeCompare(b.employee_name));
};

// ── Attendance on the days of a request ────────────────────────────────────

export interface AttendanceDay { date: string; status: string; leave_request_id: string | null }

/** What attendance already says about an employee between two dates. */
export const getAttendanceForRange = async (employeeId: string, from: string, to: string): Promise<AttendanceDay[]> => {
  const { data, error } = await supabase
    .from('attendance').select('date, status, leave_request_id')
    .eq('employee_id', employeeId).gte('date', from).lte('date', to).order('date');
  if (error) throw toError(error, 'Could not check the attendance records.');
  return (data ?? []) as AttendanceDay[];
};
