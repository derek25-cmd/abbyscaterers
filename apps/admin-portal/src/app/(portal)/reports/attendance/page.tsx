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
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Attendance Report</h1>
          <p className="text-sm text-muted-foreground">Presence/absence by period.</p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            exportToCsv(
              `attendance-report-${range.from}-to-${range.to}.csv`,
              ['Employee', 'Date', 'Status'],
              (query.data ?? []).map((r) => [nameById.get(r.employee_id) ?? r.employee_id, r.date, r.status])
            )
          }
        >
          Export CSV
        </Button>
      </div>

      <DateRangeFilter value={range} onChange={setRange} />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {Object.entries(byStatus).map(([status, count]) => (
          <Card key={status}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{status}</p>
              <p className="text-2xl font-semibold mt-1">{count}</p>
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
              <TableHead>Employee</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(query.data ?? []).map((r, i) => (
              <TableRow key={`${r.employee_id}-${r.date}-${i}`}>
                <TableCell>{nameById.get(r.employee_id) ?? r.employee_id}</TableCell>
                <TableCell>{r.date}</TableCell>
                <TableCell>{r.status}</TableCell>
              </TableRow>
            ))}
            {(query.data ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  No attendance records in this period.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
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
