'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useSupabaseClient } from '@/lib/supabase-client';

interface CostingRequestRow {
  id: string;
  rfq_id: string;
  status: 'pending' | 'fulfilled' | 'rejected';
  total_cost: number | null;
  total_revenue: number | null;
  gross_margin_pct: number | null;
  rejection_reason: string | null;
  requested_at: string;
  rfqs: { title: string } | null;
}

const STATUS_LABEL: Record<string, string> = { pending: 'Pending', fulfilled: 'Fulfilled', rejected: 'Rejected' };
const STATUS_CLASS: Record<string, string> = {
  pending: 'bg-secondary',
  fulfilled: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-destructive/10 text-destructive',
};

export function CostingListTable() {
  const supabase = useSupabaseClient();
  const [search, setSearch] = useState('');

  const requestsQuery = useQuery({
    queryKey: ['costing-requests-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('portal_costing_requests')
        .select('id, rfq_id, status, total_cost, total_revenue, gross_margin_pct, rejection_reason, requested_at, rfqs(title)')
        .order('requested_at', { ascending: false });
      if (error) throw error;
      return data as unknown as CostingRequestRow[];
    },
  });

  const filtered = useMemo(() => {
    const rows = requestsQuery.data ?? [];
    if (!search.trim()) return rows;
    const q = search.trim().toLowerCase();
    return rows.filter((r) => r.rfq_id.toLowerCase().includes(q) || (r.rfqs?.title ?? '').toLowerCase().includes(q));
  }, [requestsQuery.data, search]);

  if (requestsQuery.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (requestsQuery.error) {
    return <p className="text-sm text-destructive">Failed to load costing requests: {(requestsQuery.error as Error).message}</p>;
  }
  if (!requestsQuery.data || requestsQuery.data.length === 0) {
    return <p className="text-sm text-muted-foreground">No costing requests yet. Request one from an RFQ&apos;s detail page.</p>;
  }

  return (
    <div className="space-y-3">
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by RFQ ID or title…"
        className="w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
      <table className="w-full text-sm">
        <thead className="text-left text-muted-foreground border-b border-border">
          <tr>
            <th className="py-2">RFQ</th>
            <th className="py-2">Requested</th>
            <th className="py-2">Status</th>
            <th className="py-2 text-right">Total Cost</th>
            <th className="py-2 text-right">Revenue</th>
            <th className="py-2 text-right">Margin</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((r) => (
            <tr key={r.id} className="border-b border-border last:border-0">
              <td className="py-2">
                <Link href={`/rfqs/${r.rfq_id}`} className="text-primary hover:underline">
                  {r.rfqs?.title ?? r.rfq_id}
                </Link>
                <div className="text-xs text-muted-foreground font-mono">{r.rfq_id}</div>
              </td>
              <td className="py-2">{new Date(r.requested_at).toLocaleDateString()}</td>
              <td className="py-2">
                <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${STATUS_CLASS[r.status]}`}>
                  {STATUS_LABEL[r.status]}
                </span>
                {r.status === 'rejected' && r.rejection_reason && (
                  <p className="text-xs text-muted-foreground mt-1">{r.rejection_reason}</p>
                )}
              </td>
              <td className="py-2 text-right">{r.total_cost != null ? `TZS ${r.total_cost.toLocaleString()}` : '—'}</td>
              <td className="py-2 text-right">{r.total_revenue != null ? `TZS ${r.total_revenue.toLocaleString()}` : '—'}</td>
              <td className="py-2 text-right">{r.gross_margin_pct != null ? `${r.gross_margin_pct}%` : '—'}</td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={6} className="py-4 text-center text-muted-foreground">
                No costing requests match &quot;{search}&quot;.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
