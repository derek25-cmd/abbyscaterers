'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Gift, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { formatTZS } from '@/lib/formatCurrency';
import { RECOGNITION_CATEGORY_LABEL, formatShortDate } from '@/lib/hr-docs/types/shared';
import { markRewardPaid, pendingCashRewards, type PendingCashReward } from '@/services/hrRecordsService';
import type { Payroll } from '@/types';

const categoryLabel = (c: string) => (RECOGNITION_CATEGORY_LABEL as Record<string, string>)[c] ?? c;

/**
 * Cash rewards from issued recognition letters, waiting to be paid. This panel
 * only lists them; it does not add them to any payslip or change payroll
 * figures. Whoever pays one records which payslip it went out with.
 * HR and finance (payroll.manage); the database checks the same.
 */
export function PendingCashRewardsPanel({ payrolls }: { payrolls: Payroll[] }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<PendingCashReward[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [marking, setMarking] = useState<PendingCashReward | null>(null);
  const [payrollId, setPayrollId] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    pendingCashRewards()
      .then((r) => { setRows(r); setError(null); })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load the pending rewards.'));
  }, []);
  useEffect(load, [load]);

  // The chosen employee's payslips, newest first.
  const payslips = useMemo(() => !marking ? [] : payrolls
    .filter((p) => p.employeeId === marking.employee_id)
    .sort((a, b) => (b.payPeriodEnd ?? '').localeCompare(a.payPeriodEnd ?? '')), [marking, payrolls]);

  const open = (r: PendingCashReward) => { setMarking(r); setPayrollId(''); };

  const save = async () => {
    if (!marking) return;
    setSaving(true);
    try {
      await markRewardPaid(marking.id, payrollId);
      toast({ title: 'Reward marked as paid', description: `${marking.employee_name}: ${formatTZS(marking.amount)} (payslip ${payrollId}).` });
      setMarking(null);
      load();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Could not mark as paid', description: err instanceof Error ? err.message : undefined });
    } finally { setSaving(false); }
  };

  if (rows && rows.length === 0 && !error) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Gift className="h-5 w-5" />Pending cash rewards</CardTitle>
        <CardDescription>
          From issued recognition letters. Not added to payslips automatically: include the amount when you pay, then record which payslip it went out with.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error ? (
          <p role="alert" className="text-sm text-destructive">{error}</p>
        ) : rows === null ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading…</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Awarded</TableHead>
                <TableHead>Category</TableHead>
                <TableHead><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.employee_name}</TableCell>
                  <TableCell className="text-right">{formatTZS(r.amount)}</TableCell>
                  <TableCell>{formatShortDate(r.awarded_on)}</TableCell>
                  <TableCell>{categoryLabel(r.category)}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => open(r)}>Mark paid in payroll…</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={!!marking} onOpenChange={(o) => !saving && !o && setMarking(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mark reward as paid</DialogTitle>
            <DialogDescription>
              {marking && <>{marking.employee_name}: {formatTZS(marking.amount)}. Choose the payslip it was paid with. The payslip itself is not changed.</>}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Payslip</Label>
            {payslips.length === 0 ? (
              <p className="text-sm text-muted-foreground">This employee has no payslips yet. Generate or run payroll first.</p>
            ) : (
              <Select value={payrollId} onValueChange={setPayrollId}>
                <SelectTrigger><SelectValue placeholder="Choose a payslip" /></SelectTrigger>
                <SelectContent>
                  {payslips.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.id} · {formatShortDate(p.payPeriodStart)} – {formatShortDate(p.payPeriodEnd)} · {p.status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMarking(null)} disabled={saving}>Cancel</Button>
            <Button onClick={save} disabled={!payrollId || saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Mark as paid</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
