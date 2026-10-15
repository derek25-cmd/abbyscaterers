/**
 * CSV import of existing contracts and of leave taken before go-live.
 *
 * The browser parses and checks each row so HR sees a preview with a reason
 * for every rejected row. Only valid rows are sent, in one call per file; the
 * database checks them all again and imports all or nothing
 * (import_legacy_contracts / import_opening_leave, migration 20261014002000).
 */

export const MAX_IMPORT_ROWS = 500;

export const CONTRACT_COLUMNS = ['employee_id', 'contract_type', 'start_date', 'end_date', 'position', 'salary', 'notice_days'] as const;
export const OPENING_COLUMNS = ['employee_id', 'leave_type', 'year', 'taken_before_go_live'] as const;

export const CONTRACT_TEMPLATE_CSV =
  'employee_id,contract_type,start_date,end_date,position,salary,notice_days\n' +
  'EMP-001,fixed_term,2025-11-01,2026-10-31,Cook,800000,30\n' +
  'EMP-002,permanent,2023-03-01,,Head Chef,1200000,30\n';

export const openingTemplateCsv = (year: number) =>
  'employee_id,leave_type,year,taken_before_go_live\n' +
  `EMP-001,Annual,${year},6\n` +
  `EMP-001,Sick,${year},2\n`;

// ── CSV ────────────────────────────────────────────────────────────────────

/** RFC 4180-style: quoted fields, "" inside quotes, CRLF or LF, a leading BOM. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  // Drop blank lines (e.g. the one after the last newline).
  return rows.filter((r) => r.some((v) => v.trim() !== ''));
}

export interface ParsedFile<T extends string> {
  rows: Record<T, string>[];
  /** A problem with the file as a whole (wrong columns, too many rows); null if fine. */
  error: string | null;
}

/** Header row must contain every expected column (any order, case-insensitive); extra columns are ignored. */
export function readTable<T extends string>(text: string, columns: readonly T[]): ParsedFile<T> {
  const table = parseCsv(text);
  if (table.length === 0) return { rows: [], error: 'The file is empty.' };
  const header = table[0].map((h) => h.trim().toLowerCase());
  const missing = columns.filter((c) => !header.includes(c));
  if (missing.length) return { rows: [], error: `Missing column(s): ${missing.join(', ')}. Download the template to see the layout.` };
  const body = table.slice(1);
  if (body.length === 0) return { rows: [], error: 'The file has a header but no rows.' };
  if (body.length > MAX_IMPORT_ROWS) {
    return { rows: [], error: `At most ${MAX_IMPORT_ROWS} rows per file (this one has ${body.length}). Split it into smaller files.` };
  }
  const rows = body.map((r) => Object.fromEntries(columns.map((c) => [c, (r[header.indexOf(c)] ?? '').trim()])) as Record<T, string>);
  return { rows, error: null };
}

// ── Checks ─────────────────────────────────────────────────────────────────

export interface CheckedRow<T extends string> {
  line: number; // line in the file (header = 1)
  values: Record<T, string>;
  errors: string[];
  /** What importing the row will do, when valid. */
  note?: string;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const isDate = (s: string) => ISO.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s);
const num = (s: string) => (s === '' ? null : Number(s.replace(/,/g, '')));

export interface ContractCheckContext {
  /** id → status, for every employee. */
  employees: Map<string, { status: string; name: string }>;
  /** Employees who already have an active contract. */
  withActiveContract: Set<string>;
  /** yyyy-mm-dd, in Dar es Salaam. */
  today: string;
}

const CONTRACT_TYPES = ['permanent', 'fixed_term', 'probation', 'casual'];

export function checkContractRows(rows: Record<(typeof CONTRACT_COLUMNS)[number], string>[], ctx: ContractCheckContext) {
  const activeInFile = new Set<string>();
  return rows.map((v, i): CheckedRow<(typeof CONTRACT_COLUMNS)[number]> => {
    const errors: string[] = [];
    const emp = ctx.employees.get(v.employee_id);
    const type = v.contract_type.toLowerCase();
    if (!v.employee_id) errors.push('No employee id.');
    else if (!emp) errors.push(`Unknown employee "${v.employee_id}".`);
    else if (emp.status !== 'Active') errors.push(`${emp.name} has left and their record is closed. Reactivate them first.`);
    if (!CONTRACT_TYPES.includes(type)) errors.push('Contract type must be permanent, fixed_term, probation or casual.');
    if (!isDate(v.start_date)) errors.push('Start date must be a real date written yyyy-mm-dd.');
    if (v.end_date && !isDate(v.end_date)) errors.push('End date must be a real date written yyyy-mm-dd.');
    if (!v.end_date && type !== 'permanent' && CONTRACT_TYPES.includes(type)) errors.push('End date is missing (only a permanent contract has none).');
    if (isDate(v.start_date) && isDate(v.end_date) && v.end_date < v.start_date) errors.push('End date is before the start date.');
    if (!v.position) errors.push('Position is missing.');
    const salary = num(v.salary);
    if (salary !== null && (!Number.isFinite(salary) || salary < 0)) errors.push('Salary must be a number, 0 or more.');
    const notice = num(v.notice_days);
    if (notice !== null && (!Number.isInteger(notice) || notice < 0)) errors.push('Notice days must be a whole number, 0 or more.');

    const active = !(v.end_date && isDate(v.end_date) && v.end_date < ctx.today);
    if (emp && active && errors.length === 0) {
      if (ctx.withActiveContract.has(v.employee_id)) errors.push(`${emp.name} already has an active contract.`);
      else if (activeInFile.has(v.employee_id)) errors.push(`A second current contract for ${emp.name} in this file.`);
      else activeInFile.add(v.employee_id);
    }
    return {
      line: i + 2, values: v, errors,
      note: errors.length ? undefined : active ? 'Current contract (reminders will cover it)' : 'Past contract (recorded as expired)',
    };
  });
}

export interface OpeningCheckContext {
  employees: Map<string, { status: string; name: string }>;
  /** lower-case name → type. */
  leaveTypes: Map<string, { id: string; name: string; tracksBalance: boolean }>;
  /** The only year allowed (the go-live year). */
  goLiveYear: number;
  /** "employee_id/leave_type_id" → entitled + carried - taken (system), for the go-live year, where a balance exists. */
  available?: Map<string, number>;
}

export function checkOpeningRows(rows: Record<(typeof OPENING_COLUMNS)[number], string>[], ctx: OpeningCheckContext) {
  const seen = new Set<string>();
  return rows.map((v, i): CheckedRow<(typeof OPENING_COLUMNS)[number]> => {
    const errors: string[] = [];
    const emp = ctx.employees.get(v.employee_id);
    const type = ctx.leaveTypes.get(v.leave_type.toLowerCase());
    if (!v.employee_id) errors.push('No employee id.');
    else if (!emp) errors.push(`Unknown employee "${v.employee_id}".`);
    else if (emp.status !== 'Active') errors.push(`${emp.name} has left and their record is closed. Reactivate them first.`);
    if (!type) errors.push(`Unknown leave type "${v.leave_type}".`);
    else if (!type.tracksBalance) errors.push(`${type.name} leave has no balance.`);
    if (String(ctx.goLiveYear) !== v.year) errors.push(`Year must be ${ctx.goLiveYear} (the go-live year).`);
    const days = num(v.taken_before_go_live);
    if (days === null || !Number.isFinite(days) || days < 0 || days * 2 !== Math.round(days * 2)) {
      errors.push('Days taken must be 0 or more, in whole or half days.');
    }
    if (emp && type) {
      const key = `${v.employee_id}/${type.id}`;
      if (seen.has(key)) errors.push('The same employee and leave type appear twice in this file.');
      seen.add(key);
      const left = ctx.available?.get(key);
      if (left !== undefined && days !== null && days > left) errors.push(`${days} days is more than the ${left} ${type.name} days ${emp.name} has.`);
    }
    return { line: i + 2, values: v, errors, note: errors.length ? undefined : `${days} day(s) taken before go-live` };
  });
}
