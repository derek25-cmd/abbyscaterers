'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { PlusCircle } from 'lucide-react';
import { useSupabaseClient } from '@/lib/supabase-client';
import { useIsMobile } from '@/hooks/use-mobile';
import { useRevealWindow } from '@/hooks/use-reveal-window';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { RfqCard } from '@/components/rfq/rfq-card';
import { PullToRefresh } from '@/components/pwa/pull-to-refresh';
import { SortSheet } from '@/components/pwa/sort-sheet';
import { FilterSheet } from '@/components/pwa/filter-sheet';
import { LoadMoreButton } from '@/components/pwa/load-more-button';
import { SkeletonCards, SkeletonTableRows } from '@/components/pwa/skeleton-list';

const STATUSES = ['draft', 'submitted', 'in_review', 'proforma_created', 'approved', 'closed', 'cancelled'] as const;
type SortValue = 'date_desc' | 'date_asc';

interface RfqRow {
  id: string;
  title: string;
  status: string;
  client_name_freetext: string | null;
  client_id: string | null;
  clients: { companyName: string } | null;
  service_start_date: string | null;
  service_end_date: string | null;
  target_event_date: string | null;
  location: string | null;
  region: string | null;
  created_at: string;
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'outline',
  submitted: 'secondary',
  in_review: 'secondary',
  proforma_created: 'default',
  approved: 'default',
  closed: 'outline',
  cancelled: 'destructive',
};

const columns: ColumnDef<RfqRow>[] = [
  {
    accessorKey: 'id',
    header: 'ID',
    cell: (c) => (
      <Link href={`/rfqs/${c.getValue<string>()}`} className="font-mono text-xs text-primary hover:underline">
        {c.getValue<string>()}
      </Link>
    ),
  },
  {
    accessorKey: 'created_at',
    header: 'Issue Date',
    cell: (c) => new Date(c.getValue<string>()).toLocaleDateString(),
  },
  { accessorKey: 'title', header: 'Title' },
  {
    id: 'client',
    header: 'Client',
    accessorFn: (row) => row.clients?.companyName ?? row.client_name_freetext ?? row.client_id ?? '—',
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: (c) => {
      const status = c.getValue<string>();
      return <Badge variant={STATUS_VARIANT[status] ?? 'outline'}>{status}</Badge>;
    },
  },
  {
    id: 'servicePeriod',
    header: 'Service period',
    accessorFn: (row) =>
      row.service_start_date && row.service_end_date
        ? `${row.service_start_date} – ${row.service_end_date}`
        : row.target_event_date ?? '—',
  },
  { accessorKey: 'region', header: 'Region', cell: (c) => c.getValue<string>() ?? '—' },
];

export function RfqListTable() {
  const supabase = useSupabaseClient();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [, setLiveTick] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [sort, setSort] = useState<SortValue>('date_desc');

  const { data: rfqs, isLoading, error, refetch } = useQuery({
    queryKey: ['rfqs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rfqs')
        .select(
          'id, title, status, client_name_freetext, client_id, clients(companyName), service_start_date, service_end_date, target_event_date, location, region, created_at'
        )
        .order('created_at', { ascending: false });
      if (error) throw error;
      // Supabase's untyped client infers every embedded relation as an
      // array regardless of actual cardinality — clients(companyName) is
      // a many-to-one (rfqs.client_id -> clients.id) and is a single
      // object at runtime. unknown-cast per TS's own suggestion.
      return (data ?? []) as unknown as RfqRow[];
    },
  });

  // Proves the Supabase Realtime requirement end-to-end: any insert/update/
  // delete on rfqs (this tab, another tab, or the SQL editor) refetches the
  // list without a manual page refresh.
  useEffect(() => {
    const channel = supabase
      .channel('rfqs-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rfqs' }, () => {
        setLiveTick((t) => t + 1);
        queryClient.invalidateQueries({ queryKey: ['rfqs'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, queryClient]);

  const filteredRfqs = useMemo(() => {
    let rows = rfqs ?? [];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((r) => {
        const client = r.clients?.companyName ?? r.client_name_freetext ?? r.client_id ?? '';
        return r.id.toLowerCase().includes(q) || r.title.toLowerCase().includes(q) || client.toLowerCase().includes(q);
      });
    }
    if (statusFilter.length > 0) {
      rows = rows.filter((r) => statusFilter.includes(r.status));
    }
    return rows;
  }, [rfqs, search, statusFilter]);

  const sortedRfqs = useMemo(() => {
    const rows = [...filteredRfqs];
    rows.sort((a, b) =>
      sort === 'date_desc'
        ? b.created_at.localeCompare(a.created_at)
        : a.created_at.localeCompare(b.created_at)
    );
    return rows;
  }, [filteredRfqs, sort]);

  const { visibleItems, hasMore, loadMore } = useRevealWindow(sortedRfqs, 20);

  const table = useReactTable({
    data: visibleItems,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (error) return <p className="text-sm text-destructive">Failed to load RFQs: {(error as Error).message}</p>;

  return (
    <div className="space-y-3">
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by ID, title, or client…"
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
                id={`rfq-status-${status}`}
                checked={statusFilter.includes(status)}
                onCheckedChange={(checked) =>
                  setStatusFilter((prev) => (checked ? [...prev, status] : prev.filter((s) => s !== status)))
                }
              />
              <Label htmlFor={`rfq-status-${status}`} className="font-normal capitalize">
                {status.replace(/_/g, ' ')}
              </Label>
            </div>
          ))}
        </FilterSheet>
      </div>

      {isLoading ? (
        isMobile ? <SkeletonCards /> : (
          <div className="rounded-md border shadow-sm bg-card">
            <Table>
              <TableBody><SkeletonTableRows columns={columns.length} /></TableBody>
            </Table>
          </div>
        )
      ) : !rfqs || rfqs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No RFQs yet. Create the first one.</p>
      ) : (
        <PullToRefresh onRefresh={async () => { await refetch(); }}>
          {isMobile ? (
            <div className="space-y-2">
              {visibleItems.map((rfq) => (
                <RfqCard key={rfq.id} rfq={rfq} />
              ))}
              {filteredRfqs.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">No RFQs match &quot;{search}&quot;.</p>
              )}
            </div>
          ) : (
            <div className="rounded-md border shadow-sm bg-card">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableHead key={header.id}>
                          {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                  {filteredRfqs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                        No RFQs match &quot;{search}&quot;.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
          {hasMore && <div className="pt-2"><LoadMoreButton onClick={loadMore} /></div>}
        </PullToRefresh>
      )}
    </div>
  );
}

export function NewRfqLink() {
  return (
    <Button asChild>
      <Link href="/rfqs/new">
        <PlusCircle className="mr-2 h-4 w-4" />
        New RFQ
      </Link>
    </Button>
  );
}
