'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, startOfYear } from 'date-fns';
import { useSupabaseClient } from '@/lib/supabase-client';
import { computeInvoiceGrandTotal, type InvoiceTotalFields } from '@/lib/invoice-math';
import { exportToCsv } from '@/lib/csv-export';

interface Row extends InvoiceTotalFields {
  id: string;
  invoiceDate: string;
}

type Bucket = 'daily' | 'weekly' | 'monthly';

function bucketKey(dateStr: string, bucket: Bucket): string {
  const d = new Date(dateStr);
  if (bucket === 'daily') return format(d, 'yyyy-MM-dd');
  if (bucket === 'monthly') return format(d, 'yyyy-MM');
  // weekly: ISO week start (Monday)
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return format(monday, 'yyyy-MM-dd') + ' (week)';
}

export default function RevenueTrendPage() {
  const supabase = useSupabaseClient();
  const [bucket, setBucket] = useState<Bucket>('monthly');

  const query = useQuery({
    queryKey: ['report-revenue-trend'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, "invoiceDate", items, "serviceCharge", "transportCosts", "numberOfDays", "multiplyByDays", "vatType"')
        .gte('invoiceDate', format(startOfYear(new Date()), 'yyyy-MM-dd'))
        .order('invoiceDate', { ascending: true });
      if (error) throw error;
      return data as unknown as Row[];
    },
  });

  const trend = useMemo(() => {
    const map = new Map<string, number>();
    for (const inv of query.data ?? []) {
      const key = bucketKey(inv.invoiceDate, bucket);
      map.set(key, (map.get(key) ?? 0) + computeInvoiceGrandTotal(inv));
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [query.data, bucket]);

  const maxValue = Math.max(1, ...trend.map(([, v]) => v));
  const ytdTotal = trend.reduce((sum, [, v]) => sum + v, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Revenue Trend</h1>
          <p className="text-sm text-muted-foreground">Year-to-date invoiced revenue.</p>
        </div>
        <button
          type="button"
          onClick={() => exportToCsv('revenue-trend.csv', ['Period', 'Revenue (TZS)'], trend.map(([k, v]) => [k, v]))}
          className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted"
        >
          Export CSV
        </button>
      </div>

      <div className="flex items-center gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">YTD Revenue</p>
          <p className="text-2xl font-semibold">TZS {ytdTotal.toLocaleString()}</p>
        </div>
        <div className="flex gap-1">
          {(['daily', 'weekly', 'monthly'] as Bucket[]).map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBucket(b)}
              className={`rounded-md border px-3 py-1.5 text-sm capitalize ${
                bucket === b ? 'bg-primary text-primary-foreground border-primary' : 'border-input hover:bg-muted'
              }`}
            >
              {b}
            </button>
          ))}
        </div>
      </div>

      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="rounded-lg border border-border bg-card p-4 space-y-2">
          {trend.map(([key, value]) => (
            <div key={key} className="flex items-center gap-3 text-sm">
              <span className="w-32 text-muted-foreground shrink-0">{key}</span>
              <div className="flex-1 bg-muted rounded h-4 overflow-hidden">
                <div className="bg-primary h-full" style={{ width: `${(value / maxValue) * 100}%` }} />
              </div>
              <span className="w-32 text-right shrink-0">TZS {value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
          ))}
          {trend.length === 0 && <p className="text-sm text-muted-foreground">No invoices this year.</p>}
        </div>
      )}
    </div>
  );
}
