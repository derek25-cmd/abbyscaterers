'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useSupabaseClient } from '@/lib/supabase-client';

interface InvoiceListItem {
  id: string;
  invoiceDate: string;
  clientId: string | null;
  clients: { companyName: string } | null;
  status: 'outstanding' | 'paid' | 'partially paid';
  items: { total?: number }[] | null;
  serviceCharge: number | null;
  transportCosts: number | null;
  numberOfDays: number | null;
  multiplyByDays: boolean | null;
  vatType: 'inclusive' | 'exclusive';
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

// Same grand-total shape as apps/catering-system/src/lib/utils.ts's
// calculateGrandTotal — just enough for a list-row figure; the full,
// tax-rate-aware breakdown lives in invoice-detail.tsx.
function grandTotal(inv: InvoiceListItem): number {
  const subtotal = (inv.items ?? []).reduce((sum, item) => sum + (item.total ?? 0), 0);
  const totalForDays = inv.multiplyByDays ? subtotal * (inv.numberOfDays || 1) : subtotal;
  const totalBeforeVat = totalForDays + (inv.serviceCharge ?? 0) + (inv.transportCosts ?? 0);
  if (inv.vatType === 'exclusive') return totalBeforeVat * 1.18;
  return totalBeforeVat;
}

export function InvoiceListTable() {
  const supabase = useSupabaseClient();

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

  if (invoicesQuery.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (invoicesQuery.error) {
    return <p className="text-sm text-destructive">Failed to load invoices: {(invoicesQuery.error as Error).message}</p>;
  }
  const invoices = invoicesQuery.data ?? [];

  if (invoices.length === 0) {
    return <p className="text-sm text-muted-foreground">No invoices yet.</p>;
  }

  return (
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
        {invoices.map((inv) => (
          <tr key={inv.id} className="border-b border-border last:border-0">
            <td className="py-2 font-mono text-xs">
              <Link href={`/invoices/${inv.id}`} className="text-primary hover:underline">
                {inv.id}
              </Link>
            </td>
            <td className="py-2">{inv.clients?.companyName ?? inv.clientId ?? '—'}</td>
            <td className="py-2">{inv.invoiceDate}</td>
            <td className="py-2 text-right">TZS {grandTotal(inv).toLocaleString()}</td>
            <td className="py-2">
              <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${STATUS_CLASS[inv.status] ?? ''}`}>
                {STATUS_LABEL[inv.status] ?? inv.status}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
