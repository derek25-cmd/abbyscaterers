'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useSupabaseClient } from '@/lib/supabase-client';
import { computeInvoiceGrandTotal, type InvoiceTotalFields } from '@/lib/invoice-math';
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

interface InvoiceListItem extends InvoiceTotalFields {
  id: string;
  invoiceDate: string;
  clientId: string | null;
  clients: { companyName: string } | null;
  status: 'outstanding' | 'paid' | 'partially paid';
}

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
  const [search, setSearch] = useState('');

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
    if (!search.trim()) return invoices;
    const q = search.trim().toLowerCase();
    return invoices.filter((inv) => {
      const client = inv.clients?.companyName ?? inv.clientId ?? '';
      return inv.id.toLowerCase().includes(q) || client.toLowerCase().includes(q);
    });
  }, [invoices, search]);

  if (invoicesQuery.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (invoicesQuery.error) {
    return <p className="text-sm text-destructive">Failed to load invoices: {(invoicesQuery.error as Error).message}</p>;
  }

  if (invoices.length === 0) {
    return <p className="text-sm text-muted-foreground">No invoices yet.</p>;
  }

  return (
    <div className="space-y-3">
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by invoice number or client…"
        className="max-w-sm"
      />
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
          {filteredInvoices.map((inv) => (
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
    </div>
  );
}
