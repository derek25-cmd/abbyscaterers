import type { ReportKpi } from './types';
import { pctDelta } from './periods';

export const sum = <T,>(rows: T[], pick: (r: T) => number): number => rows.reduce((s, r) => s + (pick(r) || 0), 0);

export function groupSum<T>(rows: T[], key: (r: T) => string, pick: (r: T) => number): { name: string; value: number }[] {
  const map = new Map<string, number>();
  rows.forEach((r) => {
    const k = key(r) || 'Uncategorised';
    map.set(k, (map.get(k) || 0) + (pick(r) || 0));
  });
  return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

export function groupCount<T>(rows: T[], key: (r: T) => string): { name: string; value: number }[] {
  const map = new Map<string, number>();
  rows.forEach((r) => {
    const k = key(r) || 'Uncategorised';
    map.set(k, (map.get(k) || 0) + 1);
  });
  return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

export function kpi(label: string, value: number, format: ReportKpi['format'], previous?: number): ReportKpi {
  return { label, value, format, deltaPct: previous !== undefined ? pctDelta(value, previous) : undefined };
}

/** Converts a groupSum/groupCount result into ReportTable row tuples. */
export const toRows = (g: { name: string; value: number }[]): (string | number)[][] => g.map((x) => [x.name, x.value]);
