'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSupabaseClient } from '@/lib/supabase-client';
import { SuperAdminGate } from '@/components/admin/super-admin-gate';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';

interface AuditRow {
  id: string;
  actor_id: string | null;
  actor_type: 'portal' | 'staff' | 'system';
  action: string;
  table_name: string | null;
  record_id: string | null;
  note: string | null;
  created_at: string;
}

const ACTOR_TYPE_CLASS: Record<string, string> = {
  portal: 'bg-primary/10 text-primary',
  staff: 'bg-secondary',
  system: 'bg-muted text-muted-foreground',
};

function AuditLog() {
  const supabase = useSupabaseClient();
  const [search, setSearch] = useState('');

  const query = useQuery({
    queryKey: ['audit-log'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('portal_audit_log')
        .select('id, actor_id, actor_type, action, table_name, record_id, note, created_at')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as AuditRow[];
    },
  });

  const filtered = useMemo(() => {
    const rows = query.data ?? [];
    if (!search.trim()) return rows;
    const q = search.trim().toLowerCase();
    return rows.filter(
      (r) =>
        r.action.toLowerCase().includes(q) ||
        (r.table_name ?? '').toLowerCase().includes(q) ||
        (r.record_id ?? '').toLowerCase().includes(q) ||
        (r.actor_id ?? '').toLowerCase().includes(q)
    );
  }, [query.data, search]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Audit Log</h1>
        <p className="text-sm text-muted-foreground">
          Approvals, rejections, request fulfillments, and access changes. Most recent 200 entries.
        </p>
      </div>

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by action, table, record, or actor…"
        className="max-w-sm"
      />

      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Record</TableHead>
              <TableHead>Note</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => (
              <TableRow key={r.id} className="align-top">
                <TableCell className="text-muted-foreground whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={`mr-1 ${ACTOR_TYPE_CLASS[r.actor_type]}`}>
                    {r.actor_type}
                  </Badge>
                  <span className="font-mono text-xs">{r.actor_id ?? '—'}</span>
                </TableCell>
                <TableCell className="font-mono text-xs">{r.action}</TableCell>
                <TableCell className="text-xs">
                  {r.table_name ? (
                    <>
                      {r.table_name}
                      {r.record_id ? `:${r.record_id}` : ''}
                    </>
                  ) : (
                    '—'
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.note ?? '—'}</TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No audit entries match &quot;{search}&quot;.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

export default function AuditLogPage() {
  return (
    <SuperAdminGate>
      <AuditLog />
    </SuperAdminGate>
  );
}
