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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

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
  const [, setLiveTick] = useState(0);
  const [search, setSearch] = useState('');

  const { data: rfqs, isLoading, error } = useQuery({
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
    if (!search.trim()) return rfqs ?? [];
    const q = search.trim().toLowerCase();
    return (rfqs ?? []).filter((r) => {
      const client = r.clients?.companyName ?? r.client_name_freetext ?? r.client_id ?? '';
      return r.id.toLowerCase().includes(q) || r.title.toLowerCase().includes(q) || client.toLowerCase().includes(q);
    });
  }, [rfqs, search]);

  const table = useReactTable({
    data: filteredRfqs,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading RFQs…</p>;
  if (error) return <p className="text-sm text-destructive">Failed to load RFQs: {(error as Error).message}</p>;
  if (!rfqs || rfqs.length === 0) {
    return <p className="text-sm text-muted-foreground">No RFQs yet. Create the first one.</p>;
  }

  return (
    <div className="space-y-3">
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by ID, title, or client…"
        className="max-w-sm"
      />
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
