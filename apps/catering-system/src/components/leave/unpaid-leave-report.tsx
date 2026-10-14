'use client';

import { useState } from 'react';
import { endOfMonth, format, startOfMonth } from 'date-fns';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { formatDays } from '@/lib/leave';
import { getUnpaidLeaveReport, type UnpaidLeaveRow } from '@/services/leaveService';

/**
 * Approved unpaid leave per employee for a pay period. Payroll is not changed
 * automatically: this is the list HR checks when running it.
 */
export function UnpaidLeaveReport({ refreshKey }: { refreshKey: number }) {
  const { toast } = useToast();
  const [start, setStart] = useState(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [end, setEnd] = useState(() => format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [rows, setRows] = useState<UnpaidLeaveRow[] | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    if (!start || !end || end < start) {
      toast({ variant: 'destructive', title: 'Check the period', description: 'Choose a start date and an end date that is not before it.' });
      return;
    }
    setLoading(true);
    try {
      setRows(await getUnpaidLeaveReport(start, end));
    } catch (err) {
      setRows(null);
      toast({ variant: 'destructive', title: 'Could not build the report', description: err instanceof Error ? err.message : undefined });
    } finally {
      setLoading(false);
    }
  };

  const total = (rows ?? []).reduce((sum, r) => sum + r.days, 0);

  const download = () => {
    if (!rows) return;
    const csv = [
      ['Employee', 'Department', 'Unpaid days in period', 'Leave dates'],
      ...rows.map((r) => [r.employee_name, r.department ?? '', String(r.days), r.requests.map((q) => `${q.start_date} to ${q.end_date}`).join('; ')]),
    ].map((line) => line.map((v) => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `unpaid-leave_${start}_to_${end}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4" data-refresh={refreshKey}>
      <p className="text-sm text-muted-foreground">
        Use this when you run payroll. It lists the working days of approved <strong>unpaid leave</strong> inside the pay period.
        Payroll is <strong>not</strong> changed automatically, so deduct these days yourself.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1"><Label htmlFor="up-start">Pay period starts</Label><Input id="up-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor="up-end">Pay period ends</Label><Input id="up-end" type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} /></div>
        <Button onClick={run} disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Show report</Button>
        {rows && rows.length > 0 && <Button variant="outline" onClick={download}><Download className="mr-2 h-4 w-4" />Download CSV</Button>}
      </div>

      {rows && (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Employee</TableHead><TableHead>Leave dates</TableHead><TableHead className="text-right">Unpaid days in period</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.employee_id}>
                  <TableCell className="font-medium">{r.employee_name}{r.department && <span className="block text-xs font-normal text-muted-foreground">{r.department}</span>}</TableCell>
                  <TableCell>{r.requests.map((q) => <span key={q.id} className="block">{q.start_date} → {q.end_date} ({formatDays(q.days_in_period)} in period)</span>)}</TableCell>
                  <TableCell className="text-right font-semibold">{formatDays(r.days)}</TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && <TableRow><TableCell colSpan={3} className="py-8 text-center text-muted-foreground">No unpaid leave in this period. Nothing to deduct.</TableCell></TableRow>}
            </TableBody>
            {rows.length > 0 && <TableFooter><TableRow><TableCell colSpan={2}>Total</TableCell><TableCell className="text-right">{formatDays(total)}</TableCell></TableRow></TableFooter>}
          </Table>
        </div>
      )}
    </div>
  );
}
