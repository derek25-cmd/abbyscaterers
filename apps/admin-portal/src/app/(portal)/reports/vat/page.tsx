'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
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
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">VAT Report</h1>
          <p className="text-sm text-muted-foreground">Output VAT from invoices (rate: {vatRate}%).</p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            exportToCsv(
              `vat-report-${range.from}-to-${range.to}.csv`,
              ['Invoice No.', 'Client', 'Date', 'Base (TZS)', 'VAT (TZS)'],
              rows.map((r) => [r.id, r.clients?.companyName ?? r.clientId ?? '', r.invoiceDate, r.totalBeforeVat, r.vat])
            )
          }
        >
          Export CSV
        </Button>
      </div>

      <DateRangeFilter value={range} onChange={setRange} />

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Taxable Base</p>
            <p className="text-2xl font-semibold">TZS {totalBase.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Output VAT</p>
            <p className="text-2xl font-semibold">TZS {totalVat.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice No.</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Base</TableHead>
              <TableHead className="text-right">VAT</TableHead>
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
                <TableCell className="text-right">TZS {r.totalBeforeVat.toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                <TableCell className="text-right">TZS {r.vat.toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
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
