'use client';

import { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LeaveStatusBadge } from '@/components/leave/leave-status-badge';
import { useStaffRole } from '@/hooks/use-staff-role';
import { LEAVE_STATUS_LABEL, formatDays } from '@/lib/leave';
import { getEmployeeDirectory } from '@/services/employeeService';
import { getRequests, type RequestFilters } from '@/services/leaveService';
import type { Employee, LeaveRequestStatus, LeaveRequestView, LeaveType } from '@/types';

const ANY = '__any__';

interface RequestsTableProps {
  refreshKey: number;
  types: LeaveType[];
  onOpen: (request: LeaveRequestView) => void;
}

const dates = (r: LeaveRequestView) =>
  r.start_date === r.end_date
    ? format(parseISO(r.start_date), 'd MMM yyyy')
    : `${format(parseISO(r.start_date), 'd MMM')} → ${format(parseISO(r.end_date), 'd MMM yyyy')}`;

/** Every request, newest first, with filters that say what they do. */
export function RequestsTable({ refreshKey, types, onOpen }: RequestsTableProps) {
  const { canManageHr, employeeId: myEmployeeId } = useStaffRole();
  const [status, setStatus] = useState('');
  const [typeId, setTypeId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  // Someone linked to an employee starts on their own requests; HR starts on everyone.
  const [onlyMine, setOnlyMine] = useState(!canManageHr && !!myEmployeeId);

  const [people, setPeople] = useState<Employee[]>([]);
  const [rows, setRows] = useState<LeaveRequestView[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { void getEmployeeDirectory().then(setPeople); }, []);
  useEffect(() => { setOnlyMine(!canManageHr && !!myEmployeeId); }, [canManageHr, myEmployeeId]);

  const filters: RequestFilters = useMemo(() => ({
    status: (status || undefined) as LeaveRequestStatus | undefined,
    leaveTypeId: typeId || undefined,
    employeeId: onlyMine && myEmployeeId ? myEmployeeId : employeeId || undefined,
    from: from || undefined,
    to: to || undefined,
  }), [status, typeId, employeeId, from, to, onlyMine, myEmployeeId]);

  useEffect(() => {
    let active = true;
    setRows(null);
    setError(null);
    getRequests(filters)
      .then((r) => { if (active) setRows(r); })
      .catch((err) => { if (active) { setRows([]); setError(err instanceof Error ? err.message : 'Could not load the requests.'); } });
    return () => { active = false; };
  }, [filters, refreshKey]);

  const anyFilter = !!(status || typeId || employeeId || from || to);
  const clear = () => { setStatus(''); setTypeId(''); setEmployeeId(''); setFrom(''); setTo(''); };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-1">
          <Label>Status</Label>
          <Select value={status || ANY} onValueChange={(v) => setStatus(v === ANY ? '' : v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Any status</SelectItem>
              {(Object.keys(LEAVE_STATUS_LABEL) as LeaveRequestStatus[]).map((s) => <SelectItem key={s} value={s}>{LEAVE_STATUS_LABEL[s]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Type of leave</Label>
          <Select value={typeId || ANY} onValueChange={(v) => setTypeId(v === ANY ? '' : v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Any type</SelectItem>
              {types.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Employee</Label>
          <Select value={employeeId || ANY} onValueChange={(v) => setEmployeeId(v === ANY ? '' : v)} disabled={onlyMine}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Everyone</SelectItem>
              {people.map((e) => <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="req-from">Leave on or after</Label>
          <Input id="req-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="req-to">Leave on or before</Label>
          <Input id="req-to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {myEmployeeId ? (
          <div className="flex items-center gap-2">
            <Checkbox id="only-mine" checked={onlyMine} onCheckedChange={(c) => setOnlyMine(c === true)} />
            <Label htmlFor="only-mine" className="cursor-pointer">Show only my requests</Label>
          </div>
        ) : <span />}
        {anyFilter && <Button variant="ghost" size="sm" onClick={clear}>Clear filters</Button>}
      </div>

      {error && <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">{error}</p>}

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead className="text-right">Days</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Sent</TableHead>
              <TableHead className="w-[1%]"><span className="sr-only">Open</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows === null && (
              <TableRow><TableCell colSpan={7} className="py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></TableCell></TableRow>
            )}
            {rows?.map((r) => (
              <TableRow key={r.id} className="cursor-pointer" onClick={() => onOpen(r)}>
                <TableCell className="font-medium">{r.employee_name}{r.department && <span className="block text-xs font-normal text-muted-foreground">{r.department}</span>}</TableCell>
                <TableCell>{r.leave_type_name}</TableCell>
                <TableCell className="whitespace-nowrap">{dates(r)}</TableCell>
                <TableCell className="text-right">{formatDays(r.days)}</TableCell>
                <TableCell><LeaveStatusBadge status={r.status} /></TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">{format(parseISO(r.created_at), 'd MMM yyyy')}</TableCell>
                <TableCell><Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onOpen(r); }}>{r.status === 'pending' && canManageHr ? 'Review' : 'View'}</Button></TableCell>
              </TableRow>
            ))}
            {rows && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  {anyFilter || onlyMine ? 'No requests match these filters.' : 'No leave requests yet. Use “Apply for leave” to file the first one.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
