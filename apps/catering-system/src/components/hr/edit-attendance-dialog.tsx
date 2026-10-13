'use client';

import { useEffect } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, Lock } from 'lucide-react';
import { AttendanceSchema, type AttendanceFormData } from '@/lib/schemas';
import type { Attendance, Employee } from '@/types';

interface EditAttendanceDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  employee: Employee;
  date: string; // yyyy-MM-dd
  record: Attendance | null; // existing record for this employee/date, if any
  onSave: (data: AttendanceFormData) => Promise<void>;
  /** Set when this day belongs to an approved leave request: the dialog becomes read-only. */
  lockedReason?: string;
  canManageHr?: boolean;
}

export function EditAttendanceDialog({ isOpen, setIsOpen, employee, date, record, onSave, lockedReason, canManageHr = false }: EditAttendanceDialogProps) {
  const employeeName = `${employee.firstName} ${employee.lastName}`;

  const form = useForm<AttendanceFormData>({
    resolver: zodResolver(AttendanceSchema),
    defaultValues: {
      employee_id: employee.id,
      employee: employeeName,
      date,
      status: record?.status ?? 'Present',
      clock_in_time: record?.clock_in_time ?? '',
      clock_out_time: record?.clock_out_time ?? '',
      notes: record?.notes ?? '',
    },
  });

  // The same dialog instance is reused for whichever cell was clicked —
  // reset with the newly-selected cell's data each time it opens.
  useEffect(() => {
    if (isOpen) {
      form.reset({
        employee_id: employee.id,
        employee: employeeName,
        date,
        status: record?.status ?? 'Present',
        clock_in_time: record?.clock_in_time ?? '',
        clock_out_time: record?.clock_out_time ?? '',
        notes: record?.notes ?? '',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, employee.id, date, record]);

  const submitting = form.formState.isSubmitting;
  // Leave is set by approved leave requests, not by hand. An old manual Leave
  // row is still shown (read-only for everyone except HR) rather than dropped.
  const hasManualLeave = record?.status === 'Leave';

  const handleSubmit = async (data: AttendanceFormData) => {
    try {
      await onSave(data);
      setIsOpen(false);
    } catch {
      // Error is surfaced via toast by the caller — keep the dialog open.
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <DialogHeader>
              <DialogTitle>Attendance — {employeeName}</DialogTitle>
              <DialogDescription>{date}</DialogDescription>
            </DialogHeader>
            {lockedReason && (
              <p className="mt-3 flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> <span>{lockedReason}</span>
              </p>
            )}
            <fieldset disabled={!!lockedReason} className="grid gap-4 py-4">
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={hasManualLeave && !canManageHr}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="Present">Present</SelectItem>
                      <SelectItem value="Absent">Absent</SelectItem>
                      {hasManualLeave && <SelectItem value="Leave">Leave</SelectItem>}
                      <SelectItem value="Half Day">Half Day</SelectItem>
                      <SelectItem value="Late">Late</SelectItem>
                    </SelectContent>
                  </Select>
                  {hasManualLeave && !canManageHr && <p className="text-xs text-muted-foreground">This day was marked Leave by hand. Only HR can change it.</p>}
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="clock_in_time" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Clock In</FormLabel>
                    <FormControl><Input type="time" {...field} value={field.value ?? ''} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="clock_out_time" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Clock Out</FormLabel>
                    <FormControl><Input type="time" {...field} value={field.value ?? ''} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl><Textarea rows={3} placeholder="Optional remarks" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </fieldset>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">{lockedReason ? 'Close' : 'Cancel'}</Button>
              </DialogClose>
              {!lockedReason && (
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save
                </Button>
              )}
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
