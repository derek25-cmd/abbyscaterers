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
import { useSupabaseClient } from '@/lib/supabase-client';

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
    cell: (c) => (
      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{c.getValue<string>()}</span>
    ),
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
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by ID, title, or client…"
        className="w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
      <div className="rounded-lg border border-border bg-card overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b border-border text-left text-muted-foreground">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id} className="p-3 font-medium">
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="border-b border-border last:border-0 hover:bg-muted/40">
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="p-3">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
          {filteredRfqs.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="p-4 text-center text-muted-foreground">
                No RFQs match &quot;{search}&quot;.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}

export function NewRfqLink() {
  return (
    <Link
      href="/rfqs/new"
      className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90"
    >
      New RFQ
    </Link>
  );
}
