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
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, AlertTriangle, FileText, ArrowLeft } from 'lucide-react';
import { FireEmployeeSchema, type FireEmployeeFormData } from '@/lib/schemas';
import { format } from 'date-fns';
import { NewDocumentWizard } from '@/components/hr/new-document-wizard';
import type { Employee } from '@/types';
import { useHrModule } from '@/lib/hr-modules';

interface FireEmployeeDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  employee: Employee;
  /** The direct path (no letter). */
  onConfirm: (data: FireEmployeeFormData) => Promise<void>;
}

/**
 * Ending employment has two paths:
 *  - a termination letter (the default): nothing changes now; the employee
 *    becomes Inactive only when the letter is approved by someone else and issued;
 *  - "without a letter": the old direct change, for cases with no letter. It
 *    needs a reason and is recorded in the Audit Trail.
 * Both end the same way: Inactive, contract terminated, later leave cancelled.
 */
export function FireEmployeeDialog({ isOpen, setIsOpen, employee, onConfirm }: FireEmployeeDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [path, setPath] = useState<'choose' | 'direct'>('choose');
  const [letterOpen, setLetterOpen] = useState(false);
  // Letters switched off: only the direct path, which is never hidden.
  const lettersOn = useHrModule('letters');

  const form = useForm<FireEmployeeFormData>({
    resolver: zodResolver(FireEmployeeSchema),
    defaultValues: {
      employmentEndDate: format(new Date(), 'yyyy-MM-dd'),
      employmentEndReason: '',
    },
  });

  useEffect(() => { if (isOpen) { setPath('choose'); form.reset(); } }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const prepareLetter = () => { setIsOpen(false); setLetterOpen(true); };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(o) => !submitting && setIsOpen(o)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              End Employment — {fullName}
            </DialogTitle>
            <DialogDescription>
              {path === 'choose'
                ? 'Choose how. In both cases the employee becomes Inactive, their active contract is marked terminated, and leave booked after the last working day is cancelled.'
                : `This marks ${fullName} as Inactive now, without a letter. The reason is kept on the employee record and in the Audit Trail.`}
            </DialogDescription>
          </DialogHeader>

          {path === 'choose' ? (
            <div className="grid gap-3 py-2">
              {lettersOn && (
              <button type="button" onClick={prepareLetter}
                className="flex items-start gap-3 rounded-md border-2 border-primary bg-primary/5 p-4 text-left hover:bg-primary/10">
                <FileText className="mt-0.5 h-5 w-5 text-primary" />
                <span>
                  <span className="block font-semibold">Prepare termination letter <span className="font-normal text-muted-foreground">(recommended)</span></span>
                  <span className="text-sm text-muted-foreground">
                    {employee.firstName} stays Active until the letter is approved by someone other than you and issued. The letter is numbered and kept.
                  </span>
                </span>
              </button>
              )}
              <button type="button" onClick={() => setPath('direct')}
                className="flex items-start gap-3 rounded-md border p-4 text-left hover:bg-muted/50">
                <AlertTriangle className="mt-0.5 h-5 w-5 text-muted-foreground" />
                <span>
                  <span className="block font-semibold">End employment without a letter</span>
                  <span className="text-sm text-muted-foreground">Only when there is no letter to send, for example someone who simply stopped coming. Takes effect immediately.</span>
                </span>
              </button>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)}>
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
                      <FormLabel>Reason</FormLabel>
                      <FormControl>
                        <Textarea rows={4} placeholder="e.g. Stopped reporting for work from 3 October and could not be reached" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <DialogFooter className="gap-2 sm:justify-between">
                  <Button type="button" variant="ghost" onClick={() => setPath('choose')} disabled={submitting}><ArrowLeft className="mr-1 h-4 w-4" />Back</Button>
                  <Button type="submit" variant="destructive" disabled={submitting}>
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    End employment now
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>

      <NewDocumentWizard isOpen={letterOpen} setIsOpen={setLetterOpen} defaultDocType="termination" defaultEmployeeId={employee.id} />
    </>
  );
}
