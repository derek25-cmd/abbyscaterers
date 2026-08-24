'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useSupabaseClient } from '@/lib/supabase-client';
import { DateRangeFilter, defaultDateRange, type DateRange } from '@/components/reports/date-range-filter';
import { exportToCsv } from '@/lib/csv-export';

interface Row {
  id: string;
  invoiceDate: string;
  clientId: string | null;
  clients: { companyName: string } | null;
  items: { total?: number }[] | null;
  serviceCharge: number | null;
  transportCosts: number | null;
  numberOfDays: number | null;
  multiplyByDays: boolean | null;
  vatType: 'inclusive' | 'exclusive';
}

// Same VAT decomposition as invoice-detail.tsx: exclusive adds VAT on top,
// inclusive backs it out of the total rather than showing 0.
function computeVat(inv: Row, vatRate: number) {
  const subtotal = (inv.items ?? []).reduce((sum, item) => sum + (item.total ?? 0), 0);
  const totalForDays = inv.multiplyByDays ? subtotal * (inv.numberOfDays || 1) : subtotal;
  const totalBeforeVat = totalForDays + (inv.serviceCharge ?? 0) + (inv.transportCosts ?? 0);
  if (inv.vatType === 'exclusive') {
    const vat = totalBeforeVat * (vatRate / 100);
    return { totalBeforeVat, vat, grandTotal: totalBeforeVat + vat };
  }
  const net = totalBeforeVat / (1 + vatRate / 100);
  return { totalBeforeVat: net, vat: totalBeforeVat - net, grandTotal: totalBeforeVat };
}

export default function VatReportPage() {
  const supabase = useSupabaseClient();
  const [range, setRange] = useState<DateRange>(defaultDateRange());

  const ratesQuery = useQuery({
    queryKey: ['invoice-tax-rates'],
    queryFn: async () => {
      const { data, error } = await supabase.from('invoice_tax_rates').select('tax_type, rate');
      if (error) throw error;
      return data as { tax_type: string; rate: number }[];
    },
  });
  const vatRate = ratesQuery.data?.find((r) => r.tax_type === 'vat')?.rate ?? 18;

  const query = useQuery({
    queryKey: ['report-vat', range.from, range.to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, "invoiceDate", "clientId", clients(companyName), items, "serviceCharge", "transportCosts", "numberOfDays", "multiplyByDays", "vatType"')
        .gte('invoiceDate', range.from)
        .lte('invoiceDate', range.to)
        .order('invoiceDate', { ascending: false });
      if (error) throw error;
      return data as unknown as Row[];
    },
  });

  const rows = useMemo(() => (query.data ?? []).map((inv) => ({ ...inv, ...computeVat(inv, vatRate) })), [query.data, vatRate]);
  const totalVat = rows.reduce((sum, r) => sum + r.vat, 0);
  const totalBase = rows.reduce((sum, r) => sum + r.totalBeforeVat, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">VAT Report</h1>
          <p className="text-sm text-muted-foreground">Output VAT from invoices (rate: {vatRate}%).</p>
        </div>
        <button
          type="button"
          onClick={() =>
            exportToCsv(
              `vat-report-${range.from}-to-${range.to}.csv`,
              ['Invoice No.', 'Client', 'Date', 'Base (TZS)', 'VAT (TZS)'],
              rows.map((r) => [r.id, r.clients?.companyName ?? r.clientId ?? '', r.invoiceDate, r.totalBeforeVat, r.vat])
            )
          }
          className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted"
        >
          Export CSV
        </button>
      </div>

      <DateRangeFilter value={range} onChange={setRange} />

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Taxable Base</p>
          <p className="text-2xl font-semibold">TZS {totalBase.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Output VAT</p>
          <p className="text-2xl font-semibold">TZS {totalVat.toLocaleString()}</p>
        </div>
      </div>

      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground border-b border-border">
            <tr>
              <th className="py-2">Invoice No.</th>
              <th className="py-2">Client</th>
              <th className="py-2">Date</th>
              <th className="py-2 text-right">Base</th>
              <th className="py-2 text-right">VAT</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0">
                <td className="py-2 font-mono text-xs">
                  <Link href={`/invoices/${r.id}`} className="text-primary hover:underline">
                    {r.id}
                  </Link>
                </td>
                <td className="py-2">{r.clients?.companyName ?? r.clientId ?? '—'}</td>
                <td className="py-2">{r.invoiceDate}</td>
                <td className="py-2 text-right">TZS {r.totalBeforeVat.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                <td className="py-2 text-right">TZS {r.vat.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-center text-muted-foreground">
                  No invoices in this period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
