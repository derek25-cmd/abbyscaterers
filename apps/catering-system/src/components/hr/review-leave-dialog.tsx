'use client';

import { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { AlertCircle, CheckCircle2, ExternalLink, Loader2, Users, XCircle } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { LeaveStatusBadge } from '@/components/leave/leave-status-badge';
import { useAuth } from '@/hooks/useAuth';
import { useStaffRole } from '@/hooks/use-staff-role';
import { useToast } from '@/hooks/use-toast';
import { useLeaveReference } from '@/hooks/use-leave-reference';
import { formatDays, leaveYearOf, workingDatesBetween } from '@/lib/leave';
import {
  LeaveConflictError, cancelRequest, getAttendanceForRange, getEmployeeBalances, getRequests, reviewRequest,
  type AttendanceDay,
} from '@/services/leaveService';
import { getLeaveAttachmentUrl } from '@/services/leaveAttachmentService';
import type { LeaveRequestView } from '@/types';

const fmt = (iso: string) => format(parseISO(iso), 'EEE d MMM yyyy');

interface ReviewLeaveDialogProps {
  request: LeaveRequestView | null;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  /** Called after any change (decision, cancellation) so lists can refresh. */
  onChanged?: () => void;
}

/**
 * One dialog for looking at a request. For a pending request an approver sees
 * the whole picture (balance, who else is away, attendance already recorded)
 * and what approving will do, then decides. For other requests it is the
 * read-only record, with Cancel where allowed.
 */
export function ReviewLeaveDialog({ request, isOpen, setIsOpen, onChanged }: ReviewLeaveDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { canManageHr, employeeId: myEmployeeId } = useStaffRole();
  const { types, holidayDates, workingWeek } = useLeaveReference();

  const [note, setNote] = useState('');
  const [replaceAbsent, setReplaceAbsent] = useState(false);
  const [busy, setBusy] = useState<'approve' | 'reject' | 'cancel' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const [balance, setBalance] = useState<{ remaining: number; entitled: number } | null>(null);
  const [teammates, setTeammates] = useState<LeaveRequestView[]>([]);
  const [attendance, setAttendance] = useState<AttendanceDay[]>([]);

  const type = useMemo(() => types.find((t) => t.id === request?.leave_type_id), [types, request]);
  const pending = request?.status === 'pending';

  useEffect(() => {
    setNote(''); setReplaceAbsent(false); setError(null); setBusy(null); setBalance(null); setTeammates([]); setAttendance([]);
    if (!isOpen || !request) return;
    let active = true;
    const year = leaveYearOf(request.start_date);

    getEmployeeBalances(request.employee_id, year)
      .then((rows) => {
        const row = rows.find((r) => r.type.id === request.leave_type_id);
        if (active && row) setBalance({ remaining: row.remaining, entitled: row.entitled });
      }).catch(() => undefined);

    if (pending) {
      // Colleagues in the same department already approved for these dates.
      getRequests({ status: 'approved', from: request.start_date, to: request.end_date })
        .then((rows) => {
          if (active) setTeammates(rows.filter((r) => r.employee_id !== request.employee_id && !!request.department && r.department === request.department));
        }).catch(() => undefined);
      getAttendanceForRange(request.employee_id, request.start_date, request.end_date)
        .then((rows) => { if (active) setAttendance(rows); }).catch(() => undefined);
    }
    return () => { active = false; };
  }, [isOpen, request, pending]);

  if (!request) return null;

  const isOwn = !!myEmployeeId && request.employee_id === myEmployeeId;
  const countedDays = new Set(workingDatesBetween(request.start_date, request.end_date, holidayDates, workingWeek));
  // Attendance that is in the way. A manual Leave row with no request is not (it gets adopted).
  const inTheWay = attendance.filter((a) => countedDays.has(a.date) && !(a.status === 'Leave' && !a.leave_request_id));
  const hardConflicts = inTheWay.filter((a) => a.status !== 'Absent');
  const absentConflicts = inTheWay.filter((a) => a.status === 'Absent');
  const needsReplaceTick = absentConflicts.length > 0;

  const after = balance && type?.tracks_balance ? balance.remaining - request.days : null;
  const notEnough = after !== null && after < 0;

  const canApprove = canManageHr && pending && !isOwn && !notEnough && hardConflicts.length === 0 && (!needsReplaceTick || replaceAbsent);
  const canCancel =
    (request.status === 'pending' && (canManageHr || request.created_by === user?.id || isOwn)) ||
    (request.status === 'approved' && canManageHr);

  const decide = async (decision: 'approved' | 'rejected') => {
    if (decision === 'rejected' && note.trim().length < 3) {
      setError('Please write a short reason, so the employee knows why the request was rejected.');
      return;
    }
    setBusy(decision === 'approved' ? 'approve' : 'reject');
    setError(null);
    try {
      await reviewRequest(request.id, decision, note, replaceAbsent);
      toast({
        title: decision === 'approved' ? 'Leave approved' : 'Leave rejected',
        description: decision === 'approved'
          ? `${request.employee_name}: ${formatDays(request.days)} now show as Leave on the attendance sheet.`
          : `${request.employee_name} has been told why.`,
      });
      setIsOpen(false);
      onChanged?.();
    } catch (err) {
      if (err instanceof LeaveConflictError) {
        setAttendance(err.conflicts.map((c) => ({ date: c.date, status: c.status, leave_request_id: null })));
      }
      setError(err instanceof Error ? err.message : 'Could not save the decision.');
    } finally {
      setBusy(null);
    }
  };

  const doCancel = async () => {
    setBusy('cancel');
    setError(null);
    try {
      await cancelRequest(request.id, note);
      toast({
        title: request.status === 'approved' ? 'Leave cancelled' : 'Request withdrawn',
        description: request.status === 'approved'
          ? `${formatDays(request.days)} were given back and the Leave days were removed from the attendance sheet.`
          : 'The request will not be reviewed.',
      });
      setConfirmCancel(false);
      setIsOpen(false);
      onChanged?.();
    } catch (err) {
      setConfirmCancel(false);
      setError(err instanceof Error ? err.message : 'Could not cancel the request.');
    } finally {
      setBusy(null);
    }
  };

  const openDocument = async () => {
    try {
      window.open(await getLeaveAttachmentUrl(request.attachment_path as string), '_blank', 'noopener');
    } catch (err) {
      toast({ variant: 'destructive', title: 'Could not open the document', description: err instanceof Error ? err.message : undefined });
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(o) => !busy && setIsOpen(o)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              {request.employee_name} <LeaveStatusBadge status={request.status} />
            </DialogTitle>
            <DialogDescription>
              {request.leave_type_name} leave{request.department ? ` · ${request.department}` : ''} · sent {format(parseISO(request.created_at), 'd MMM yyyy, HH:mm')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm">
            <div className="rounded-md border bg-muted/30 p-3">
              <p className="font-semibold">{fmt(request.start_date)} → {fmt(request.end_date)}</p>
              <p className="text-muted-foreground">{formatDays(request.days)} of leave (Sundays and public holidays not counted)</p>
              {request.reason && <p className="mt-2"><span className="font-medium">Reason:</span> {request.reason}</p>}
              {request.attachment_path && (
                <Button variant="link" className="h-auto p-0" onClick={openDocument}>
                  <ExternalLink className="mr-1 h-3.5 w-3.5" /> View supporting document
                </Button>
              )}
            </div>

            {balance && type?.tracks_balance && (
              <div className={`rounded-md border p-3 ${notEnough ? 'border-red-300 bg-red-50 text-red-900' : ''}`}>
                <p className="font-medium">{request.leave_type_name} balance for {leaveYearOf(request.start_date)}</p>
                <p>
                  {formatDays(balance.remaining)} left of {formatDays(balance.entitled)}
                  {pending && after !== null && (notEnough
                    ? <> — <strong>not enough</strong> for this request.</>
                    : <> → <strong>{formatDays(after)}</strong> if approved.</>)}
                </p>
              </div>
            )}
            {type && !type.is_paid && pending && (
              <p className="rounded-md border p-3">Unpaid leave: no balance changes. These days will appear in the unpaid leave report for payroll.</p>
            )}

            {pending && teammates.length > 0 && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900">
                <p className="flex items-center gap-1.5 font-medium"><Users className="h-4 w-4" /> Others in {request.department} are away on these dates</p>
                <ul className="mt-1 list-disc pl-5">
                  {teammates.map((t) => <li key={t.id}>{t.employee_name}: {fmt(t.start_date)} → {fmt(t.end_date)}</li>)}
                </ul>
              </div>
            )}

            {pending && hardConflicts.length > 0 && (
              <div className="rounded-md border border-red-300 bg-red-50 p-3 text-red-900">
                <p className="flex items-center gap-1.5 font-medium"><AlertCircle className="h-4 w-4" /> Attendance is already recorded on these days</p>
                <ul className="mt-1 list-disc pl-5">
                  {inTheWay.map((a) => <li key={a.date}>{fmt(a.date)}: {a.status}</li>)}
                </ul>
                <p className="mt-1">Correct those attendance records, or change the leave dates, before approving. Recorded attendance is never overwritten automatically.</p>
              </div>
            )}

            {pending && hardConflicts.length === 0 && absentConflicts.length > 0 && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900">
                <p className="font-medium">{absentConflicts.length} of these days are marked Absent</p>
                <ul className="mt-1 list-disc pl-5">{absentConflicts.map((a) => <li key={a.date}>{fmt(a.date)}</li>)}</ul>
                <div className="mt-2 flex items-center gap-2">
                  <Checkbox id="replace-absent" checked={replaceAbsent} onCheckedChange={(c) => setReplaceAbsent(c === true)} />
                  <Label htmlFor="replace-absent" className="cursor-pointer">Replace Absent days with this leave</Label>
                </div>
              </div>
            )}

            {canManageHr && pending && !isOwn && (
              <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-blue-900">
                <p className="font-medium">If you approve</p>
                <ul className="list-disc pl-5">
                  <li>{formatDays(countedDays.size || request.days)} will show as locked “Leave” on the attendance sheet.</li>
                  {type?.tracks_balance && <li>{request.leave_type_name} balance goes down by {formatDays(request.days)}.</li>}
                  <li>{request.employee_name} is notified, and the decision is recorded in the Audit Trail.</li>
                </ul>
              </div>
            )}

            {pending && isOwn && (
              <p className="flex items-start gap-1.5 rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                This is your own leave request. Another Admin, HR Manager or General Manager must approve or reject it.
              </p>
            )}

            {!pending && (request.decision_note || request.decided_at) && (
              <div className="rounded-md border p-3">
                <p className="font-medium">
                  {request.status === 'approved' ? 'Approved' : request.status === 'rejected' ? 'Rejected' : 'Cancelled'}
                  {(request.decided_at ?? request.cancelled_at) && ` on ${format(parseISO((request.decided_at ?? request.cancelled_at) as string), 'd MMM yyyy')}`}
                </p>
                {request.decision_note && <p>“{request.decision_note}”</p>}
              </div>
            )}

            {canManageHr && pending && !isOwn && (
              <div className="space-y-1.5">
                <Label htmlFor="leave-note">Note to the employee <span className="font-normal text-muted-foreground">(needed if you reject)</span></Label>
                <Textarea id="leave-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Please move your dates, the kitchen is short that week" />
              </div>
            )}

            {error && (
              <div role="alert" className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-red-900">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{error}</span>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <div>
              {canCancel && (
                <Button variant="ghost" className="text-red-700 hover:text-red-800" disabled={!!busy} onClick={() => setConfirmCancel(true)}>
                  {request.status === 'approved' ? 'Cancel this leave' : 'Withdraw request'}
                </Button>
              )}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => setIsOpen(false)} disabled={!!busy}>Close</Button>
              {canManageHr && pending && !isOwn && (
                <>
                  <Button variant="outline" className="border-red-300 text-red-800 hover:bg-red-50" disabled={!!busy} onClick={() => decide('rejected')}>
                    {busy === 'reject' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />} Reject
                  </Button>
                  <Button disabled={!canApprove || !!busy} onClick={() => decide('approved')}>
                    {busy === 'approve' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />} Approve
                  </Button>
                </>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{request.status === 'approved' ? 'Cancel this approved leave?' : 'Withdraw this request?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {request.status === 'approved'
                ? `${formatDays(request.days)} will be given back to ${request.employee_name}'s ${request.leave_type_name} balance, and the Leave days will be removed from the attendance sheet. ${request.employee_name} is notified.`
                : 'The request will be closed and will not be reviewed.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy === 'cancel'}>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); void doCancel(); }} disabled={busy === 'cancel'}>
              {busy === 'cancel' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Yes, {request.status === 'approved' ? 'cancel the leave' : 'withdraw it'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
