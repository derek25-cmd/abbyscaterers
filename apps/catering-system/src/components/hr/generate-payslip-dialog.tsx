'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2 } from 'lucide-react';
import { PayrollSchema, type PayrollFormData } from '@/lib/schemas';
import { calculatePayroll } from '@/lib/payrollEngine';
import { getActiveTaxRates } from '@/services/taxRatesService';
import { formatTZS } from '@/lib/formatCurrency';
import type { Employee } from '@/types';
import type { TaxRates } from '@/lib/payrollEngine';

interface GeneratePayslipDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  employees: Employee[];
  onGeneratePayslip: (data: PayrollFormData) => Promise<void>;
  preselectedEmployeeId?: string | null;
}

export function GeneratePayslipDialog({ isOpen, setIsOpen, employees, onGeneratePayslip, preselectedEmployeeId }: GeneratePayslipDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [rates, setRates] = useState<TaxRates | null>(null);
  const [ratesLoading, setRatesLoading] = useState(true);

  const form = useForm<PayrollFormData>({
    resolver: zodResolver(PayrollSchema),
    defaultValues: {
      employeeId: '',
      employeeName: '',
      staffType: 'permanent',
      payPeriodStart: '',
      payPeriodEnd: '',
      allowances: 0,
      otherDeductions: 0,
      status: 'Pending',
    },
  });

  useEffect(() => {
    if (isOpen) {
      getActiveTaxRates().then((r) => { setRates(r); setRatesLoading(false); });
    }
  }, [isOpen]);

  useEffect(() => {
    if (preselectedEmployeeId && isOpen) {
      form.setValue('employeeId', preselectedEmployeeId);
    }
  }, [preselectedEmployeeId, isOpen, form]);

  const employeeId = form.watch('employeeId');
  useEffect(() => {
    const employee = employees.find((e) => e.id === employeeId);
    if (employee) {
      form.setValue('employeeName', `${employee.firstName} ${employee.lastName}`);
      if (employee.monthlySalary) form.setValue('monthlySalary', employee.monthlySalary);
    }
  }, [employeeId, employees, form]);

  const watched = form.watch();
  const selectedEmployee = employees.find((e) => e.id === watched.employeeId);
  const startDateWarning = selectedEmployee?.employmentStartDate && watched.payPeriodStart && watched.payPeriodStart < selectedEmployee.employmentStartDate
    ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}'s employment start date (${selectedEmployee.employmentStartDate}) is after this pay period's start.`
    : null;
  const preview = rates
    ? calculatePayroll(
        {
          staffType: watched.staffType,
          monthlySalary: watched.monthlySalary,
          daysWorked: watched.daysWorked,
          dailyRate: watched.dailyRate,
          allowances: Number(watched.allowances) || 0,
          otherDeductions: Number(watched.otherDeductions) || 0,
        },
        rates
      )
    : null;

  const handleSubmit = async (data: PayrollFormData) => {
    setSubmitting(true);
    try {
      await onGeneratePayslip(data);
      form.reset();
      setIsOpen(false);
    } catch {
      // Error is already surfaced via toast by the caller — keep the
      // dialog open with the entered data so the user can retry.
    } finally {
      setSubmitting(false);
    }
  };

  const staffType = form.watch('staffType');

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-2xl">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <DialogHeader>
              <DialogTitle>Generate New Payslip</DialogTitle>
              <DialogDescription>Enter the details to generate a payslip for an employee.</DialogDescription>
            </DialogHeader>
            <ScrollArea className="h-[65vh] p-4">
              <div className="grid gap-6">
                {!ratesLoading && !rates && (
                  <p className="text-sm text-destructive">
                    No active tax rates are configured. Set them up in HR &gt; Payroll &gt; Tax Rates before generating a payslip.
                  </p>
                )}

                <FormField control={form.control} name="employeeId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employee</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select an employee" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {employees.map((emp) => (
                          <SelectItem key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="staffType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Staff Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="permanent">Permanent (monthly salary)</SelectItem>
                        <SelectItem value="casual">Casual (daily rate)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="payPeriodStart" render={({ field }) => (
                    <FormItem><FormLabel>Period Start</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="payPeriodEnd" render={({ field }) => (
                    <FormItem><FormLabel>Period End</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>

                {staffType === 'permanent' ? (
                  <FormField control={form.control} name="monthlySalary" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monthly Salary (TZS)</FormLabel>
                      <FormControl><Input type="number" {...field} onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="daysWorked" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Days Worked</FormLabel>
                        <FormControl><Input type="number" {...field} onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="dailyRate" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Daily Rate (TZS)</FormLabel>
                        <FormControl><Input type="number" {...field} onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="allowances" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Allowances (TZS)</FormLabel>
                      <FormControl><Input type="number" {...field} onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="otherDeductions" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Other Deductions (TZS)</FormLabel>
                      <FormControl><Input type="number" {...field} onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                {startDateWarning && (
                  <p className="text-sm text-amber-600">{startDateWarning}</p>
                )}

                {preview && (
                  <div className="rounded-md border bg-muted/30 p-4 space-y-1.5 text-sm">
                    <h4 className="font-medium mb-2">Live Preview</h4>
                    <div className="flex justify-between"><span className="text-muted-foreground">Gross Salary</span><span>{formatTZS(preview.grossSalary)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">PAYE</span><span>{formatTZS(preview.payeAmount)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">NSSF (Employee)</span><span>{formatTZS(preview.nssfEmployee)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Other Deductions</span><span>{formatTZS(preview.otherDeductions)}</span></div>
                    <div className="flex justify-between font-medium border-t pt-1.5"><span>Net Salary</span><span>{formatTZS(preview.netSalary)}</span></div>
                    <div className="flex justify-between text-xs text-muted-foreground pt-2 border-t">
                      <span>Employer cost (NSSF employer + SDL + WCF)</span>
                      <span>{formatTZS(preview.employerCost - preview.grossSalary)}</span>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
            <DialogFooter className="pt-4">
              <DialogClose asChild>
                <Button type="button" variant="outline" onClick={() => form.reset()}>Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={submitting || !rates}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Generate Payslip
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
