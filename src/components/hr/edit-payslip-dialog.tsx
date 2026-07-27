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
import { calculatePayroll, type TaxRates } from '@/lib/payrollEngine';
import { getActiveTaxRates } from '@/services/taxRatesService';
import { formatTZS } from '@/lib/formatCurrency';
import type { Payroll } from '@/types';

interface EditPayslipDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  payslip: Payroll;
  onEditPayslip: (data: Partial<Payroll> & { id: string }) => Promise<void>;
}

export function EditPayslipDialog({ isOpen, setIsOpen, payslip, onEditPayslip }: EditPayslipDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [rates, setRates] = useState<TaxRates | null>(null);

  const form = useForm<PayrollFormData>({
    resolver: zodResolver(PayrollSchema),
    defaultValues: {
      employeeId: payslip.employeeId,
      employeeName: payslip.employeeName,
      staffType: payslip.staff_type ?? 'permanent',
      payPeriodStart: payslip.payPeriodStart,
      payPeriodEnd: payslip.payPeriodEnd,
      monthlySalary: payslip.staff_type === 'casual' ? undefined : payslip.basicSalary,
      daysWorked: payslip.days_worked,
      dailyRate: payslip.daily_rate,
      allowances: payslip.allowances,
      otherDeductions: payslip.other_deductions ?? 0,
      status: payslip.status,
      paymentDate: payslip.paymentDate,
    },
  });

  useEffect(() => {
    if (isOpen) getActiveTaxRates().then(setRates);
  }, [isOpen]);

  const watched = form.watch();
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
    if (!preview || !rates) return;
    setSubmitting(true);
    try {
      await onEditPayslip({
        id: payslip.id,
        payPeriodStart: data.payPeriodStart,
        payPeriodEnd: data.payPeriodEnd,
        staff_type: data.staffType,
        days_worked: data.daysWorked,
        daily_rate: data.dailyRate,
        basicSalary: preview.basicSalary,
        allowances: Number(data.allowances) || 0,
        deductions: preview.deductions,
        grossSalary: preview.grossSalary,
        netSalary: preview.netSalary,
        paye_amount: preview.payeAmount,
        nssf_employee: preview.nssfEmployee,
        nssf_employer: preview.nssfEmployer,
        sdl_amount: preview.sdlAmount,
        other_deductions: preview.otherDeductions,
        wcf_contrib: preview.wcfContrib,
        tax_rate_version_id: rates.id,
        status: data.status,
        paymentDate: data.paymentDate ?? null,
      });
      setIsOpen(false);
    } catch {
      // Error surfaced via toast by the caller — keep the dialog open.
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
              <DialogTitle>Edit Payslip — {payslip.id}</DialogTitle>
              <DialogDescription>Update the pay details for {payslip.employeeName}. Statutory deductions are recomputed automatically.</DialogDescription>
            </DialogHeader>
            <ScrollArea className="h-[65vh] p-4">
              <div className="grid gap-6">
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

                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="Pending">Pending</SelectItem>
                        <SelectItem value="Paid">Paid</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                {preview && (
                  <div className="rounded-md border bg-muted/30 p-4 space-y-1.5 text-sm">
                    <h4 className="font-medium mb-2">Recomputed Preview</h4>
                    <div className="flex justify-between"><span className="text-muted-foreground">Gross Salary</span><span>{formatTZS(preview.grossSalary)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">PAYE</span><span>{formatTZS(preview.payeAmount)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">NSSF (Employee)</span><span>{formatTZS(preview.nssfEmployee)}</span></div>
                    <div className="flex justify-between font-medium border-t pt-1.5"><span>Net Salary</span><span>{formatTZS(preview.netSalary)}</span></div>
                  </div>
                )}
                {!rates && <p className="text-sm text-destructive">No active tax rates configured — cannot recompute.</p>}
              </div>
            </ScrollArea>
            <DialogFooter className="pt-4">
              <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
              <Button type="submit" disabled={submitting || !rates}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
