'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, startOfYear } from 'date-fns';
import { useSupabaseClient } from '@/lib/supabase-client';
import { computeInvoiceGrandTotal, type InvoiceTotalFields } from '@/lib/invoice-math';
import { exportToCsv } from '@/lib/csv-export';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

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

  const vatRateQuery = useQuery({
    queryKey: ['report-vat-rate'],
    queryFn: async () => {
      const { data, error } = await supabase.from('invoice_tax_rates').select('rate').eq('tax_type', 'vat').maybeSingle();
      if (error) throw error;
      return data?.rate ?? 18;
    },
  });
  const vatRate = vatRateQuery.data ?? 18;

  const trend = useMemo(() => {
    const map = new Map<string, number>();
    for (const inv of query.data ?? []) {
      const key = bucketKey(inv.invoiceDate, bucket);
      map.set(key, (map.get(key) ?? 0) + computeInvoiceGrandTotal(inv, vatRate));
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [query.data, bucket, vatRate]);

  const maxValue = Math.max(1, ...trend.map(([, v]) => v));
  const ytdTotal = trend.reduce((sum, [, v]) => sum + v, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Revenue Trend</h1>
          <p className="text-sm text-muted-foreground">Year-to-date invoiced revenue.</p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => exportToCsv('revenue-trend.csv', ['Period', 'Revenue (TZS)'], trend.map(([k, v]) => [k, v]))}
        >
          Export CSV
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">YTD Revenue</p>
            <p className="text-2xl font-semibold">TZS {ytdTotal.toLocaleString()}</p>
          </CardContent>
        </Card>
        <div className="flex gap-1">
          {(['daily', 'weekly', 'monthly'] as Bucket[]).map((b) => (
            <Button
              key={b}
              type="button"
              size="sm"
              variant={bucket === b ? 'default' : 'outline'}
              className="capitalize"
              onClick={() => setBucket(b)}
            >
              {b}
            </Button>
          ))}
        </div>
      </div>

      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <Card>
          <CardContent className="p-4 space-y-2">
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}
