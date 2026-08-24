'use client';

import { format, startOfMonth, endOfMonth, subMonths, startOfYear } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

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
      <Input
        type="date"
        value={value.from}
        onChange={(e) => onChange({ ...value, from: e.target.value })}
        className="w-auto"
      />
      <span className="text-muted-foreground text-sm">to</span>
      <Input
        type="date"
        value={value.to}
        onChange={(e) => onChange({ ...value, to: e.target.value })}
        className="w-auto"
      />
      <div className="flex gap-1 ml-2">
        {PRESETS.map((p) => (
          <Button key={p.label} type="button" variant="outline" size="sm" onClick={() => onChange(p.range())}>
            {p.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
