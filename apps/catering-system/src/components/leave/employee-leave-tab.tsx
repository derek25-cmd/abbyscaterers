'use client';

import { useCallback, useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { CalendarPlus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ApplyLeaveDialog } from '@/components/hr/apply-leave-dialog';
import { ReviewLeaveDialog } from '@/components/hr/review-leave-dialog';
import { LeaveStatusBadge } from '@/components/leave/leave-status-badge';
import { formatDays } from '@/lib/leave';
import { getEmployeeBalances, getRequests } from '@/services/leaveService';
import type { LeaveRequestView } from '@/types';

type BalanceCard = Awaited<ReturnType<typeof getEmployeeBalances>>[number];

/** One employee's leave: balances for the year and every request they have made. */
export function EmployeeLeaveTab({ employeeId, employeeName }: { employeeId: string; employeeName: string }) {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [balances, setBalances] = useState<BalanceCard[] | null>(null);
  const [requests, setRequests] = useState<LeaveRequestView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applyOpen, setApplyOpen] = useState(false);
  const [selected, setSelected] = useState<LeaveRequestView | null>(null);

  const load = useCallback(() => {
    setError(null);
    Promise.all([getEmployeeBalances(employeeId, year), getRequests({ employeeId })])
      .then(([b, r]) => { setBalances(b); setRequests(r); })
      .catch((err) => { setBalances([]); setRequests([]); setError(err instanceof Error ? err.message : 'Could not load the leave.'); });
  }, [employeeId, year]);

  useEffect(() => { setBalances(null); setRequests(null); load(); }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-28" aria-label="Year"><SelectValue /></SelectTrigger>
          <SelectContent>{[thisYear - 1, thisYear, thisYear + 1].map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
        </Select>
        <Button size="sm" onClick={() => setApplyOpen(true)}><CalendarPlus className="mr-2 h-4 w-4" />Apply for leave</Button>
      </div>

      {error && <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">{error}</p>}

      <section aria-label="Leave balances">
        <h3 className="mb-2 text-lg font-medium text-primary">Balances for {year}</h3>
        {balances === null ? <Loader2 className="h-5 w-5 animate-spin" /> : (
          <div className="grid gap-3 sm:grid-cols-2">
            {balances.map((b) => {
              const total = b.entitled + b.carried_forward;
              return (
                <div key={b.type.id} className="rounded-md border p-3">
                  <div className="flex items-baseline justify-between">
                    <span className="font-medium">{b.type.name}</span>
                    <span className="text-sm text-muted-foreground">{formatDays(b.taken + b.opening_taken)} taken{b.opening_taken > 0 ? ` (${formatDays(b.opening_taken)} before go-live)` : ''}</span>
                  </div>
                  <p className="mt-1"><span className="text-2xl font-bold">{b.remaining}</span> <span className="text-sm text-muted-foreground">of {total} days left</span></p>
                  <Progress value={total > 0 ? Math.min(100, ((b.taken + b.opening_taken) / total) * 100) : 0} className="mt-2 h-1.5" />
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section aria-label="Leave history">
        <h3 className="mb-2 text-lg font-medium text-primary">History</h3>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Dates</TableHead><TableHead className="text-right">Days</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {requests === null && <TableRow><TableCell colSpan={4} className="py-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></TableCell></TableRow>}
              {requests?.map((r) => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => setSelected(r)}>
                  <TableCell>{r.leave_type_name}</TableCell>
                  <TableCell className="whitespace-nowrap">{format(parseISO(r.start_date), 'd MMM')} → {format(parseISO(r.end_date), 'd MMM yyyy')}</TableCell>
                  <TableCell className="text-right">{formatDays(r.days)}</TableCell>
                  <TableCell><LeaveStatusBadge status={r.status} /></TableCell>
                </TableRow>
              ))}
              {requests && requests.length === 0 && <TableRow><TableCell colSpan={4} className="py-6 text-center text-muted-foreground">{employeeName} has no leave requests yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </section>

      <ApplyLeaveDialog isOpen={applyOpen} setIsOpen={setApplyOpen} defaultEmployeeId={employeeId} onSubmitted={load} />
      <ReviewLeaveDialog request={selected} isOpen={!!selected} setIsOpen={(o) => !o && setSelected(null)} onChanged={load} />
    </div>
  );
}
