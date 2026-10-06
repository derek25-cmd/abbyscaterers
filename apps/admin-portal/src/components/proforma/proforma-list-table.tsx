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
import { ProformaCard, type ProformaCardData } from '@/components/proforma/proforma-card';
import { PullToRefresh } from '@/components/pwa/pull-to-refresh';
import { SortSheet } from '@/components/pwa/sort-sheet';
import { FilterSheet } from '@/components/pwa/filter-sheet';
import { LoadMoreButton } from '@/components/pwa/load-more-button';
import { SkeletonCards, SkeletonTableRows } from '@/components/pwa/skeleton-list';

type ProformaListItem = ProformaCardData;

const REVIEW_STATUSES = ['pending', 'approved', 'rejected'] as const;
type SortValue = 'date_desc' | 'date_asc';

const STATUS_LABEL: Record<string, string> = { pending: 'Pending Review', approved: 'Approved', rejected: 'Rejected' };
const STATUS_CLASS: Record<string, string> = {
  pending: 'bg-secondary',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-destructive/10 text-destructive',
};

export function ProformaListTable() {
  const supabase = useSupabaseClient();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [sort, setSort] = useState<SortValue>('date_desc');

  const query = useQuery({
    queryKey: ['proformas-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proforma_invoices')
        .select('id, "invoiceDate", "clientId", clients(companyName), items, "reviewStatus", "isInvoiced", "isVoided"')
        .order('invoiceDate', { ascending: false });
      if (error) throw error;
      return data as unknown as ProformaListItem[];
    },
  });

  const proformas = useMemo(() => query.data ?? [], [query.data]);

  const filtered = useMemo(() => {
    let rows = proformas;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((p) => {
        const client = p.clients?.companyName ?? p.clientId ?? '';
        return p.id.toLowerCase().includes(q) || client.toLowerCase().includes(q);
      });
    }
    if (statusFilter.length > 0) {
      rows = rows.filter((p) => statusFilter.includes(p.reviewStatus));
    }
    return rows;
  }, [proformas, search, statusFilter]);

  const sorted = useMemo(() => {
    const rows = [...filtered];
    rows.sort((a, b) => (sort === 'date_desc' ? b.invoiceDate.localeCompare(a.invoiceDate) : a.invoiceDate.localeCompare(b.invoiceDate)));
    return rows;
  }, [filtered, sort]);

  const { visibleItems, hasMore, loadMore } = useRevealWindow(sorted, 20);

  if (query.error) {
    return <p className="text-sm text-destructive">Failed to load proformas: {(query.error as Error).message}</p>;
  }

  return (
    <div className="space-y-3">
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by proforma number or client…"
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
          {REVIEW_STATUSES.map((status) => (
            <div key={status} className="flex items-center gap-2 rounded-md p-2">
              <Checkbox
                id={`proforma-status-${status}`}
                checked={statusFilter.includes(status)}
                onCheckedChange={(checked) =>
                  setStatusFilter((prev) => (checked ? [...prev, status] : prev.filter((s) => s !== status)))
                }
              />
              <Label htmlFor={`proforma-status-${status}`} className="font-normal">
                {STATUS_LABEL[status]}
              </Label>
            </div>
          ))}
        </FilterSheet>
      </div>

      {query.isLoading ? (
        isMobile ? <SkeletonCards /> : (
          <Table>
            <TableBody><SkeletonTableRows columns={5} /></TableBody>
          </Table>
        )
      ) : proformas.length === 0 ? (
        <p className="text-sm text-muted-foreground">No proformas yet.</p>
      ) : (
        <PullToRefresh onRefresh={async () => { await query.refetch(); }}>
          {isMobile ? (
            <div className="space-y-2">
              {visibleItems.map((p) => (
                <ProformaCard key={p.id} proforma={p} />
              ))}
              {filtered.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">No proformas match &quot;{search}&quot;.</p>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Proforma No.</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleItems.map((p) => {
                  const subtotal = (p.items ?? []).reduce((sum, item) => sum + (item.total ?? 0), 0);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">
                        <Link href={`/proformas/${p.id}`} className="text-primary hover:underline">
                          {p.id}
                        </Link>
                      </TableCell>
                      <TableCell>{p.clients?.companyName ?? p.clientId ?? '—'}</TableCell>
                      <TableCell>{p.invoiceDate}</TableCell>
                      <TableCell className="text-right">TZS {subtotal.toLocaleString()}</TableCell>
                      <TableCell className="flex flex-wrap gap-1">
                        <Badge variant="outline" className={STATUS_CLASS[p.reviewStatus]}>
                          {STATUS_LABEL[p.reviewStatus]}
                        </Badge>
                        {p.isVoided && (
                          <Badge variant="outline" className="bg-destructive/10 text-destructive">
                            Uninvoiced
                          </Badge>
                        )}
                        {p.isInvoiced && !p.isVoided && <Badge variant="secondary">Invoiced</Badge>}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No proformas match &quot;{search}&quot;.
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
