'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSupabaseClient } from '@/lib/supabase-client';
import { ReportAccessGate } from '@/components/reports/report-access-gate';
import { DateRangeFilter, defaultDateRange, type DateRange } from '@/components/reports/date-range-filter';
import { exportToCsv } from '@/lib/csv-export';

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Payroll Summary</h1>
          <p className="text-sm text-muted-foreground">Gross/net salary by employee, for the selected pay period range.</p>
        </div>
        <button
          type="button"
          onClick={() =>
            exportToCsv(
              `payroll-summary-${range.from}-to-${range.to}.csv`,
              ['Employee', 'Period Start', 'Period End', 'Gross', 'Net', 'Status'],
              (query.data ?? []).map((r) => [r.employeeName, r.payPeriodStart, r.payPeriodEnd, r.grossSalary, r.netSalary, r.status])
            )
          }
          className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted"
        >
          Export CSV
        </button>
      </div>

      <DateRangeFilter value={range} onChange={setRange} />

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Gross</p>
          <p className="text-2xl font-semibold">TZS {totals.gross.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Total Net</p>
          <p className="text-2xl font-semibold">TZS {totals.net.toLocaleString()}</p>
        </div>
      </div>

      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground border-b border-border">
            <tr>
              <th className="py-2">Employee</th>
              <th className="py-2">Period</th>
              <th className="py-2">Status</th>
              <th className="py-2 text-right">Gross</th>
              <th className="py-2 text-right">Net</th>
            </tr>
          </thead>
          <tbody>
            {(query.data ?? []).map((r, i) => (
              <tr key={`${r.employeeId}-${i}`} className="border-b border-border last:border-0">
                <td className="py-2">{r.employeeName}</td>
                <td className="py-2">
                  {r.payPeriodStart} – {r.payPeriodEnd}
                </td>
                <td className="py-2">{r.status}</td>
                <td className="py-2 text-right">TZS {(r.grossSalary ?? 0).toLocaleString()}</td>
                <td className="py-2 text-right">TZS {(r.netSalary ?? 0).toLocaleString()}</td>
              </tr>
            ))}
            {(query.data ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-center text-muted-foreground">
                  No payroll records in this period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
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
