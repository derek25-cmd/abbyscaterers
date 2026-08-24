'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSupabaseClient } from '@/lib/supabase-client';
import { DateRangeFilter, defaultDateRange, type DateRange } from '@/components/reports/date-range-filter';
import { exportToCsv } from '@/lib/csv-export';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface RfqRow {
  id: string;
  status: string;
  branch: string | null;
  created_at: string;
}

interface HistoryRow {
  rfq_id: string;
  to_status: string;
  created_at: string;
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  in_review: 'In Review',
  proforma_created: 'Proforma Created',
  approved: 'Approved',
  closed: 'Closed',
  cancelled: 'Cancelled',
};

export default function RfqReportPage() {
  const supabase = useSupabaseClient();
  const [range, setRange] = useState<DateRange>(defaultDateRange());

  const rfqsQuery = useQuery({
    queryKey: ['report-rfqs', range.from, range.to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rfqs')
        .select('id, status, branch, created_at')
        .gte('created_at', range.from)
        .lte('created_at', `${range.to}T23:59:59`);
      if (error) throw error;
      return data as RfqRow[];
    },
  });

  const historyQuery = useQuery({
    queryKey: ['report-rfq-history', range.from, range.to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rfq_status_history')
        .select('rfq_id, to_status, created_at')
        .eq('to_status', 'proforma_created');
      if (error) throw error;
      return data as HistoryRow[];
    },
  });

  const byStatus = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of rfqsQuery.data ?? []) counts[r.status] = (counts[r.status] ?? 0) + 1;
    return counts;
  }, [rfqsQuery.data]);

  const byBranch = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of rfqsQuery.data ?? []) {
      const b = r.branch ?? 'Unspecified';
      counts[b] = (counts[b] ?? 0) + 1;
    }
    return counts;
  }, [rfqsQuery.data]);

  const avgResponseHours = useMemo(() => {
    const firstAnswered = new Map<string, string>();
    for (const h of historyQuery.data ?? []) {
      const existing = firstAnswered.get(h.rfq_id);
      if (!existing || h.created_at < existing) firstAnswered.set(h.rfq_id, h.created_at);
    }
    const rfqById = new Map((rfqsQuery.data ?? []).map((r) => [r.id, r]));
    let totalHours = 0;
    let n = 0;
    for (const [rfqId, answeredAt] of firstAnswered) {
      const rfq = rfqById.get(rfqId);
      if (!rfq) continue;
      const hours = (new Date(answeredAt).getTime() - new Date(rfq.created_at).getTime()) / 3600000;
      if (hours >= 0) {
        totalHours += hours;
        n++;
      }
    }
    return n > 0 ? Math.round((totalHours / n) * 10) / 10 : null;
  }, [historyQuery.data, rfqsQuery.data]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">RFQ Report</h1>
          <p className="text-sm text-muted-foreground">RFQs created in the selected period, by status and branch.</p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            exportToCsv(
              `rfq-report-${range.from}-to-${range.to}.csv`,
              ['Status', 'Count'],
              Object.entries(byStatus).map(([status, count]) => [STATUS_LABEL[status] ?? status, count])
            )
          }
        >
          Export CSV
        </Button>
      </div>

      <DateRangeFilter value={range} onChange={setRange} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total RFQs</p>
            <p className="text-2xl font-semibold mt-1">{rfqsQuery.data?.length ?? '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Avg. Response Time</p>
            <p className="text-2xl font-semibold mt-1">{avgResponseHours != null ? `${avgResponseHours}h` : '—'}</p>
            <p className="text-xs text-muted-foreground mt-1">Submission to first proforma</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <h2 className="font-medium mb-2">By Status</h2>
            <ul className="text-sm space-y-1">
              {Object.entries(byStatus).map(([status, count]) => (
                <li key={status} className="flex justify-between">
                  <span className="text-muted-foreground">{STATUS_LABEL[status] ?? status}</span>
                  <span>{count}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <h2 className="font-medium mb-2">By Branch</h2>
            <ul className="text-sm space-y-1">
              {Object.entries(byBranch).map(([branch, count]) => (
                <li key={branch} className="flex justify-between">
                  <span className="text-muted-foreground">{branch}</span>
                  <span>{count}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
