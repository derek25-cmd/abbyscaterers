import { describe, it, expect } from 'vitest';
import {
  DEFAULT_WORKING_WEEK, balanceRemaining, countWorkingDays, formatDays, leaveYearOf, leaveYearRange,
  validateLeaveRange, workingDatesBetween,
} from '../leave';

// 2026-03-02 is a Monday.
describe('countWorkingDays (Mon-Sat default)', () => {
  it('counts a single working day', () => {
    expect(countWorkingDays('2026-03-02', '2026-03-02')).toBe(1);
  });

  it('counts a same-day request on a Sunday as zero', () => {
    expect(countWorkingDays('2026-03-08', '2026-03-08')).toBe(0);
  });

  it('skips Sundays across a week: Mon-Sun = 6', () => {
    expect(countWorkingDays('2026-03-02', '2026-03-08')).toBe(6);
  });

  it('spans two weekends: Mon 2 Mar - Mon 16 Mar = 13', () => {
    expect(countWorkingDays('2026-03-02', '2026-03-16')).toBe(13);
  });

  it('skips public holidays that fall on a working day', () => {
    expect(countWorkingDays('2026-04-27', '2026-05-02', ['2026-05-01'])).toBe(5);
  });

  it('does not double-skip a holiday that falls on a Sunday', () => {
    // Sunday 26 Apr 2026 is Union Day: already off, so Mon-Sat of that week is still 6.
    expect(countWorkingDays('2026-04-20', '2026-04-26', ['2026-04-26'])).toBe(6);
  });

  it('respects a Mon-Fri working week', () => {
    expect(countWorkingDays('2026-03-02', '2026-03-08', [], [1, 2, 3, 4, 5])).toBe(5);
  });

  it('lists the exact dates counted', () => {
    expect(workingDatesBetween('2026-03-06', '2026-03-09')).toEqual(['2026-03-06', '2026-03-07', '2026-03-09']);
  });

  it('crosses a year boundary without error: 29 Dec - 3 Jan', () => {
    expect(countWorkingDays('2026-12-29', '2027-01-03', ['2027-01-01'])).toBe(4);
  });

  it('counts a leap day', () => {
    expect(countWorkingDays('2028-02-28', '2028-03-01')).toBe(3);
  });

  it('returns 0 for an end before the start or an invalid date', () => {
    expect(countWorkingDays('2026-03-10', '2026-03-02')).toBe(0);
    expect(countWorkingDays('2026-02-30', '2026-03-02')).toBe(0);
    expect(countWorkingDays('not-a-date', '2026-03-02')).toBe(0);
  });

  it('defaults to Monday-Saturday', () => {
    expect([...DEFAULT_WORKING_WEEK]).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe('leaveYearOf', () => {
  it('is the calendar year', () => {
    expect(leaveYearOf('2026-01-01')).toBe(2026);
    expect(leaveYearOf('2026-12-31')).toBe(2026);
    expect(leaveYearOf('2027-01-01')).toBe(2027);
  });

  it('rejects an invalid date', () => {
    expect(() => leaveYearOf('2026-13-01')).toThrow();
  });

  it('gives the year range', () => {
    expect(leaveYearRange(2026)).toEqual({ start: '2026-01-01', end: '2026-12-31' });
  });
});

describe('validateLeaveRange', () => {
  it('accepts a normal range', () => {
    expect(validateLeaveRange('2026-03-02', '2026-03-06')).toBeNull();
  });

  it('asks for both dates', () => {
    expect(validateLeaveRange('', '2026-03-06')).toMatch(/first and last day/i);
  });

  it('refuses an end before the start', () => {
    expect(validateLeaveRange('2026-03-06', '2026-03-02')).toMatch(/cannot be before/i);
  });

  it('refuses a request across two leave years', () => {
    expect(validateLeaveRange('2026-12-29', '2027-01-05')).toMatch(/two leave years/i);
  });

  it('refuses a range with no working days', () => {
    expect(validateLeaveRange('2026-03-08', '2026-03-08')).toMatch(/no working days/i);
  });
});

describe('balances and wording', () => {
  it('computes the remaining balance', () => {
    expect(balanceRemaining({ entitled: 28, carried_forward: 2, taken: 10 })).toBe(20);
  });

  it('formats days', () => {
    expect(formatDays(1)).toBe('1 day');
    expect(formatDays(5)).toBe('5 days');
    expect(formatDays(2.5)).toBe('2.5 days');
    expect(formatDays(0)).toBe('0 days');
  });
});
