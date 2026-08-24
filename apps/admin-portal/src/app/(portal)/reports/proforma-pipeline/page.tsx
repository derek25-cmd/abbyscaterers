'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSupabaseClient } from '@/lib/supabase-client';
import { DateRangeFilter, defaultDateRange, type DateRange } from '@/components/reports/date-range-filter';
import { exportToCsv } from '@/lib/csv-export';

interface Row {
  id: string;
  invoiceDate: string;
  reviewStatus: 'pending' | 'approved' | 'rejected';
  isInvoiced: boolean | null;
  isVoided: boolean | null;
  items: { total?: number }[] | null;
}

const STATUS_LABEL: Record<string, string> = { pending: 'Pending Review', approved: 'Approved', rejected: 'Rejected' };

export default function ProformaPipelineReportPage() {
  const supabase = useSupabaseClient();
  const [range, setRange] = useState<DateRange>(defaultDateRange());

  const query = useQuery({
    queryKey: ['report-proforma-pipeline', range.from, range.to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proforma_invoices')
        .select('id, "invoiceDate", "reviewStatus", "isInvoiced", "isVoided", items')
        .gte('invoiceDate', range.from)
        .lte('invoiceDate', range.to);
      if (error) throw error;
      return data as unknown as Row[];
    },
  });

  const summary = useMemo(() => {
    const rows = query.data ?? [];
    const byStatus: Record<string, { count: number; total: number }> = {
      pending: { count: 0, total: 0 },
      approved: { count: 0, total: 0 },
      rejected: { count: 0, total: 0 },
    };
    let invoicedCount = 0;
    for (const r of rows) {
      const total = (r.items ?? []).reduce((s, i) => s + (i.total ?? 0), 0);
      byStatus[r.reviewStatus].count += 1;
      byStatus[r.reviewStatus].total += total;
      if (r.isInvoiced) invoicedCount += 1;
    }
    const conversionRate = rows.length > 0 ? Math.round((invoicedCount / rows.length) * 1000) / 10 : 0;
    return { byStatus, total: rows.length, invoicedCount, conversionRate };
  }, [query.data]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Proforma Pipeline</h1>
          <p className="text-sm text-muted-foreground">Approval status and conversion to invoice, by period.</p>
        </div>
        <button
          type="button"
          onClick={() =>
            exportToCsv(
              `proforma-pipeline-${range.from}-to-${range.to}.csv`,
              ['Status', 'Count', 'Items Subtotal (TZS)'],
              Object.entries(summary.byStatus).map(([status, s]) => [STATUS_LABEL[status], s.count, s.total])
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
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(summary.byStatus).map(([status, s]) => (
              <div key={status} className="rounded-lg border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground">{STATUS_LABEL[status]}</p>
                <p className="text-2xl font-semibold mt-1">{s.count}</p>
                <p className="text-xs text-muted-foreground mt-1">TZS {s.total.toLocaleString()}</p>
              </div>
            ))}
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Conversion to Invoice</p>
              <p className="text-2xl font-semibold mt-1">{summary.conversionRate}%</p>
              <p className="text-xs text-muted-foreground mt-1">
                {summary.invoicedCount} of {summary.total} invoiced
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
