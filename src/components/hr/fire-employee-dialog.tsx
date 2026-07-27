'use client';

import { useState } from 'react';
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, AlertTriangle } from 'lucide-react';
import { FireEmployeeSchema, type FireEmployeeFormData } from '@/lib/schemas';
import { format } from 'date-fns';
import type { Employee } from '@/types';

interface FireEmployeeDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  employee: Employee;
  onConfirm: (data: FireEmployeeFormData) => Promise<void>;
}

export function FireEmployeeDialog({ isOpen, setIsOpen, employee, onConfirm }: FireEmployeeDialogProps) {
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FireEmployeeFormData>({
    resolver: zodResolver(FireEmployeeSchema),
    defaultValues: {
      employmentEndDate: format(new Date(), 'yyyy-MM-dd'),
      employmentEndReason: '',
    },
  });

  const fullName = [employee.firstName, employee.middleName, employee.lastName].filter(Boolean).join(' ');

  const handleSubmit = async (data: FireEmployeeFormData) => {
    setSubmitting(true);
    try {
      await onConfirm(data);
      form.reset();
      setIsOpen(false);
    } catch {
      // Error is surfaced via toast by the caller — keep the dialog open.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                End Employment — {fullName}
              </DialogTitle>
              <DialogDescription>
                This marks {fullName} as Inactive. They will no longer appear in active-employee
                exports or be included in the monthly payroll run.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <FormField control={form.control} name="employmentEndDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Last Working Date</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="employmentEndReason" render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason (firing, resignation, etc.)</FormLabel>
                  <FormControl>
                    <Textarea rows={4} placeholder="e.g. Resigned to pursue another opportunity / Terminated for repeated attendance violations" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" onClick={() => form.reset()}>Cancel</Button>
              </DialogClose>
              <Button type="submit" variant="destructive" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm — End Employment
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
