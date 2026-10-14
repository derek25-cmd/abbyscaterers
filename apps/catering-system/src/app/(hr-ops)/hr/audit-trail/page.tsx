'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useStaffRole } from '@/hooks/use-staff-role';
import {
  AUDIT_PAGE_SIZE, HR_AUDIT_TABLES, OPS_AUDIT_TABLES, getAuditActors, getAuditEntries,
  type AuditEntry, type AuditFilters, type AuditModule,
} from '@/services/auditService';

const ANY = '__any__';
const EMPTY_FILTERS: AuditFilters = { module: 'all', table: '', actorId: '', from: '', to: '' };

export default function AuditTrailPage() {
  const { toast } = useToast();
  const { can, isLoading: roleLoading } = useStaffRole();
  const canViewAll = can('audit.viewAll');

  const [filters, setFilters] = useState<AuditFilters>(EMPTY_FILTERS);
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [actors, setActors] = useState<{ id: string; email: string }[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);

  const emailById = useMemo(() => new Map(actors.map((a) => [a.id, a.email])), [actors]);

  const tableOptions = useMemo(() => {
    if (filters.module === 'hr') return [...HR_AUDIT_TABLES];
    if (filters.module === 'ops') return [...OPS_AUDIT_TABLES];
    return canViewAll ? [...HR_AUDIT_TABLES, ...OPS_AUDIT_TABLES] : [...HR_AUDIT_TABLES];
  }, [filters.module, canViewAll]);

  const load = useCallback(async (f: AuditFilters, p: number) => {
    setLoading(true);
    try {
      const rows = await getAuditEntries(f, p);
      setEntries((prev) => (p === 0 ? rows : [...prev, ...rows]));
      setHasMore(rows.length === AUDIT_PAGE_SIZE);
      setPage(p);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Could not load audit trail', description: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void getAuditActors().then(setActors); }, []);
  useEffect(() => { if (can('audit.view')) void load(filters, 0); }, [filters, can, load]);

  if (roleLoading) return <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!can('audit.view')) {
    return <p className="p-6 text-muted-foreground">The audit trail is only available to the HR Manager, General Manager and Admin.</p>;
  }

  const set = (patch: Partial<AuditFilters>) => setFilters((f) => ({ ...f, ...patch }));

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">Audit Trail</h1>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Every entry, edit, delete and approval, with who did it and when.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1">
            <Label>Module</Label>
            <Select value={filters.module} onValueChange={(v) => set({ module: v as AuditModule, table: '' })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="hr">HR</SelectItem>
                {canViewAll && <SelectItem value="ops">Operations</SelectItem>}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Table</Label>
            <Select value={filters.table || ANY} onValueChange={(v) => set({ table: v === ANY ? '' : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any table</SelectItem>
                {tableOptions.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>User</Label>
            <Select value={filters.actorId || ANY} onValueChange={(v) => set({ actorId: v === ANY ? '' : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Anyone</SelectItem>
                {actors.map((a) => <SelectItem key={a.id} value={a.id}>{a.email}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="audit-from">From</Label>
            <Input id="audit-from" type="date" value={filters.from} onChange={(e) => set({ from: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="audit-to">To</Label>
            <Input id="audit-to" type="date" value={filters.to} onChange={(e) => set({ to: e.target.value })} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Table</TableHead>
                  <TableHead>Record</TableHead>
                  <TableHead>Changed fields</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap">
                      {new Date(e.created_at).toLocaleString('en-GB', { timeZone: 'Africa/Dar_es_Salaam' })}
                    </TableCell>
                    <TableCell>{(e.actor_id && emailById.get(e.actor_id)) || (e.actor_id ? e.actor_id.slice(0, 8) : 'System')}</TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-xs">{e.action}</TableCell>
                    <TableCell>{e.table_name}</TableCell>
                    <TableCell className="max-w-[160px] truncate" title={e.record_id ?? ''}>{e.record_id ?? '—'}</TableCell>
                    <TableCell className="max-w-[320px] text-xs text-muted-foreground">
                      {e.metadata?.changed_fields?.length ? e.metadata.changed_fields.join(', ') : '—'}
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && entries.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No entries match these filters.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex justify-center p-4">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : hasMore && (
              <Button variant="outline" onClick={() => load(filters, page + 1)}>Load more</Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
