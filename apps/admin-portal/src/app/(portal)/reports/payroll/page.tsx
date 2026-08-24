'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSupabaseClient } from '@/lib/supabase-client';
import { ReportAccessGate } from '@/components/reports/report-access-gate';
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

interface PayrollRow {
  employeeId: string;
  employeeName: string;
  payPeriodStart: string;
  payPeriodEnd: string;
  grossSalary: number;
  netSalary: number;
  status: string;
}

function PayrollReport() {
  const supabase = useSupabaseClient();
  const [range, setRange] = useState<DateRange>(defaultDateRange());

  const query = useQuery({
    queryKey: ['report-payroll', range.from, range.to],
    queryFn: async () => {
      // portal_read_payroll RLS is role-gated (has_portal_role), so this
      // plain select is safe to attempt for any portal user — it just
      // returns nothing if the caller isn't super_admin/finance.
      const { data, error } = await supabase
        .from('payroll')
        .select('"employeeId", "employeeName", "payPeriodStart", "payPeriodEnd", "grossSalary", "netSalary", status')
        .gte('payPeriodStart', range.from)
        .lte('payPeriodEnd', range.to)
        .order('payPeriodStart', { ascending: false });
      if (error) throw error;
      return data as unknown as PayrollRow[];
    },
  });

  const totals = useMemo(() => {
    const rows = query.data ?? [];
    return {
      gross: rows.reduce((s, r) => s + (r.grossSalary ?? 0), 0),
      net: rows.reduce((s, r) => s + (r.netSalary ?? 0), 0),
    };
  }, [query.data]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Payroll Summary</h1>
          <p className="text-sm text-muted-foreground">Gross/net salary by employee, for the selected pay period range.</p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            exportToCsv(
              `payroll-summary-${range.from}-to-${range.to}.csv`,
              ['Employee', 'Period Start', 'Period End', 'Gross', 'Net', 'Status'],
              (query.data ?? []).map((r) => [r.employeeName, r.payPeriodStart, r.payPeriodEnd, r.grossSalary, r.netSalary, r.status])
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
            <p className="text-sm text-muted-foreground">Total Gross</p>
            <p className="text-2xl font-semibold">TZS {totals.gross.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Net</p>
            <p className="text-2xl font-semibold">TZS {totals.net.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Gross</TableHead>
              <TableHead className="text-right">Net</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(query.data ?? []).map((r, i) => (
              <TableRow key={`${r.employeeId}-${i}`}>
                <TableCell>{r.employeeName}</TableCell>
                <TableCell>
                  {r.payPeriodStart} – {r.payPeriodEnd}
                </TableCell>
                <TableCell>{r.status}</TableCell>
                <TableCell className="text-right">TZS {(r.grossSalary ?? 0).toLocaleString()}</TableCell>
                <TableCell className="text-right">TZS {(r.netSalary ?? 0).toLocaleString()}</TableCell>
              </TableRow>
            ))}
            {(query.data ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No payroll records in this period.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

export default function PayrollReportPage() {
  return (
    <ReportAccessGate>
      <PayrollReport />
    </ReportAccessGate>
  );
}
