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
  target_event_date: string | null;
  branch: string | null;
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
  { accessorKey: 'title', header: 'Title' },
  {
    id: 'client',
    header: 'Client',
    accessorFn: (row) => row.client_name_freetext ?? row.client_id ?? '—',
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: (c) => (
      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{c.getValue<string>()}</span>
    ),
  },
  { accessorKey: 'branch', header: 'Branch', cell: (c) => c.getValue<string>() ?? '—' },
  {
    accessorKey: 'target_event_date',
    header: 'Target date',
    cell: (c) => c.getValue<string>() ?? '—',
  },
];

export function RfqListTable() {
  const supabase = useSupabaseClient();
  const queryClient = useQueryClient();
  const [, setLiveTick] = useState(0);

  const { data: rfqs, isLoading, error } = useQuery({
    queryKey: ['rfqs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rfqs')
        .select('id, title, status, client_name_freetext, client_id, target_event_date, branch, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as RfqRow[];
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

  const table = useReactTable({
    data: useMemo(() => rfqs ?? [], [rfqs]),
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading RFQs…</p>;
  if (error) return <p className="text-sm text-destructive">Failed to load RFQs: {(error as Error).message}</p>;
  if (!rfqs || rfqs.length === 0) {
    return <p className="text-sm text-muted-foreground">No RFQs yet. Create the first one.</p>;
  }

  return (
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
        </tbody>
      </table>
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
