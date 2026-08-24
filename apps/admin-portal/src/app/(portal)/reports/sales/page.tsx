'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useSupabaseClient } from '@/lib/supabase-client';
import { computeInvoiceGrandTotal, type InvoiceTotalFields } from '@/lib/invoice-math';
import { DateRangeFilter, defaultDateRange, type DateRange } from '@/components/reports/date-range-filter';
import { exportToCsv } from '@/lib/csv-export';

interface Row extends InvoiceTotalFields {
  id: string;
  invoiceDate: string;
  clientId: string | null;
  clients: { companyName: string } | null;
  status: string;
}

export default function SalesReportPage() {
  const supabase = useSupabaseClient();
  const [range, setRange] = useState<DateRange>(defaultDateRange());

  const query = useQuery({
    queryKey: ['report-sales', range.from, range.to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, "invoiceDate", "clientId", clients(companyName), status, items, "serviceCharge", "transportCosts", "numberOfDays", "multiplyByDays", "vatType"')
        .gte('invoiceDate', range.from)
        .lte('invoiceDate', range.to)
        .order('invoiceDate', { ascending: false });
      if (error) throw error;
      return data as unknown as Row[];
    },
  });

  const rows = useMemo(
    () => (query.data ?? []).map((inv) => ({ ...inv, total: computeInvoiceGrandTotal(inv) })),
    [query.data]
  );
  const totalRevenue = rows.reduce((sum, r) => sum + r.total, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Sales / Revenue Report</h1>
          <p className="text-sm text-muted-foreground">Invoiced revenue by period.</p>
        </div>
        <button
          type="button"
          onClick={() =>
            exportToCsv(
              `sales-report-${range.from}-to-${range.to}.csv`,
              ['Invoice No.', 'Client', 'Date', 'Status', 'Total (TZS)'],
              rows.map((r) => [r.id, r.clients?.companyName ?? r.clientId ?? '', r.invoiceDate, r.status, r.total])
            )
          }
          className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted"
        >
          Export CSV
        </button>
      </div>

      <DateRangeFilter value={range} onChange={setRange} />

      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">Total Revenue</p>
        <p className="text-2xl font-semibold">TZS {totalRevenue.toLocaleString()}</p>
        <p className="text-xs text-muted-foreground mt-1">{rows.length} invoices</p>
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
              <th className="py-2">Status</th>
              <th className="py-2 text-right">Total</th>
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
                <td className="py-2">{r.status}</td>
                <td className="py-2 text-right">TZS {r.total.toLocaleString()}</td>
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
