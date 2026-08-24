'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useSupabaseClient } from '@/lib/supabase-client';
import { computeInvoiceGrandTotal, type InvoiceTotalFields } from '@/lib/invoice-math';
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
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Sales / Revenue Report</h1>
          <p className="text-sm text-muted-foreground">Invoiced revenue by period.</p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            exportToCsv(
              `sales-report-${range.from}-to-${range.to}.csv`,
              ['Invoice No.', 'Client', 'Date', 'Status', 'Total (TZS)'],
              rows.map((r) => [r.id, r.clients?.companyName ?? r.clientId ?? '', r.invoiceDate, r.status, r.total])
            )
          }
        >
          Export CSV
        </Button>
      </div>

      <DateRangeFilter value={range} onChange={setRange} />

      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Total Revenue</p>
          <p className="text-2xl font-semibold">TZS {totalRevenue.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-1">{rows.length} invoices</p>
        </CardContent>
      </Card>

      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice No.</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">
                  <Link href={`/invoices/${r.id}`} className="text-primary hover:underline">
                    {r.id}
                  </Link>
                </TableCell>
                <TableCell>{r.clients?.companyName ?? r.clientId ?? '—'}</TableCell>
                <TableCell>{r.invoiceDate}</TableCell>
                <TableCell>{r.status}</TableCell>
                <TableCell className="text-right">TZS {r.total.toLocaleString()}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No invoices in this period.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
