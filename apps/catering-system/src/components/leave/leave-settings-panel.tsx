'use client';

import { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { AlertCircle, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { addPublicHoliday, deletePublicHoliday, saveLeaveType, setWorkingWeek } from '@/services/leaveService';
import type { LeaveType, PublicHoliday } from '@/types';

const WEEK = [
  { n: 1, label: 'Monday' }, { n: 2, label: 'Tuesday' }, { n: 3, label: 'Wednesday' }, { n: 4, label: 'Thursday' },
  { n: 5, label: 'Friday' }, { n: 6, label: 'Saturday' }, { n: 7, label: 'Sunday' },
];

interface LeaveSettingsPanelProps {
  types: LeaveType[];
  holidays: PublicHoliday[];
  workingWeek: number[];
  /** Reload the shared leave settings after any change. */
  onChanged: () => void;
}

type TypeDraft = Partial<LeaveType> & { name: string };
const BLANK_TYPE: TypeDraft = {
  name: '', description: '', days_per_year: 0, is_paid: true, tracks_balance: true,
  requires_attachment: false, max_carry_forward: 0, is_active: true,
};

/** Everything HR can change about how leave works, in three clearly labelled blocks. */
export function LeaveSettingsPanel({ types, holidays, workingWeek, onChanged }: LeaveSettingsPanelProps) {
  const { toast } = useToast();
  const thisYear = new Date().getFullYear();

  // Working week
  const [week, setWeek] = useState<number[]>(workingWeek);
  const [savingWeek, setSavingWeek] = useState(false);
  // The saved week arrives after the first render and again after a save.
  useEffect(() => setWeek(workingWeek), [workingWeek]);
  const weekChanged = useMemo(() => [...week].sort().join() !== [...workingWeek].sort().join(), [week, workingWeek]);

  // Leave type dialog
  const [draft, setDraft] = useState<TypeDraft | null>(null);
  const [savingType, setSavingType] = useState(false);

  // Holidays
  const [year, setYear] = useState(thisYear);
  const [hDate, setHDate] = useState('');
  const [hName, setHName] = useState('');
  const [addingHoliday, setAddingHoliday] = useState(false);
  const yearHolidays = holidays.filter((h) => h.holiday_date.startsWith(String(year)));

  const run = async (action: () => Promise<void>, ok: { title: string; description?: string }, fail: string) => {
    try {
      await action();
      toast(ok);
      onChanged();
      return true;
    } catch (err) {
      toast({ variant: 'destructive', title: fail, description: err instanceof Error ? err.message : undefined });
      return false;
    }
  };

  const saveWeek = async () => {
    setSavingWeek(true);
    await run(() => setWorkingWeek([...week].sort()), { title: 'Working week saved', description: 'New requests use it straight away. Requests already sent keep the day count they had.' }, 'Could not save the working week');
    setSavingWeek(false);
  };

  const saveType = async () => {
    if (!draft) return;
    if (!draft.name.trim()) { toast({ variant: 'destructive', title: 'Give the leave type a name' }); return; }
    setSavingType(true);
    const ok = await run(() => saveLeaveType({ ...draft, name: draft.name.trim() }), { title: 'Leave type saved' }, 'Could not save the leave type');
    setSavingType(false);
    if (ok) setDraft(null);
  };

  const addHoliday = async () => {
    setAddingHoliday(true);
    const ok = await run(() => addPublicHoliday(hDate, hName), { title: 'Holiday added', description: `${hName} on ${hDate && format(parseISO(hDate), 'd MMM yyyy')}.` }, 'Could not add the holiday');
    setAddingHoliday(false);
    if (ok) { setHDate(''); setHName(''); }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Working week</CardTitle>
          <CardDescription>Only these days are counted as leave days. Public holidays are never counted.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {WEEK.map((d) => (
              <div key={d.n} className="flex items-center gap-2">
                <Checkbox
                  id={`wd-${d.n}`} checked={week.includes(d.n)}
                  onCheckedChange={(c) => setWeek((w) => (c === true ? [...new Set([...w, d.n])] : w.filter((x) => x !== d.n)))}
                />
                <Label htmlFor={`wd-${d.n}`} className="cursor-pointer">{d.label}</Label>
              </div>
            ))}
          </div>
          <Button onClick={saveWeek} disabled={!weekChanged || week.length === 0 || savingWeek}>
            {savingWeek && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save working week
          </Button>
          {week.length === 0 && <p className="text-sm text-red-700">Choose at least one working day.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle>Types of leave</CardTitle>
            <CardDescription>How many days each type gets a year, whether it is paid, and whether a document is needed.</CardDescription>
          </div>
          <Button size="sm" onClick={() => setDraft({ ...BLANK_TYPE })}><Plus className="mr-1 h-4 w-4" />Add type</Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead><TableHead className="text-right">Days a year</TableHead><TableHead>Paid</TableHead>
                  <TableHead>Document needed</TableHead><TableHead className="text-right">Carry over up to</TableHead><TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {types.map((t) => (
                  <TableRow key={t.id} className={t.is_active ? '' : 'opacity-60'}>
                    <TableCell className="font-medium">{t.name} {!t.is_active && <Badge variant="outline">Not in use</Badge>}</TableCell>
                    <TableCell className="text-right">{t.tracks_balance ? t.days_per_year : 'No limit'}</TableCell>
                    <TableCell>{t.is_paid ? 'Paid' : 'Unpaid'}</TableCell>
                    <TableCell>{t.requires_attachment ? 'Yes' : 'No'}</TableCell>
                    <TableCell className="text-right">{t.tracks_balance ? `${t.max_carry_forward} days` : '—'}</TableCell>
                    <TableCell><Button variant="ghost" size="sm" onClick={() => setDraft({ ...t })}><Pencil className="mr-1 h-3.5 w-3.5" />Edit</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Changing “days a year” affects balances created from now on. Existing balances are not rewritten; adjust them on the Balances tab.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Public holidays</CardTitle>
          <CardDescription>Holidays are not counted as leave days. Fixed-date holidays are filled in for 2026 and 2027.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Add holidays that move each year, such as <strong>Eid al-Fitr, Eid al-Adha, Good Friday and Easter Monday</strong>, once their dates are announced. Until then those days count as normal working days.</span>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label>Year</Label>
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>{[thisYear - 1, thisYear, thisYear + 1, thisYear + 2].map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label htmlFor="h-date">Date</Label><Input id="h-date" type="date" value={hDate} onChange={(e) => setHDate(e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="h-name">Name</Label><Input id="h-name" className="w-56" placeholder="e.g. Eid al-Fitr" value={hName} onChange={(e) => setHName(e.target.value)} /></div>
            <Button onClick={addHoliday} disabled={!hDate || !hName.trim() || addingHoliday}>{addingHoliday && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Add holiday</Button>
          </div>

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Holiday</TableHead><TableHead className="w-[1%]"><span className="sr-only">Remove</span></TableHead></TableRow></TableHeader>
              <TableBody>
                {yearHolidays.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="whitespace-nowrap">{format(parseISO(h.holiday_date), 'EEE d MMM yyyy')}</TableCell>
                    <TableCell>{h.name}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost" size="icon" aria-label={`Remove ${h.name}`}
                        onClick={() => run(() => deletePublicHoliday(h.id), { title: 'Holiday removed' }, 'Could not remove the holiday')}
                      ><Trash2 className="h-4 w-4 text-red-700" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
                {yearHolidays.length === 0 && <TableRow><TableCell colSpan={3} className="py-8 text-center text-muted-foreground">No holidays entered for {year} yet.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!draft} onOpenChange={(o) => !savingType && !o && setDraft(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{draft?.id ? `Edit ${draft.name || 'leave type'}` : 'Add a leave type'}</DialogTitle>
            <DialogDescription>Leave types cannot be deleted once used. Switch off “In use” to hide one from new requests.</DialogDescription>
          </DialogHeader>
          {draft && (
            <div className="space-y-4">
              <div className="space-y-1.5"><Label htmlFor="lt-name">Name</Label><Input id="lt-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
              <div className="space-y-1.5"><Label htmlFor="lt-desc">Short description <span className="font-normal text-muted-foreground">(shown to people applying)</span></Label><Textarea id="lt-desc" rows={2} value={draft.description ?? ''} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></div>
              <div className="flex items-center justify-between"><Label htmlFor="lt-bal">Has a yearly allowance</Label><Switch id="lt-bal" checked={draft.tracks_balance ?? true} onCheckedChange={(c) => setDraft({ ...draft, tracks_balance: c })} /></div>
              {(draft.tracks_balance ?? true) && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label htmlFor="lt-days">Days a year</Label><Input id="lt-days" type="number" min={0} step="0.5" value={draft.days_per_year ?? 0} onChange={(e) => setDraft({ ...draft, days_per_year: Number(e.target.value) })} /></div>
                  <div className="space-y-1.5"><Label htmlFor="lt-carry">Carry over up to (days)</Label><Input id="lt-carry" type="number" min={0} step="0.5" value={draft.max_carry_forward ?? 0} onChange={(e) => setDraft({ ...draft, max_carry_forward: Number(e.target.value) })} /></div>
                </div>
              )}
              <div className="flex items-center justify-between"><Label htmlFor="lt-paid">Paid leave</Label><Switch id="lt-paid" checked={draft.is_paid ?? true} onCheckedChange={(c) => setDraft({ ...draft, is_paid: c })} /></div>
              <div className="flex items-center justify-between"><Label htmlFor="lt-doc">Supporting document required</Label><Switch id="lt-doc" checked={draft.requires_attachment ?? false} onCheckedChange={(c) => setDraft({ ...draft, requires_attachment: c })} /></div>
              <div className="flex items-center justify-between"><Label htmlFor="lt-active">In use</Label><Switch id="lt-active" checked={draft.is_active ?? true} onCheckedChange={(c) => setDraft({ ...draft, is_active: c })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)} disabled={savingType}>Cancel</Button>
            <Button onClick={saveType} disabled={savingType}>{savingType && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
