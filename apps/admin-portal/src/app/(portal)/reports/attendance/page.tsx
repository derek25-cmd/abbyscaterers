'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSupabaseClient } from '@/lib/supabase-client';
import { ReportAccessGate } from '@/components/reports/report-access-gate';
import { DateRangeFilter, defaultDateRange, type DateRange } from '@/components/reports/date-range-filter';
import { exportToCsv } from '@/lib/csv-export';

interface AttendanceRow {
  employee_id: string;
  date: string;
  status: string;
}

interface EmployeeDirectoryRow {
  id: string;
  firstName: string;
  lastName: string;
}

function AttendanceReport() {
  const supabase = useSupabaseClient();
  const [range, setRange] = useState<DateRange>(defaultDateRange());

  const query = useQuery({
    queryKey: ['report-attendance', range.from, range.to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance')
        .select('employee_id, date, status')
        .gte('date', range.from)
        .lte('date', range.to);
      if (error) throw error;
      return data as AttendanceRow[];
    },
  });

  const directoryQuery = useQuery({
    queryKey: ['employee-directory'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_employee_directory_for_portal');
      if (error) throw error;
      return data as EmployeeDirectoryRow[];
    },
  });

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of directoryQuery.data ?? []) map.set(e.id, `${e.firstName} ${e.lastName}`);
    return map;
  }, [directoryQuery.data]);

  const byStatus = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of query.data ?? []) counts[a.status] = (counts[a.status] ?? 0) + 1;
    return counts;
  }, [query.data]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Attendance Report</h1>
          <p className="text-sm text-muted-foreground">Presence/absence by period.</p>
        </div>
        <button
          type="button"
          onClick={() =>
            exportToCsv(
              `attendance-report-${range.from}-to-${range.to}.csv`,
              ['Employee', 'Date', 'Status'],
              (query.data ?? []).map((r) => [nameById.get(r.employee_id) ?? r.employee_id, r.date, r.status])
            )
          }
          className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted"
        >
          Export CSV
        </button>
      </div>

      <DateRangeFilter value={range} onChange={setRange} />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {Object.entries(byStatus).map(([status, count]) => (
          <div key={status} className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{status}</p>
            <p className="text-2xl font-semibold mt-1">{count}</p>
          </div>
        ))}
      </div>

      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground border-b border-border">
            <tr>
              <th className="py-2">Employee</th>
              <th className="py-2">Date</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {(query.data ?? []).map((r, i) => (
              <tr key={`${r.employee_id}-${r.date}-${i}`} className="border-b border-border last:border-0">
                <td className="py-2">{nameById.get(r.employee_id) ?? r.employee_id}</td>
                <td className="py-2">{r.date}</td>
                <td className="py-2">{r.status}</td>
              </tr>
            ))}
            {(query.data ?? []).length === 0 && (
              <tr>
                <td colSpan={3} className="py-4 text-center text-muted-foreground">
                  No attendance records in this period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function AttendanceReportPage() {
  return (
    <ReportAccessGate>
      <AttendanceReport />
    </ReportAccessGate>
  );
}
