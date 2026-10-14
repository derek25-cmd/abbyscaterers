'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Pencil } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useStaffRole } from '@/hooks/use-staff-role';
import { useToast } from '@/hooks/use-toast';
import { formatDays } from '@/lib/leave';
import { adjustBalance, getBalances, openLeaveYear, type BalanceRow } from '@/services/leaveService';
import type { LeaveType } from '@/types';
import { cn } from '@/lib/utils';

interface BalancesTableProps {
  refreshKey: number;
  types: LeaveType[];
  onChanged?: () => void;
}

/**
 * Who has how many days left, one row per employee and one column per leave
 * type. Each cell is "days left" with "of N" underneath. HR can click a cell to
 * correct the entitlement (e.g. days carried over by agreement).
 */
export function BalancesTable({ refreshKey, types, onChanged }: BalancesTableProps) {
  const { toast } = useToast();
  const { canManageHr } = useStaffRole();
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<BalanceRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<BalanceRow | null>(null);
  const [entitled, setEntitled] = useState('');
  const [carried, setCarried] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [opening, setOpening] = useState(false);

  const columns = useMemo(() => types.filter((t) => t.tracks_balance && t.is_active), [types]);

  const load = useCallback(() => {
    setRows(null);
    setError(null);
    getBalances(year)
      .then(setRows)
      .catch((err) => { setRows([]); setError(err instanceof Error ? err.message : 'Could not load the balances.'); });
  }, [year]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const people = useMemo(() => {
    const byEmployee = new Map<string, { id: string; name: string; department?: string; cells: Map<string, BalanceRow> }>();
    for (const r of rows ?? []) {
      const p = byEmployee.get(r.employee_id) ?? { id: r.employee_id, name: r.employee_name, department: r.department, cells: new Map() };
      p.cells.set(r.leave_type_id, r);
      byEmployee.set(r.employee_id, p);
    }
    const q = search.trim().toLowerCase();
    return [...byEmployee.values()]
      .filter((p) => !q || p.name.toLowerCase().includes(q) || (p.department ?? '').toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rows, search]);

  const startEdit = (row: BalanceRow) => {
    setEditing(row);
    setEntitled(String(row.entitled));
    setCarried(String(row.carried_forward));
  };

  const saveEdit = async () => {
    if (!editing) return;
    const e = Number(entitled);
    const c = Number(carried);
    if (!Number.isFinite(e) || !Number.isFinite(c) || e < 0 || c < 0) {
      toast({ variant: 'destructive', title: 'Check the numbers', description: 'Days cannot be negative.' });
      return;
    }
    setSaving(true);
    try {
      await adjustBalance(editing.id, { entitled: e, carried_forward: c });
      toast({ title: 'Balance updated', description: `${editing.employee_name}: ${editing.leave_type_name} ${year}. The change is recorded in the Audit Trail.` });
      setEditing(null);
      load();
      onChanged?.();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Could not change the balance', description: err instanceof Error ? err.message : undefined });
    } finally {
      setSaving(false);
    }
  };

  const open = async () => {
    setOpening(true);
    try {
      const added = await openLeaveYear(year);
      toast({
        title: added > 0 ? `Balances set up for ${year}` : `Nothing to add for ${year}`,
        description: added > 0 ? `${added} balance records were created.` : 'Every active employee already has balances for this year.',
      });
      setConfirmOpen(false);
      load();
      onChanged?.();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Could not set up the year', description: err instanceof Error ? err.message : undefined });
    } finally {
      setOpening(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label>Year</Label>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>{[thisYear - 1, thisYear, thisYear + 1].map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="bal-search">Find an employee</Label>
            <Input id="bal-search" className="w-56" placeholder="Name or department" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        {canManageHr && <Button variant="outline" onClick={() => setConfirmOpen(true)}>Set up {year} balances</Button>}
      </div>

      {error && <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">{error}</p>}

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              {columns.map((t) => <TableHead key={t.id} className="text-center">{t.name}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows === null && <TableRow><TableCell colSpan={columns.length + 1} className="py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></TableCell></TableRow>}
            {people.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}{p.department && <span className="block text-xs font-normal text-muted-foreground">{p.department}</span>}</TableCell>
                {columns.map((t) => {
                  const cell = p.cells.get(t.id);
                  if (!cell) return <TableCell key={t.id} className="text-center text-muted-foreground">—</TableCell>;
                  const low = cell.remaining <= 0;
                  const body = (
                    <>
                      <span className={cn('text-base font-semibold', low && 'text-red-700')}>{cell.remaining}</span>
                      <span className="block text-xs text-muted-foreground">of {cell.entitled + cell.carried_forward}</span>
                    </>
                  );
                  return (
                    <TableCell key={t.id} className="text-center">
                      {canManageHr ? (
                        <button type="button" className="group rounded px-2 py-1 hover:bg-muted" onClick={() => startEdit(cell)} aria-label={`Adjust ${t.name} balance for ${p.name}`}>
                          {body}<Pencil className="mx-auto hidden h-3 w-3 text-muted-foreground group-hover:block" aria-hidden />
                        </button>
                      ) : body}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
            {rows && people.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="py-10 text-center text-muted-foreground">
                  {rows.length === 0
                    ? (canManageHr ? `No balances exist for ${year} yet. Press “Set up ${year} balances” to create them for every active employee.` : `Balances for ${year} have not been set up yet. Ask HR.`)
                    : 'No employee matches that search.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">Numbers are working days left this year, and “of” shows the total including days carried over. Unpaid leave has no balance.</p>

      <Dialog open={!!editing} onOpenChange={(o) => !saving && !o && setEditing(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Adjust balance</DialogTitle>
            <DialogDescription>{editing?.employee_name} · {editing?.leave_type_name} · {year}. Already taken: {editing ? formatDays(editing.taken + (editing.opening_taken ?? 0)) : ''}{editing?.opening_taken ? ` (${formatDays(editing.opening_taken)} before go-live)` : ''}.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label htmlFor="adj-entitled">Days per year</Label><Input id="adj-entitled" type="number" min={0} step="0.5" value={entitled} onChange={(e) => setEntitled(e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="adj-carried">Carried over</Label><Input id="adj-carried" type="number" min={0} step="0.5" value={carried} onChange={(e) => setCarried(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>Cancel</Button>
            <Button onClick={saveEdit} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Set up {year} leave balances?</AlertDialogTitle>
            <AlertDialogDescription>
              This gives every active employee their {year} leave days for each type, and carries over unused days up to each type&apos;s limit.
              It only adds what is missing, so it is safe to run again (for example after hiring someone). Balances that already exist are not changed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={opening}>Not now</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); void open(); }} disabled={opening}>
              {opening && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Set up {year}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
