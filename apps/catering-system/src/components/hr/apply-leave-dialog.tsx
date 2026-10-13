'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CalendarDays, Loader2, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useStaffRole } from '@/hooks/use-staff-role';
import { useLeaveReference } from '@/hooks/use-leave-reference';
import { countWorkingDays, formatDays, leaveYearOf, validateLeaveRange } from '@/lib/leave';
import { getEmployeeDirectory } from '@/services/employeeService';
import { applyForLeave, getEmployeeBalances } from '@/services/leaveService';
import { uploadLeaveAttachment, validateLeaveAttachment } from '@/services/leaveAttachmentService';
import type { Employee } from '@/types';

interface ApplyLeaveDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  /** Called after a request is filed, so the list behind the dialog can refresh. */
  onSubmitted?: () => void;
  /** Pre-select an employee (e.g. from the employee's own Leave tab). */
  defaultEmployeeId?: string;
}

export function ApplyLeaveDialog({ isOpen, setIsOpen, onSubmitted, defaultEmployeeId }: ApplyLeaveDialogProps) {
  const { toast } = useToast();
  const { canManageHr, employeeId: myEmployeeId, isLoading: roleLoading } = useStaffRole();
  const { activeTypes, holidayDates, workingWeek } = useLeaveReference();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [typeId, setTypeId] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [reason, setReason] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [balance, setBalance] = useState<{ remaining: number; entitled: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // A login linked to an employee applies for that employee only (the database
  // enforces this too). HR roles, and unlinked logins, may choose anyone.
  const lockedToSelf = !canManageHr && !!myEmployeeId;

  useEffect(() => {
    if (!isOpen) return;
    void getEmployeeDirectory().then((all) => setEmployees(all.filter((e) => e.status === 'Active')));
  }, [isOpen]);

  // Fresh form every time the dialog opens.
  useEffect(() => {
    if (!isOpen || roleLoading) return;
    setEmployeeId(lockedToSelf ? (myEmployeeId as string) : (defaultEmployeeId ?? ''));
    setTypeId(''); setStart(''); setEnd(''); setReason(''); setFile(null); setBalance(null); setServerError(null);
  }, [isOpen, roleLoading, lockedToSelf, myEmployeeId, defaultEmployeeId]);

  const type = useMemo(() => activeTypes.find((t) => t.id === typeId), [activeTypes, typeId]);
  const year = start ? leaveYearOf(start) : new Date().getFullYear();

  // Remaining days for the chosen person and type.
  useEffect(() => {
    setBalance(null);
    if (!employeeId || !type?.tracks_balance) return;
    let active = true;
    getEmployeeBalances(employeeId, year)
      .then((rows) => {
        if (!active) return;
        const row = rows.find((r) => r.type.id === type.id);
        setBalance(row ? { remaining: row.remaining, entitled: row.entitled } : null);
      })
      .catch(() => { if (active) setBalance(null); });
    return () => { active = false; };
  }, [employeeId, type, year]);

  const rangeError = start && end ? validateLeaveRange(start, end, holidayDates, workingWeek) : null;
  const days = start && end && !rangeError ? countWorkingDays(start, end, holidayDates, workingWeek) : 0;
  const exceeds = !!type?.tracks_balance && !!balance && days > balance.remaining;
  const needsFile = !!type?.requires_attachment;
  const fileProblem = file ? validateLeaveAttachment(file) : null;

  // Say exactly what is still needed, in the order a person fills the form.
  const blockReason =
    !employeeId ? 'Choose who the leave is for.'
    : !typeId ? 'Choose the type of leave.'
    : !start || !end ? 'Choose the first and last day of leave.'
    : rangeError ? rangeError
    : exceeds ? `${type?.name} leave: only ${formatDays(balance!.remaining)} left, but this request is for ${formatDays(days)}.`
    : needsFile && !file ? `${type?.name} leave needs a supporting document. Attach it below.`
    : fileProblem ? fileProblem
    : null;

  const submit = async () => {
    if (blockReason) return;
    setSubmitting(true);
    setServerError(null);
    try {
      const attachment_path = file ? await uploadLeaveAttachment(file) : null;
      await applyForLeave({ employee_id: employeeId, leave_type_id: typeId, start_date: start, end_date: end, reason, attachment_path });
      toast({
        title: 'Leave request sent',
        description: `${formatDays(days)} of ${type?.name} leave. HR has been notified and you will see the decision here.`,
      });
      setIsOpen(false);
      onSubmitted?.();
    } catch (err) {
      // Shown inside the dialog so it cannot be missed (and the form is kept).
      setServerError(err instanceof Error ? err.message : 'Could not send the request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const selfName = employees.find((e) => e.id === myEmployeeId);

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !submitting && setIsOpen(o)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-primary" /> Apply for leave</DialogTitle>
          <DialogDescription>
            {canManageHr
              ? 'File a leave request for an employee. It goes to the approvers like any other request.'
              : 'Fill in the dates and send. HR will review it and you will be notified of the decision.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="leave-employee">Who is the leave for?</Label>
            <Select value={employeeId} onValueChange={setEmployeeId} disabled={lockedToSelf}>
              <SelectTrigger id="leave-employee"><SelectValue placeholder="Choose an employee" /></SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName}{e.department ? ` — ${e.department}` : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {lockedToSelf && (
              <p className="text-xs text-muted-foreground">
                You can apply for yourself{selfName ? ` (${selfName.firstName} ${selfName.lastName})` : ''}. Ask HR to file leave for anyone else.
              </p>
            )}
            {!canManageHr && !myEmployeeId && !roleLoading && (
              <p className="text-xs text-muted-foreground">
                Your login is not linked to an employee record yet, so you can choose anyone. Ask the admin to link it so this is filled in for you.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="leave-type">Type of leave</Label>
            <Select value={typeId} onValueChange={setTypeId}>
              <SelectTrigger id="leave-type"><SelectValue placeholder="Choose a type" /></SelectTrigger>
              <SelectContent>
                {activeTypes.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {type?.description && <p className="text-xs text-muted-foreground">{type.description}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="leave-start">First day</Label>
              <Input
                id="leave-start" type="date" value={start}
                onChange={(e) => { setStart(e.target.value); if (!end || end < e.target.value) setEnd(e.target.value); }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="leave-end">Last day</Label>
              <Input id="leave-end" type="date" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>

          {/* Live summary: what this request will cost, before sending. */}
          {days > 0 && (
            <div className={`rounded-md border p-3 text-sm ${exceeds ? 'border-red-300 bg-red-50 text-red-900' : 'border-blue-200 bg-blue-50 text-blue-900'}`}>
              <p className="font-semibold">{formatDays(days)} of leave</p>
              <p className="text-xs opacity-80">Sundays and public holidays are not counted.</p>
              {type?.tracks_balance && balance && (
                <p className="mt-1">
                  {type.name} balance: <strong>{formatDays(balance.remaining)}</strong> left
                  {!exceeds && <> → <strong>{formatDays(balance.remaining - days)}</strong> after this request</>}
                  {exceeds && <> — not enough for this request.</>}
                </p>
              )}
              {type && !type.is_paid && <p className="mt-1">This is unpaid leave. HR will see these days when running payroll.</p>}
            </div>
          )}
          {rangeError && <p className="flex items-start gap-1.5 text-sm text-red-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{rangeError}</p>}

          {needsFile && (
            <div className="space-y-1.5">
              <Label htmlFor="leave-file" className="flex items-center gap-1.5"><Paperclip className="h-4 w-4" /> Supporting document (required)</Label>
              <Input id="leave-file" type="file" accept=".pdf,image/jpeg,image/png,image/webp,image/heic" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              <p className="text-xs text-muted-foreground">A PDF or a clear photo, up to 5 MB. Only you and HR can open it.</p>
              {fileProblem && <p className="text-sm text-red-700">{fileProblem}</p>}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="leave-reason">Reason <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Textarea id="leave-reason" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="A short note for the approver" />
          </div>

          {serverError && (
            <div role="alert" className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{serverError}</span>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col items-stretch gap-2 sm:flex-col sm:items-stretch">
          {blockReason && <p className="text-xs text-muted-foreground">{blockReason}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsOpen(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={submit} disabled={!!blockReason || submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send request
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
