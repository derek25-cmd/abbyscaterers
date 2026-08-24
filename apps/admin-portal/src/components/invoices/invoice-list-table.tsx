'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useSupabaseClient } from '@/lib/supabase-client';
import { computeInvoiceGrandTotal, type InvoiceTotalFields } from '@/lib/invoice-math';

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
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by invoice number or client…"
        className="w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
      <table className="w-full text-sm">
        <thead className="text-left text-muted-foreground border-b border-border">
          <tr>
            <th className="py-2">Invoice No.</th>
            <th className="py-2">Client</th>
            <th className="py-2">Date</th>
            <th className="py-2 text-right">Grand Total</th>
            <th className="py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {filteredInvoices.map((inv) => (
            <tr key={inv.id} className="border-b border-border last:border-0">
              <td className="py-2 font-mono text-xs">
                <Link href={`/invoices/${inv.id}`} className="text-primary hover:underline">
                  {inv.id}
                </Link>
              </td>
              <td className="py-2">{inv.clients?.companyName ?? inv.clientId ?? '—'}</td>
              <td className="py-2">{inv.invoiceDate}</td>
              <td className="py-2 text-right">TZS {computeInvoiceGrandTotal(inv).toLocaleString()}</td>
              <td className="py-2">
                <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${STATUS_CLASS[inv.status] ?? ''}`}>
                  {STATUS_LABEL[inv.status] ?? inv.status}
                </span>
              </td>
            </tr>
          ))}
          {filteredInvoices.length === 0 && (
            <tr>
              <td colSpan={5} className="py-4 text-center text-muted-foreground">
                No invoices match &quot;{search}&quot;.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
