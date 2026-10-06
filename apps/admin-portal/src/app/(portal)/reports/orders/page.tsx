'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSupabaseClient } from '@/lib/supabase-client';
import { DateRangeFilter, defaultDateRange, type DateRange } from '@/components/reports/date-range-filter';
import { exportToCsv } from '@/lib/csv-export';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';

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
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Orders / Events Report</h1>
          <p className="text-sm text-muted-foreground">Orders whose service period overlaps the selected range.</p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            exportToCsv(
              `orders-report-${range.from}-to-${range.to}.csv`,
              ['Order', 'Start', 'End', 'Status'],
              (query.data ?? []).map((o) => [o.name, o.start_date ?? '', o.end_date ?? '', STATUS_LABEL[o.status ?? ''] ?? o.status ?? ''])
            )
          }
        >
          Export CSV
        </Button>
      </div>

      <DateRangeFilter value={range} onChange={setRange} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(STATUS_LABEL).map(([status, label]) => (
          <Card key={status}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-2xl font-semibold mt-1">{byStatus[status] ?? 0}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Start</TableHead>
              <TableHead>End</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(query.data ?? []).map((o) => (
              <TableRow key={o.id}>
                <TableCell>{o.name}</TableCell>
                <TableCell>{o.start_date ?? '—'}</TableCell>
                <TableCell>{o.end_date ?? '—'}</TableCell>
                <TableCell>{STATUS_LABEL[o.status ?? ''] ?? o.status ?? '—'}</TableCell>
              </TableRow>
            ))}
            {(query.data ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No orders in this period.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
