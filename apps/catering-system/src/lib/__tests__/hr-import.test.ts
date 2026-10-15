import { describe, it, expect } from 'vitest';
import {
  CONTRACT_COLUMNS, CONTRACT_TEMPLATE_CSV, MAX_IMPORT_ROWS, OPENING_COLUMNS, checkContractRows, checkOpeningRows,
  openingTemplateCsv, parseCsv, readTable,
} from '../hr-import';

describe('parseCsv', () => {
  it('reads plain rows, CRLF and a BOM', () => {
    expect(parseCsv('﻿a,b\r\n1,2\r\n')).toEqual([['a', 'b'], ['1', '2']]);
  });
  it('handles quotes, commas and "" inside quotes', () => {
    expect(parseCsv('name,note\n"Juma, Amina","said ""hi"""\n')).toEqual([['name', 'note'], ['Juma, Amina', 'said "hi"']]);
  });
  it('keeps empty fields and skips blank lines', () => {
    expect(parseCsv('a,b,c\n1,,3\n\n,,\n')).toEqual([['a', 'b', 'c'], ['1', '', '3']]);
  });
});

describe('readTable', () => {
  it('needs every column, in any order and case', () => {
    const t = readTable('LEAVE_TYPE,employee_id,year,taken_before_go_live\nAnnual,E1,2026,3', OPENING_COLUMNS);
    expect(t.error).toBeNull();
    expect(t.rows).toEqual([{ employee_id: 'E1', leave_type: 'Annual', year: '2026', taken_before_go_live: '3' }]);
    expect(readTable('employee_id,year\nE1,2026', OPENING_COLUMNS).error).toMatch(/Missing column\(s\): leave_type, taken_before_go_live/);
  });
  it('refuses an empty file and more than 500 rows', () => {
    expect(readTable('', OPENING_COLUMNS).error).toMatch(/empty/);
    expect(readTable('employee_id,leave_type,year,taken_before_go_live\n', OPENING_COLUMNS).error).toMatch(/no rows/);
    const big = 'employee_id,leave_type,year,taken_before_go_live\n' + 'E1,Annual,2026,1\n'.repeat(MAX_IMPORT_ROWS + 1);
    expect(readTable(big, OPENING_COLUMNS).error).toMatch(/At most 500 rows/);
  });
  it('the downloadable templates read back cleanly', () => {
    expect(readTable(CONTRACT_TEMPLATE_CSV, CONTRACT_COLUMNS).rows).toHaveLength(2);
    expect(readTable(openingTemplateCsv(2026), OPENING_COLUMNS).rows).toHaveLength(2);
  });
});

const employees = new Map([
  ['E1', { status: 'Active', name: 'Amina Juma' }],
  ['E2', { status: 'Active', name: 'Baraka Mushi' }],
  ['E3', { status: 'Inactive', name: 'Chausiku Ally' }],
]);

describe('checkContractRows', () => {
  const ctx = { employees, withActiveContract: new Set(['E2']), today: '2026-10-14' };
  const row = (o: Partial<Record<(typeof CONTRACT_COLUMNS)[number], string>>) => ({
    employee_id: 'E1', contract_type: 'fixed_term', start_date: '2026-01-01', end_date: '2026-12-31', position: 'Cook', salary: '800000', notice_days: '30', ...o,
  });
  const errs = (o: Parameters<typeof row>[0], c = ctx) => checkContractRows([row(o)], c)[0].errors;

  it('a good current contract passes, with its line number and what it will do', () => {
    const [r] = checkContractRows([row({})], ctx);
    expect(r).toMatchObject({ line: 2, errors: [], note: 'Current contract (reminders will cover it)' });
  });
  it('a contract that has ended is a past contract', () => {
    expect(checkContractRows([row({ end_date: '2026-06-30' })], ctx)[0].note).toBe('Past contract (recorded as expired)');
  });
  it('unknown employee, bad type, bad dates', () => {
    expect(errs({ employee_id: 'NOPE' })).toEqual(['Unknown employee "NOPE".']);
    expect(errs({ contract_type: 'weekly' })[0]).toMatch(/Contract type/);
    expect(errs({ start_date: '2026-02-30' })[0]).toMatch(/Start date/);
    expect(errs({ start_date: '01/02/2026' })[0]).toMatch(/Start date/);
    expect(errs({ end_date: '2025-12-31' })).toEqual(['End date is before the start date.']);
  });
  it('missing end date only matters for non-permanent contracts', () => {
    expect(errs({ end_date: '' })).toEqual(['End date is missing (only a permanent contract has none).']);
    expect(errs({ end_date: '', contract_type: 'permanent' })).toEqual([]);
  });
  it('an employee who already has an active contract', () => {
    expect(errs({ employee_id: 'E2' })).toEqual(['Baraka Mushi already has an active contract.']);
    // ...but a past contract for them is fine
    expect(errs({ employee_id: 'E2', end_date: '2026-03-31' })).toEqual([]);
  });
  it('two current contracts for the same person in one file', () => {
    const rows = checkContractRows([row({}), row({ contract_type: 'permanent', end_date: '' })], ctx);
    expect(rows[0].errors).toEqual([]);
    expect(rows[1].errors).toEqual(['A second current contract for Amina Juma in this file.']);
  });
  it('nothing can be recorded for someone who has left (their record is closed)', () => {
    expect(errs({ employee_id: 'E3' })).toEqual(['Chausiku Ally has left and their record is closed. Reactivate them first.']);
    expect(errs({ employee_id: 'E3', end_date: '2026-05-31' })).toEqual(['Chausiku Ally has left and their record is closed. Reactivate them first.']);
  });
  it('numbers: salary with commas is fine, negatives are not', () => {
    expect(errs({ salary: '1,200,000' })).toEqual([]);
    expect(errs({ salary: '-5' })[0]).toMatch(/Salary/);
    expect(errs({ notice_days: '7.5' })[0]).toMatch(/Notice/);
  });
});

describe('checkOpeningRows', () => {
  const leaveTypes = new Map([
    ['annual', { id: 'T-A', name: 'Annual', tracksBalance: true }],
    ['unpaid', { id: 'T-U', name: 'Unpaid', tracksBalance: false }],
  ]);
  const ctx = { employees, leaveTypes, goLiveYear: 2026, available: new Map([['E1/T-A', 10]]) };
  const row = (o: Partial<Record<(typeof OPENING_COLUMNS)[number], string>>) => ({
    employee_id: 'E1', leave_type: 'Annual', year: '2026', taken_before_go_live: '6', ...o,
  });
  const errs = (o: Parameters<typeof row>[0]) => checkOpeningRows([row(o)], ctx)[0].errors;

  it('a good row passes; leave type names ignore case', () => {
    expect(errs({})).toEqual([]);
    expect(errs({ leave_type: 'annual' })).toEqual([]);
  });
  it('only the go-live year', () => {
    expect(errs({ year: '2025' })).toEqual(['Year must be 2026 (the go-live year).']);
  });
  it('days: whole or half, not negative, not more than is left', () => {
    expect(errs({ taken_before_go_live: '2.5' })).toEqual([]);
    expect(errs({ taken_before_go_live: '2.3' })[0]).toMatch(/whole or half/);
    expect(errs({ taken_before_go_live: '-1' })[0]).toMatch(/whole or half/);
    expect(errs({ taken_before_go_live: '' })[0]).toMatch(/whole or half/);
    expect(errs({ taken_before_go_live: '11' })).toEqual(['11 days is more than the 10 Annual days Amina Juma has.']);
  });
  it('unknown employee or type, and a type without a balance', () => {
    expect(errs({ employee_id: 'X' })).toEqual(['Unknown employee "X".']);
    expect(errs({ leave_type: 'Holiday' })).toEqual(['Unknown leave type "Holiday".']);
    expect(errs({ leave_type: 'Unpaid' })).toEqual(['Unpaid leave has no balance.']);
  });
  it('nothing for someone who has left', () => {
    expect(errs({ employee_id: 'E3' })).toEqual(['Chausiku Ally has left and their record is closed. Reactivate them first.']);
  });

  it('the same employee and type twice', () => {
    const rows = checkOpeningRows([row({}), row({ taken_before_go_live: '1' })], ctx);
    expect(rows[1].errors).toEqual(['The same employee and leave type appear twice in this file.']);
  });
});
