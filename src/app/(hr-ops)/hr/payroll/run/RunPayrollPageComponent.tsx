'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Loader2, Play } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { getErrorDescription } from '@/lib/service-validation';
import { getEmployees } from '@/services/employeeService';
import { getActiveTaxRates } from '@/services/taxRatesService';
import { runMonthlyPayroll, type MonthlyPayrollRunResult } from '@/services/payrollService';
import { calculatePayroll } from '@/lib/payrollEngine';
import { formatTZS } from '@/lib/formatCurrency';
import type { Employee } from '@/types';
import type { TaxRates } from '@/lib/payrollEngine';

export function RunPayrollPageComponent() {
  const { toast } = useToast();
  const [monthValue, setMonthValue] = useState(''); // yyyy-MM from <input type="month">
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [rates, setRates] = useState<TaxRates | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<MonthlyPayrollRunResult | null>(null);

  useEffect(() => {
    Promise.all([getEmployees(), getActiveTaxRates()]).then(([emps, r]) => {
      setEmployees(emps);
      setRates(r);
      setLoading(false);
    });
  }, []);

  const { payPeriodStart, payPeriodEnd } = useMemo(() => {
    if (!monthValue) return { payPeriodStart: '', payPeriodEnd: '' };
    const [year, month] = monthValue.split('-').map(Number);
    // Built from numeric components directly, not via toISOString() — that
    // converts through UTC, which silently shifts the date back a day for
    // any positive-UTC-offset timezone (e.g. Tanzania, UTC+3).
    const pad = (n: number) => String(n).padStart(2, '0');
    const lastDay = new Date(year, month, 0).getDate();
    return {
      payPeriodStart: `${year}-${pad(month)}-01`,
      payPeriodEnd: `${year}-${pad(month)}-${pad(lastDay)}`,
    };
  }, [monthValue]);

  const activePermanentEmployees = useMemo(
    () => employees.filter((e) => e.status === 'Active' && e.monthlySalary && e.monthlySalary > 0),
    [employees]
  );
  const missingSalaryEmployees = useMemo(
    () => employees.filter((e) => e.status === 'Active' && (!e.monthlySalary || e.monthlySalary <= 0)),
    [employees]
  );

  const previewRows = useMemo(() => {
    if (!rates) return [];
    return activePermanentEmployees.map((emp) => ({
      employee: emp,
      breakdown: calculatePayroll({ staffType: 'permanent', monthlySalary: emp.monthlySalary, allowances: 0, otherDeductions: 0 }, rates),
    }));
  }, [activePermanentEmployees, rates]);

  const totals = useMemo(() => previewRows.reduce((acc, row) => ({
    grossSalary: acc.grossSalary + row.breakdown.grossSalary,
    netSalary: acc.netSalary + row.breakdown.netSalary,
    employerCost: acc.employerCost + row.breakdown.employerCost,
  }), { grossSalary: 0, netSalary: 0, employerCost: 0 }), [previewRows]);

  const handleRun = async () => {
    if (!payPeriodStart || !payPeriodEnd) return;
    setRunning(true);
    setResult(null);
    try {
      const runResult = await runMonthlyPayroll(payPeriodStart, payPeriodEnd);
      setResult(runResult);
      toast({ title: 'Payroll run complete', description: `${runResult.created.length} payslip(s) generated, ${runResult.skipped.length} skipped.` });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Payroll run failed', description: getErrorDescription(error) });
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return <main className="p-8"><Loader2 className="h-6 w-6 animate-spin" /></main>;
  }

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
      <h1 className="font-headline text-2xl font-bold">Monthly Payroll Run</h1>

      {!rates && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">
              No active tax rates configured. <Link href="/hr/payroll/tax-rates" className="underline">Set up tax rates</Link> before running payroll.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>1. Choose Pay Period</CardTitle>
          <CardDescription>Generates one payslip per active permanent employee with a monthly salary set. Casual staff are not included — generate their payslips individually.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-xs">
            <Label htmlFor="month">Month</Label>
            <Input id="month" type="month" value={monthValue} onChange={(e) => { setMonthValue(e.target.value); setResult(null); }} />
          </div>
        </CardContent>
      </Card>

      {monthValue && rates && (
        <Card>
          <CardHeader>
            <CardTitle>2. Preview</CardTitle>
            <CardDescription>Nothing is saved yet — review before confirming.</CardDescription>
          </CardHeader>
          <CardContent>
            {missingSalaryEmployees.length > 0 && (
              <p className="text-sm text-amber-600 mb-4">
                {missingSalaryEmployees.length} active employee(s) will be skipped (no monthly salary set): {missingSalaryEmployees.map(e => `${e.firstName} ${e.lastName}`).join(', ')}
              </p>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">PAYE</TableHead>
                  <TableHead className="text-right">NSSF (Emp)</TableHead>
                  <TableHead className="text-right">Net Salary</TableHead>
                  <TableHead className="text-right">Employer Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewRows.map(({ employee, breakdown }) => (
                  <TableRow key={employee.id}>
                    <TableCell>{employee.firstName} {employee.lastName}</TableCell>
                    <TableCell className="text-right">{formatTZS(breakdown.grossSalary)}</TableCell>
                    <TableCell className="text-right">{formatTZS(breakdown.payeAmount)}</TableCell>
                    <TableCell className="text-right">{formatTZS(breakdown.nssfEmployee)}</TableCell>
                    <TableCell className="text-right font-medium">{formatTZS(breakdown.netSalary)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatTZS(breakdown.employerCost)}</TableCell>
                  </TableRow>
                ))}
                {previewRows.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No eligible employees.</TableCell></TableRow>
                )}
              </TableBody>
              {previewRows.length > 0 && (
                <TableFooter>
                  <TableRow>
                    <TableCell className="font-bold">Total ({previewRows.length} employees)</TableCell>
                    <TableCell className="text-right font-bold">{formatTZS(totals.grossSalary)}</TableCell>
                    <TableCell />
                    <TableCell />
                    <TableCell className="text-right font-bold">{formatTZS(totals.netSalary)}</TableCell>
                    <TableCell className="text-right font-bold">{formatTZS(totals.employerCost)}</TableCell>
                  </TableRow>
                </TableFooter>
              )}
            </Table>

            <Button className="mt-6" onClick={handleRun} disabled={running || previewRows.length === 0}>
              {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
              Confirm & Generate {previewRows.length} Payslip{previewRows.length === 1 ? '' : 's'}
            </Button>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>3. Result</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm">Created {result.created.length} payslip(s).</p>
            {result.skipped.length > 0 && (
              <div>
                <p className="text-sm font-medium">Skipped:</p>
                <ul className="text-sm text-muted-foreground list-disc pl-5">
                  {result.skipped.map((s) => <li key={s.employeeId}>{s.employeeName} — {s.reason}</li>)}
                </ul>
              </div>
            )}
            <Button asChild variant="outline" className="mt-2">
              <Link href="/hr/payroll">View Payslip History</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
