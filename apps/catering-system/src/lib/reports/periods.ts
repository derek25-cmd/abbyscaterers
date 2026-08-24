import {
  startOfMonth, endOfMonth, startOfQuarter, endOfQuarter,
  startOfYear, endOfYear, subMonths, subQuarters, subYears, format, parseISO,
} from 'date-fns';

export type PeriodType = 'monthly' | 'quarterly' | 'semi_annual' | 'annual';

export const PERIOD_TYPE_LABELS: Record<PeriodType, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  semi_annual: 'Semi-Annual',
  annual: 'Annual',
};

export interface PeriodRange {
  from: Date;
  to: Date;
  prevFrom: Date;
  prevTo: Date;
  label: string;
}

function startOfHalf(d: Date): Date {
  const half = d.getMonth() < 6 ? 0 : 6;
  return new Date(d.getFullYear(), half, 1);
}
function endOfHalf(d: Date): Date {
  const start = startOfHalf(d);
  return endOfMonth(new Date(start.getFullYear(), start.getMonth() + 5, 1));
}

/** Resolves a period type + any reference date into a concrete date range,
 * plus the equivalent immediately-preceding period for trend comparisons. */
export function getPeriodRange(type: PeriodType, referenceDate: Date): PeriodRange {
  switch (type) {
    case 'monthly': {
      const from = startOfMonth(referenceDate);
      const to = endOfMonth(referenceDate);
      const prevRef = subMonths(referenceDate, 1);
      return { from, to, prevFrom: startOfMonth(prevRef), prevTo: endOfMonth(prevRef), label: format(from, 'MMMM yyyy') };
    }
    case 'quarterly': {
      const from = startOfQuarter(referenceDate);
      const to = endOfQuarter(referenceDate);
      const prevRef = subQuarters(referenceDate, 1);
      const q = Math.floor(from.getMonth() / 3) + 1;
      return { from, to, prevFrom: startOfQuarter(prevRef), prevTo: endOfQuarter(prevRef), label: `Q${q} ${from.getFullYear()}` };
    }
    case 'semi_annual': {
      const from = startOfHalf(referenceDate);
      const to = endOfHalf(referenceDate);
      const prevRef = new Date(from.getFullYear(), from.getMonth() - 6, 1);
      const half = from.getMonth() === 0 ? 'H1' : 'H2';
      return { from, to, prevFrom: startOfHalf(prevRef), prevTo: endOfHalf(prevRef), label: `${half} ${from.getFullYear()}` };
    }
    case 'annual': {
      const from = startOfYear(referenceDate);
      const to = endOfYear(referenceDate);
      const prevRef = subYears(referenceDate, 1);
      return { from, to, prevFrom: startOfYear(prevRef), prevTo: endOfYear(prevRef), label: `${from.getFullYear()}` };
    }
  }
}

/** Same date-window inclusion check used by src/app/(finances)/finances/reports/page.tsx,
 * generalized for arbitrary from/to bounds. */
export function inPeriod(dateStr: string | null | undefined, from: Date, to: Date): boolean {
  if (!dateStr) return false;
  try {
    const d = parseISO(dateStr.slice(0, 10));
    return d >= from && d <= to;
  } catch {
    return false;
  }
}

export function pctDelta(current: number, previous: number): number | undefined {
  if (previous === 0) return current === 0 ? 0 : undefined;
  return ((current - previous) / Math.abs(previous)) * 100;
}

/** Builds the last N selectable reference dates for a period type, newest first —
 * drives the "which period" dropdown next to the period-type selector. */
export function recentReferenceDates(type: PeriodType, count = 12): { value: string; label: string }[] {
  const now = new Date();
  const out: { value: string; label: string }[] = [];
  for (let i = 0; i < count; i++) {
    let ref: Date;
    switch (type) {
      case 'monthly': ref = subMonths(now, i); break;
      case 'quarterly': ref = subQuarters(now, i); break;
      case 'semi_annual': ref = new Date(now.getFullYear(), now.getMonth() - i * 6, 1); break;
      case 'annual': ref = subYears(now, i); break;
    }
    const { from, label } = getPeriodRange(type, ref);
    out.push({ value: from.toISOString(), label });
  }
  return out;
}
