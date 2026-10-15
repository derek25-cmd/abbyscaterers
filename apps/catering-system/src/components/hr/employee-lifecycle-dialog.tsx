'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { deleteEmployee, getEmployeeHistory, reactivateEmployee } from '@/services/hrRecordsService';
import type { Employee } from '@/types';

export type LifecycleAction = 'reactivate' | 'delete';

interface Props {
  action: LifecycleAction | null;
  employee: Employee | null;
  onClose: () => void;
  /** Called after the change succeeded, so the list can update. */
  onDone: (action: LifecycleAction, employee: Employee) => void;
}

const nameOf = (e: Employee) => [e.firstName, e.middleName, e.lastName].filter(Boolean).join(' ');

/**
 * Confirms reactivating (re-hiring) someone who has left, or deleting an
 * employee. Deleting is only possible when nothing is recorded for them; the
 * dialog checks first and says what is attached, so HR does not try in vain.
 */
export function EmployeeLifecycleDialog({ action, employee, onClose, onDone }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<{ what: string; records: number }[] | null>(null);

  useEffect(() => {
    setError(null); setHistory(null);
    if (action === 'delete' && employee) {
      getEmployeeHistory(employee.id).then(setHistory).catch((err) => setError(err instanceof Error ? err.message : String(err)));
    }
  }, [action, employee]);

  if (!action || !employee) return null;
  const name = nameOf(employee);
  const blocked = action === 'delete' && !!history && history.length > 0;

  const confirm = async () => {
    setBusy(true); setError(null);
    try {
      if (action === 'reactivate') await reactivateEmployee(employee.id);
      else await deleteEmployee(employee.id);
      onDone(action, employee);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work.');
    } finally { setBusy(false); }
  };

  return (
    <AlertDialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{action === 'reactivate' ? `Reactivate ${name}?` : `Delete ${name}?`}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              {action === 'reactivate' ? (
                <p>
                  {name} is re-hired: their status becomes Active, the end date and reason are cleared, and HR actions
                  (leave, attendance, letters, payslips) are possible again. This is recorded in the Audit Trail.
                </p>
              ) : history === null && !error ? (
                <p className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Checking what is recorded for {name}…</p>
              ) : blocked ? (
                <>
                  <p>{name} cannot be deleted. Employment records must be kept, and this person has:</p>
                  <ul className="list-disc pl-5">{history!.map((h) => <li key={h.what}>{h.records} {h.what}</li>)}</ul>
                  <p>{employee.status === 'Active' ? 'End their employment instead (Fire / End Employment); they then become Inactive.' : 'They stay Inactive, with their records kept.'}</p>
                </>
              ) : (
                <p>Nothing is recorded for {name} (no attendance, payslips, leave, letters, contracts or training), so the record can be removed. This cannot be undone; the Audit Trail keeps a note of it.</p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p role="alert" className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{blocked ? 'Close' : 'Cancel'}</AlertDialogCancel>
          {!blocked && (
            <Button variant={action === 'delete' ? 'destructive' : 'default'} onClick={confirm}
              disabled={busy || (action === 'delete' && history === null)}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {action === 'reactivate' ? 'Reactivate' : 'Delete employee'}
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
