'use client';

import { useMemo, useState } from 'react';
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
}

export default function CustomerPerformancePage() {
  const supabase = useSupabaseClient();
  const [range, setRange] = useState<DateRange>(defaultDateRange());

  const query = useQuery({
    queryKey: ['report-customers', range.from, range.to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, "invoiceDate", "clientId", clients(companyName), items, "serviceCharge", "transportCosts", "numberOfDays", "multiplyByDays", "vatType"')
        .gte('invoiceDate', range.from)
        .lte('invoiceDate', range.to);
      if (error) throw error;
      return data as unknown as Row[];
    },
  });

  const byClient = useMemo(() => {
    const map = new Map<string, { name: string; revenue: number; count: number }>();
    for (const inv of query.data ?? []) {
      const key = inv.clientId ?? 'unknown';
      const name = inv.clients?.companyName ?? inv.clientId ?? 'Unknown';
      const existing = map.get(key) ?? { name, revenue: 0, count: 0 };
      existing.revenue += computeInvoiceGrandTotal(inv);
      existing.count += 1;
      map.set(key, existing);
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [query.data]);

  const maxRevenue = Math.max(1, ...byClient.map((c) => c.revenue));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Customer Performance</h1>
          <p className="text-sm text-muted-foreground">Top clients by revenue and invoice frequency.</p>
        </div>
        <button
          type="button"
          onClick={() =>
            exportToCsv(
              `customer-performance-${range.from}-to-${range.to}.csv`,
              ['Client', 'Revenue (TZS)', 'Invoices'],
              byClient.map((c) => [c.name, c.revenue, c.count])
            )
          }
          className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted"
        >
          Export CSV
        </button>
      </div>

      <DateRangeFilter value={range} onChange={setRange} />

      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="rounded-lg border border-border bg-card p-4 space-y-2">
          {byClient.map((c) => (
            <div key={c.name} className="flex items-center gap-3 text-sm">
              <span className="w-40 truncate shrink-0">{c.name}</span>
              <div className="flex-1 bg-muted rounded h-4 overflow-hidden">
                <div className="bg-primary h-full" style={{ width: `${(c.revenue / maxRevenue) * 100}%` }} />
              </div>
              <span className="w-32 text-right shrink-0">TZS {c.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              <span className="w-20 text-right text-muted-foreground shrink-0">{c.count} inv.</span>
            </div>
          ))}
          {byClient.length === 0 && <p className="text-sm text-muted-foreground">No invoices in this period.</p>}
        </div>
      )}
    </div>
  );
}
