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

interface ProformaListItem {
  id: string;
  invoiceDate: string;
  clientId: string | null;
  clients: { companyName: string } | null;
  items: { total?: number }[] | null;
  reviewStatus: 'pending' | 'approved' | 'rejected';
  isInvoiced: boolean | null;
  isVoided: boolean | null;
}

const STATUS_LABEL: Record<string, string> = { pending: 'Pending Review', approved: 'Approved', rejected: 'Rejected' };
const STATUS_CLASS: Record<string, string> = {
  pending: 'bg-secondary',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-destructive/10 text-destructive',
};

export function ProformaListTable() {
  const supabase = useSupabaseClient();
  const [search, setSearch] = useState('');

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
    if (!search.trim()) return proformas;
    const q = search.trim().toLowerCase();
    return proformas.filter((p) => {
      const client = p.clients?.companyName ?? p.clientId ?? '';
      return p.id.toLowerCase().includes(q) || client.toLowerCase().includes(q);
    });
  }, [proformas, search]);

  if (query.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (query.error) {
    return <p className="text-sm text-destructive">Failed to load proformas: {(query.error as Error).message}</p>;
  }
  if (proformas.length === 0) {
    return <p className="text-sm text-muted-foreground">No proformas yet.</p>;
  }

  return (
    <div className="space-y-3">
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by proforma number or client…"
        className="max-w-sm"
      />
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
          {filtered.map((p) => {
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
    </div>
  );
}
