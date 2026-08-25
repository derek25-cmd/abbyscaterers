'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useSupabaseClient } from '@/lib/supabase-client';
import { useIsMobile } from '@/hooks/use-mobile';
import { useRevealWindow } from '@/hooks/use-reveal-window';
import { computeInvoiceGrandTotal } from '@/lib/invoice-math';
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
import { InvoiceCard, type InvoiceCardData } from '@/components/invoices/invoice-card';
import { PullToRefresh } from '@/components/pwa/pull-to-refresh';
import { SortSheet } from '@/components/pwa/sort-sheet';
import { FilterSheet } from '@/components/pwa/filter-sheet';
import { LoadMoreButton } from '@/components/pwa/load-more-button';
import { SkeletonCards, SkeletonTableRows } from '@/components/pwa/skeleton-list';
import { Button } from '@/components/ui/button';
import { exportToCsv } from '@/lib/csv-export';
import { X } from 'lucide-react';

type InvoiceListItem = InvoiceCardData;

const STATUSES = ['outstanding', 'paid', 'partially paid'] as const;
type SortValue = 'date_desc' | 'date_asc';

const STATUS_LABEL: Record<string, string> = {
  outstanding: 'Outstanding',
  paid: 'Paid',
  'partially paid': 'Partially Paid',
};

const STATUS_CLASS: Record<string, string> = {
  outstanding: 'bg-destructive/10 text-destructive',
  paid: 'bg-emerald-100 text-emerald-800',
  'partially paid': 'bg-amber-100 text-amber-800',
};

export function InvoiceListTable() {
  const supabase = useSupabaseClient();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [sort, setSort] = useState<SortValue>('date_desc');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const invoicesQuery = useQuery({
    queryKey: ['invoices-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select(
          'id, "invoiceDate", "clientId", clients(companyName), status, items, "serviceCharge", "transportCosts", "numberOfDays", "multiplyByDays", "vatType"'
        )
        .order('invoiceDate', { ascending: false });
      if (error) throw error;
      return data as unknown as InvoiceListItem[];
    },
  });

  const invoices = useMemo(() => invoicesQuery.data ?? [], [invoicesQuery.data]);

  const filteredInvoices = useMemo(() => {
    let rows = invoices;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((inv) => {
        const client = inv.clients?.companyName ?? inv.clientId ?? '';
        return inv.id.toLowerCase().includes(q) || client.toLowerCase().includes(q);
      });
    }
    if (statusFilter.length > 0) {
      rows = rows.filter((inv) => statusFilter.includes(inv.status));
    }
    return rows;
  }, [invoices, search, statusFilter]);

  const sortedInvoices = useMemo(() => {
    const rows = [...filteredInvoices];
    rows.sort((a, b) =>
      sort === 'date_desc' ? b.invoiceDate.localeCompare(a.invoiceDate) : a.invoiceDate.localeCompare(b.invoiceDate)
    );
    return rows;
  }, [filteredInvoices, sort]);

  const { visibleItems, hasMore, loadMore } = useRevealWindow(sortedInvoices, 20);

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (next.size === 0) setSelectMode(false);
      return next;
    });
  };

  const exportSelected = () => {
    const rows = invoices.filter((inv) => selectedIds.has(inv.id));
    exportToCsv(
      `invoices-export-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Invoice No.', 'Client', 'Date', 'Status', 'Total (TZS)'],
      rows.map((inv) => [inv.id, inv.clients?.companyName ?? inv.clientId ?? '', inv.invoiceDate, inv.status, computeInvoiceGrandTotal(inv)])
    );
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  if (invoicesQuery.error) {
    return <p className="text-sm text-destructive">Failed to load invoices: {(invoicesQuery.error as Error).message}</p>;
  }

  return (
    <div className="space-y-3">
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by invoice number or client…"
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
                id={`invoice-status-${status}`}
                checked={statusFilter.includes(status)}
                onCheckedChange={(checked) =>
                  setStatusFilter((prev) => (checked ? [...prev, status] : prev.filter((s) => s !== status)))
                }
              />
              <Label htmlFor={`invoice-status-${status}`} className="font-normal">
                {STATUS_LABEL[status]}
              </Label>
            </div>
          ))}
        </FilterSheet>
      </div>

      {invoicesQuery.isLoading ? (
        isMobile ? <SkeletonCards /> : (
          <Table>
            <TableBody><SkeletonTableRows columns={5} /></TableBody>
          </Table>
        )
      ) : invoices.length === 0 ? (
        <p className="text-sm text-muted-foreground">No invoices yet.</p>
      ) : (
        <PullToRefresh onRefresh={async () => { await invoicesQuery.refetch(); }}>
          {isMobile ? (
            <div className="space-y-2">
              {visibleItems.map((inv) => (
                <InvoiceCard
                  key={inv.id}
                  invoice={inv}
                  selectMode={selectMode}
                  selected={selectedIds.has(inv.id)}
                  onEnterSelectMode={(id) => {
                    setSelectMode(true);
                    setSelectedIds(new Set([id]));
                  }}
                  onToggleSelected={toggleSelected}
                />
              ))}
              {filteredInvoices.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">No invoices match &quot;{search}&quot;.</p>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice No.</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Grand Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleItems.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-xs">
                      <Link href={`/invoices/${inv.id}`} className="text-primary hover:underline">
                        {inv.id}
                      </Link>
                    </TableCell>
                    <TableCell>{inv.clients?.companyName ?? inv.clientId ?? '—'}</TableCell>
                    <TableCell>{inv.invoiceDate}</TableCell>
                    <TableCell className="text-right">TZS {computeInvoiceGrandTotal(inv).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_CLASS[inv.status] ?? ''}>
                        {STATUS_LABEL[inv.status] ?? inv.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredInvoices.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No invoices match &quot;{search}&quot;.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
          {hasMore && <div className="pt-2"><LoadMoreButton onClick={loadMore} /></div>}
        </PullToRefresh>
      )}

      {selectMode && (
        <div className="fixed inset-x-0 bottom-14 z-30 flex items-center justify-between gap-2 border-t border-border bg-background p-3 md:hidden">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => {
              setSelectMode(false);
              setSelectedIds(new Set());
            }}
            aria-label="Cancel selection"
          >
            <X className="h-4 w-4" />
          </Button>
          <Button type="button" className="flex-1" disabled={selectedIds.size === 0} onClick={exportSelected}>
            Export {selectedIds.size} selected
          </Button>
        </div>
      )}
    </div>
  );
}
