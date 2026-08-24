'use client';

import { format, startOfMonth, endOfMonth, subMonths, startOfYear } from 'date-fns';

export interface DateRange {
  from: string;
  to: string;
}

const fmt = (d: Date) => format(d, 'yyyy-MM-dd');

export function defaultDateRange(): DateRange {
  const now = new Date();
  return { from: fmt(startOfMonth(now)), to: fmt(endOfMonth(now)) };
}

const PRESETS: { label: string; range: () => DateRange }[] = [
  { label: 'This month', range: () => defaultDateRange() },
  {
    label: 'Last month',
    range: () => {
      const last = subMonths(new Date(), 1);
      return { from: fmt(startOfMonth(last)), to: fmt(endOfMonth(last)) };
    },
  },
  { label: 'This year', range: () => ({ from: fmt(startOfYear(new Date())), to: fmt(new Date()) }) },
  { label: 'All time', range: () => ({ from: '2020-01-01', to: fmt(new Date()) }) },
];

export function DateRangeFilter({ value, onChange }: { value: DateRange; onChange: (range: DateRange) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="date"
        value={value.from}
        onChange={(e) => onChange({ ...value, from: e.target.value })}
        className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
      />
      <span className="text-muted-foreground text-sm">to</span>
      <input
        type="date"
        value={value.to}
        onChange={(e) => onChange({ ...value, to: e.target.value })}
        className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
      />
      <div className="flex gap-1 ml-2">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => onChange(p.range())}
            className="rounded-md border border-input px-2 py-1 text-xs hover:bg-muted"
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
