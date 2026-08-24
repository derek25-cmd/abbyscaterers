'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useSupabaseClient } from '@/lib/supabase-client';
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
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by RFQ ID or title…"
        className="max-w-sm"
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>RFQ</TableHead>
            <TableHead>Requested</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Total Cost</TableHead>
            <TableHead className="text-right">Revenue</TableHead>
            <TableHead className="text-right">Margin</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((r) => (
            <TableRow key={r.id}>
              <TableCell>
                <Link href={`/rfqs/${r.rfq_id}`} className="text-primary hover:underline">
                  {r.rfqs?.title ?? r.rfq_id}
                </Link>
                <div className="text-xs text-muted-foreground font-mono">{r.rfq_id}</div>
              </TableCell>
              <TableCell>{new Date(r.requested_at).toLocaleDateString()}</TableCell>
              <TableCell>
                <Badge variant="outline" className={STATUS_CLASS[r.status]}>
                  {STATUS_LABEL[r.status]}
                </Badge>
                {r.status === 'rejected' && r.rejection_reason && (
                  <p className="text-xs text-muted-foreground mt-1">{r.rejection_reason}</p>
                )}
              </TableCell>
              <TableCell className="text-right">{r.total_cost != null ? `TZS ${r.total_cost.toLocaleString()}` : '—'}</TableCell>
              <TableCell className="text-right">{r.total_revenue != null ? `TZS ${r.total_revenue.toLocaleString()}` : '—'}</TableCell>
              <TableCell className="text-right">{r.gross_margin_pct != null ? `${r.gross_margin_pct}%` : '—'}</TableCell>
            </TableRow>
          ))}
          {filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                No costing requests match &quot;{search}&quot;.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
