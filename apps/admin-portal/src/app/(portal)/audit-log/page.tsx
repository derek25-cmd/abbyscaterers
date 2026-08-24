'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSupabaseClient } from '@/lib/supabase-client';
import { SuperAdminGate } from '@/components/admin/super-admin-gate';

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Audit Log</h1>
        <p className="text-sm text-muted-foreground">
          Approvals, rejections, request fulfillments, and access changes. Most recent 200 entries.
        </p>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by action, table, record, or actor…"
        className="w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm"
      />

      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground border-b border-border">
            <tr>
              <th className="py-2">When</th>
              <th className="py-2">Actor</th>
              <th className="py-2">Action</th>
              <th className="py-2">Record</th>
              <th className="py-2">Note</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0 align-top">
                <td className="py-2 text-muted-foreground whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                <td className="py-2">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs mr-1 ${ACTOR_TYPE_CLASS[r.actor_type]}`}>
                    {r.actor_type}
                  </span>
                  <span className="font-mono text-xs">{r.actor_id ?? '—'}</span>
                </td>
                <td className="py-2 font-mono text-xs">{r.action}</td>
                <td className="py-2 text-xs">
                  {r.table_name ? (
                    <>
                      {r.table_name}
                      {r.record_id ? `:${r.record_id}` : ''}
                    </>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="py-2 text-xs text-muted-foreground">{r.note ?? '—'}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-center text-muted-foreground">
                  No audit entries match &quot;{search}&quot;.
                </td>
              </tr>
            )}
          </tbody>
        </table>
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
