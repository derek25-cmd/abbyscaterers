'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useSupabaseClient } from '@/lib/supabase-client';
import { useIsMobile } from '@/hooks/use-mobile';
import { useRevealWindow } from '@/hooks/use-reveal-window';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { CostingCard, type CostingCardData } from '@/components/costing/costing-card';
import { PullToRefresh } from '@/components/pwa/pull-to-refresh';
import { SortSheet } from '@/components/pwa/sort-sheet';
import { FilterSheet } from '@/components/pwa/filter-sheet';
import { LoadMoreButton } from '@/components/pwa/load-more-button';
import { SkeletonCards, SkeletonTableRows } from '@/components/pwa/skeleton-list';

type CostingRequestRow = CostingCardData;

const STATUSES = ['pending', 'fulfilled', 'rejected'] as const;
type SortValue = 'date_desc' | 'date_asc';

const STATUS_LABEL: Record<string, string> = { pending: 'Pending', fulfilled: 'Fulfilled', rejected: 'Rejected' };
const STATUS_CLASS: Record<string, string> = {
  pending: 'bg-secondary',
  fulfilled: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-destructive/10 text-destructive',
};

export function CostingListTable() {
  const supabase = useSupabaseClient();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [sort, setSort] = useState<SortValue>('date_desc');

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
    let rows = requestsQuery.data ?? [];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((r) => r.rfq_id.toLowerCase().includes(q) || (r.rfqs?.title ?? '').toLowerCase().includes(q));
    }
    if (statusFilter.length > 0) {
      rows = rows.filter((r) => statusFilter.includes(r.status));
    }
    return rows;
  }, [requestsQuery.data, search, statusFilter]);

  const sorted = useMemo(() => {
    const rows = [...filtered];
    rows.sort((a, b) =>
      sort === 'date_desc' ? b.requested_at.localeCompare(a.requested_at) : a.requested_at.localeCompare(b.requested_at)
    );
    return rows;
  }, [filtered, sort]);

  const { visibleItems, hasMore, loadMore } = useRevealWindow(sorted, 20);

  if (requestsQuery.error) {
    return <p className="text-sm text-destructive">Failed to load costing requests: {(requestsQuery.error as Error).message}</p>;
  }

  return (
    <div className="space-y-3">
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by RFQ ID or title…"
        className="max-w-sm"
      />
      <div className="flex flex-wrap gap-2">
        <SortSheet
          value={sort}
          onChange={setSort}
          options={[
            { value: 'date_desc', label: 'Newest first' },
            { value: 'date_asc', label: 'Oldest first' },
          ]}
        />
        <FilterSheet activeCount={statusFilter.length} onClear={() => setStatusFilter([])}>
          {STATUSES.map((status) => (
            <div key={status} className="flex items-center gap-2 rounded-md p-2">
              <Checkbox
                id={`costing-status-${status}`}
                checked={statusFilter.includes(status)}
                onCheckedChange={(checked) =>
                  setStatusFilter((prev) => (checked ? [...prev, status] : prev.filter((s) => s !== status)))
                }
              />
              <Label htmlFor={`costing-status-${status}`} className="font-normal">
                {STATUS_LABEL[status]}
              </Label>
            </div>
          ))}
        </FilterSheet>
      </div>

      {requestsQuery.isLoading ? (
        isMobile ? <SkeletonCards /> : (
          <Table>
            <TableBody><SkeletonTableRows columns={6} /></TableBody>
          </Table>
        )
      ) : !requestsQuery.data || requestsQuery.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No costing requests yet. Request one from an RFQ&apos;s detail page.</p>
      ) : (
        <PullToRefresh onRefresh={async () => { await requestsQuery.refetch(); }}>
          {isMobile ? (
            <div className="space-y-2">
              {visibleItems.map((r) => (
                <CostingCard key={r.id} request={r} />
              ))}
              {filtered.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">No costing requests match &quot;{search}&quot;.</p>
              )}
            </div>
          ) : (
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
                {visibleItems.map((r) => (
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
          )}
          {hasMore && <div className="pt-2"><LoadMoreButton onClick={loadMore} /></div>}
        </PullToRefresh>
      )}
    </div>
  );
}
