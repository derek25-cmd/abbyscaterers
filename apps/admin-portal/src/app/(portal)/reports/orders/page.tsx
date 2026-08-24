'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSupabaseClient } from '@/lib/supabase-client';
import { DateRangeFilter, defaultDateRange, type DateRange } from '@/components/reports/date-range-filter';
import { exportToCsv } from '@/lib/csv-export';

interface Row {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
  clientId: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  pending_confirmation: 'Pending Confirmation',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export default function OrdersReportPage() {
  const supabase = useSupabaseClient();
  const [range, setRange] = useState<DateRange>(defaultDateRange());

  const query = useQuery({
    queryKey: ['report-orders', range.from, range.to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('id, name, start_date, end_date, status, "clientId"')
        .lte('start_date', range.to)
        .gte('end_date', range.from)
        .order('start_date', { ascending: true });
      if (error) throw error;
      return data as unknown as Row[];
    },
  });

  const byStatus = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const o of query.data ?? []) {
      const s = o.status ?? 'unknown';
      counts[s] = (counts[s] ?? 0) + 1;
    }
    return counts;
  }, [query.data]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Orders / Events Report</h1>
          <p className="text-sm text-muted-foreground">Orders whose service period overlaps the selected range.</p>
        </div>
        <button
          type="button"
          onClick={() =>
            exportToCsv(
              `orders-report-${range.from}-to-${range.to}.csv`,
              ['Order', 'Start', 'End', 'Status'],
              (query.data ?? []).map((o) => [o.name, o.start_date ?? '', o.end_date ?? '', STATUS_LABEL[o.status ?? ''] ?? o.status ?? ''])
            )
          }
          className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted"
        >
          Export CSV
        </button>
      </div>

      <DateRangeFilter value={range} onChange={setRange} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(STATUS_LABEL).map(([status, label]) => (
          <div key={status} className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-semibold mt-1">{byStatus[status] ?? 0}</p>
          </div>
        ))}
      </div>

      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground border-b border-border">
            <tr>
              <th className="py-2">Order</th>
              <th className="py-2">Start</th>
              <th className="py-2">End</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {(query.data ?? []).map((o) => (
              <tr key={o.id} className="border-b border-border last:border-0">
                <td className="py-2">{o.name}</td>
                <td className="py-2">{o.start_date ?? '—'}</td>
                <td className="py-2">{o.end_date ?? '—'}</td>
                <td className="py-2">{STATUS_LABEL[o.status ?? ''] ?? o.status ?? '—'}</td>
              </tr>
            ))}
            {(query.data ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-center text-muted-foreground">
                  No orders in this period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
