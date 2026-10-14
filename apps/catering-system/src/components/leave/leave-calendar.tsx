'use client';

import { useEffect, useMemo, useState } from 'react';
import { addMonths, endOfMonth, format, startOfMonth } from 'date-fns';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { getRequests } from '@/services/leaveService';
import type { LeaveRequestView, PublicHoliday } from '@/types';

const ANY = '__any__';
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MAX_NAMES = 3;

interface LeaveCalendarProps {
  refreshKey: number;
  holidays: PublicHoliday[];
  onOpen: (request: LeaveRequestView) => void;
}

const iso = (d: Date) => format(d, 'yyyy-MM-dd');

/** A month at a glance: who is away on which day. Public holidays are shaded. */
export function LeaveCalendar({ refreshKey, holidays, onOpen }: LeaveCalendarProps) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [includePending, setIncludePending] = useState(false);
  const [department, setDepartment] = useState('');
  const [requests, setRequests] = useState<LeaveRequestView[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const first = startOfMonth(month);
  const last = endOfMonth(month);

  useEffect(() => {
    let active = true;
    setRequests(null);
    setError(null);
    getRequests({ from: iso(first), to: iso(last) })
      .then((rows) => { if (active) setRequests(rows.filter((r) => r.status === 'approved' || r.status === 'pending')); })
      .catch((err) => { if (active) { setRequests([]); setError(err instanceof Error ? err.message : 'Could not load the calendar.'); } });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, refreshKey]);

  const departments = useMemo(() => [...new Set((requests ?? []).map((r) => r.department).filter(Boolean) as string[])].sort(), [requests]);
  const holidayByDate = useMemo(() => new Map(holidays.map((h) => [h.holiday_date, h.name])), [holidays]);

  const visible = useMemo(
    () => (requests ?? []).filter((r) => (includePending || r.status === 'approved') && (!department || r.department === department)),
    [requests, includePending, department],
  );

  // Monday-first grid covering the month.
  const days = useMemo(() => {
    const lead = (first.getDay() + 6) % 7;
    const cells: (Date | null)[] = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(first.getFullYear(), first.getMonth(), d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [first, last]);

  const onDay = (date: string) => visible.filter((r) => r.start_date <= date && r.end_date >= date);
  const todayIso = iso(new Date());

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></Button>
          <h3 className="min-w-40 text-center text-lg font-semibold">{format(month, 'MMMM yyyy')}</h3>
          <Button variant="outline" size="icon" onClick={() => setMonth(addMonths(month, 1))} aria-label="Next month"><ChevronRight className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => setMonth(startOfMonth(new Date()))}>Today</Button>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {departments.length > 0 && (
            <Select value={department || ANY} onValueChange={(v) => setDepartment(v === ANY ? '' : v)}>
              <SelectTrigger className="w-44" aria-label="Department"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>All departments</SelectItem>
                {departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <div className="flex items-center gap-2">
            <Checkbox id="cal-pending" checked={includePending} onCheckedChange={(c) => setIncludePending(c === true)} />
            <Label htmlFor="cal-pending" className="cursor-pointer">Also show requests waiting for approval</Label>
          </div>
        </div>
      </div>

      {error && <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">{error}</p>}

      <div className="relative overflow-x-auto">
        {requests === null && <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60"><Loader2 className="h-6 w-6 animate-spin" /></div>}
        <div className="grid min-w-[640px] grid-cols-7 gap-px rounded-md border bg-border">
          {WEEKDAYS.map((w) => <div key={w} className="bg-muted px-2 py-1.5 text-center text-xs font-semibold text-muted-foreground">{w}</div>)}
          {days.map((d, i) => {
            if (!d) return <div key={`blank-${i}`} className="min-h-24 bg-muted/30" />;
            const date = iso(d);
            const away = onDay(date);
            const holiday = holidayByDate.get(date);
            const sunday = d.getDay() === 0;
            return (
              <div key={date} className={cn('min-h-24 bg-background p-1.5', (holiday || sunday) && 'bg-muted/40', date === todayIso && 'ring-2 ring-inset ring-primary')}>
                <div className="flex items-start justify-between">
                  <span className={cn('text-xs font-semibold', date === todayIso && 'text-primary')}>{d.getDate()}</span>
                  {holiday && <span className="max-w-[80%] truncate text-[10px] text-amber-700" title={holiday}>{holiday}</span>}
                </div>
                <ul className="mt-1 space-y-0.5">
                  {away.slice(0, MAX_NAMES).map((r) => (
                    <li key={r.id}>
                      <button
                        type="button" onClick={() => onOpen(r)}
                        title={`${r.employee_name} — ${r.leave_type_name}${r.status === 'pending' ? ' (waiting for approval)' : ''}`}
                        className={cn('w-full truncate rounded px-1 py-0.5 text-left text-[11px]',
                          r.status === 'approved' ? 'bg-green-100 text-green-900 hover:bg-green-200' : 'border border-dashed border-amber-400 bg-amber-50 text-amber-900 hover:bg-amber-100')}
                      >
                        {r.employee_name}
                      </button>
                    </li>
                  ))}
                  {away.length > MAX_NAMES && (
                    <li className="px-1 text-[11px] text-muted-foreground" title={away.slice(MAX_NAMES).map((r) => r.employee_name).join(', ')}>
                      +{away.length - MAX_NAMES} more
                    </li>
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-green-200 align-middle" /> Approved leave
        {includePending && <><span className="ml-3 mr-1 inline-block h-2.5 w-2.5 rounded-sm border border-dashed border-amber-400 bg-amber-50 align-middle" /> Waiting for approval</>}
        <span className="ml-3 mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-muted align-middle" /> Sunday or public holiday. Click a name for the details.
        {requests && visible.length === 0 && <> No one is on leave in {format(month, 'MMMM')}.</>}
        {holidays.length === 0 && <> No public holidays have been entered yet.</>}
      </p>
    </div>
  );
}
