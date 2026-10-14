/**
 * Leave rules shared by the apply dialog, the review dialog, the calendar and
 * the attendance grid. The database enforces the same rules (see
 * supabase/migrations/20261014000600_leave_management.sql: leave_year_of(),
 * leave_working_dates(), and the leave_settings row); the client copy exists so
 * people see the day count and any problem BEFORE they submit.
 *
 * Dates are 'yyyy-MM-dd' strings throughout and are handled as UTC calendar
 * days, so the user's time zone can never move a date by one.
 */

// ── The two settings HR may still change ───────────────────────────────────

/**
 * Leave year = calendar year (1 January - 31 December) for now. If this moves
 * to a per-employee leave cycle, leaveYearOf() and leaveYearRange() are the
 * only client functions to change (twin: leave_year_of() in SQL).
 */
export const LEAVE_YEAR_START = { month: 1, day: 1 } as const;

/**
 * Working week as ISO weekday numbers (1 = Monday ... 7 = Sunday): Monday to
 * Saturday. Used as the default; the live value is the leave_settings row,
 * editable by HR on the Leave page. To make the default Mon-Fri, change this.
 */
export const DEFAULT_WORKING_WEEK: readonly number[] = [1, 2, 3, 4, 5, 6];

// ── Date helpers ───────────────────────────────────────────────────────────

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(value: string): Date | null {
  if (!ISO_DATE.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value ? null : d;
}

const toIso = (d: Date) => d.toISOString().slice(0, 10);

/** 1 = Monday ... 7 = Sunday. */
function isoWeekday(d: Date): number {
  const js = d.getUTCDay(); // 0 = Sunday
  return js === 0 ? 7 : js;
}

export function leaveYearOf(date: string): number {
  const d = parseDate(date);
  if (!d) throw new Error(`Invalid date: ${date}`);
  // Calendar year. With a different LEAVE_YEAR_START, shift by it here.
  return d.getUTCFullYear();
}

export function leaveYearRange(year: number): { start: string; end: string } {
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}

// ── Working days ───────────────────────────────────────────────────────────

/** Every counted leave day in [start, end], in order. Empty if the range is invalid. */
export function workingDatesBetween(
  start: string,
  end: string,
  holidays: readonly string[] = [],
  workingWeek: readonly number[] = DEFAULT_WORKING_WEEK,
): string[] {
  const from = parseDate(start);
  const to = parseDate(end);
  if (!from || !to || to < from) return [];

  const off = new Set(holidays);
  const week = new Set(workingWeek);
  const days: string[] = [];
  for (let d = from; d <= to; d = new Date(d.getTime() + 86_400_000)) {
    const iso = toIso(d);
    if (week.has(isoWeekday(d)) && !off.has(iso)) days.push(iso);
  }
  return days;
}

export function countWorkingDays(
  start: string,
  end: string,
  holidays: readonly string[] = [],
  workingWeek: readonly number[] = DEFAULT_WORKING_WEEK,
): number {
  return workingDatesBetween(start, end, holidays, workingWeek).length;
}

/**
 * A plain-language reason a date range cannot be submitted, or null if it is
 * fine. Mirrors the checks in the database trigger.
 */
export function validateLeaveRange(
  start: string,
  end: string,
  holidays: readonly string[] = [],
  workingWeek: readonly number[] = DEFAULT_WORKING_WEEK,
): string | null {
  if (!start || !end) return 'Choose the first and last day of leave.';
  if (!parseDate(start) || !parseDate(end)) return 'One of the dates is not valid.';
  if (end < start) return 'The last day cannot be before the first day.';
  if (leaveYearOf(start) !== leaveYearOf(end)) {
    return 'A request cannot run across two leave years. Make one request up to 31 December and another from 1 January.';
  }
  if (countWorkingDays(start, end, holidays, workingWeek) === 0) {
    return 'These dates have no working days (only non-working days or public holidays). Choose different dates.';
  }
  return null;
}

// ── Balances and wording ───────────────────────────────────────────────────

export interface BalanceFigures {
  entitled: number;
  carried_forward: number;
  taken: number;
  /** Leave taken before go-live (imported opening balance; Phase 5). */
  opening_taken?: number;
}

/** Same formula as the database: entitled + carried - opening_taken - taken. */
export function balanceRemaining(b: BalanceFigures): number {
  return b.entitled + b.carried_forward - (b.opening_taken ?? 0) - b.taken;
}

/** Everything taken this year: before go-live plus through the system. */
export const totalTaken = (b: BalanceFigures): number => (b.opening_taken ?? 0) + b.taken;

/** "1 day", "2 days", "2.5 days". */
export function formatDays(n: number): string {
  const text = Number.isInteger(n) ? String(n) : n.toFixed(1);
  return `${text} ${n === 1 ? 'day' : 'days'}`;
}

export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export const LEAVE_STATUS_LABEL: Record<LeaveStatus, string> = {
  pending: 'Waiting for approval',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};
