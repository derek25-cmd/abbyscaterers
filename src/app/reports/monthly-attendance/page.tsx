
"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Loader2, Download, ArrowLeft, UserCheck, UserX, User, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getAttendanceRecords } from "@/services/attendanceService";
import { getEmployees } from "@/services/employeeService";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { format, parseISO, getDaysInMonth } from 'date-fns';
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";

export default function MonthlyAttendanceReportPage() {
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [records, setRecords] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchData = async () => {
        setIsLoading(true);
        const [recs, emps] = await Promise.all([getAttendanceRecords(), getEmployees()]);
        setRecords(recs);
        setEmployees(emps);
        setIsLoading(false);
    };
    fetchData();
  }, []);

  const reportData = useMemo(() => {
    const monthStr = format(selectedMonth, 'yyyy-MM');
    const activeEmployees = employees.filter(e => e.status === 'Active');
    const daysInMonth = getDaysInMonth(selectedMonth);
    
    let filteredData = activeEmployees.map(emp => {
      // Find records for this employee in this month
      const empRecords = records.filter(r => r.employee_id === emp.id && r.date.startsWith(monthStr));
      
      // Default to '-' (Not Marked) or 'A' (Absent)
      const attendance = Array(daysInMonth).fill('-'); 
      
      empRecords.forEach(rec => {
        const dayOfMonth = new Date(rec.date).getDate() - 1;
        if (dayOfMonth >= 0 && dayOfMonth < daysInMonth) {
            // Status mapping for report
            if (rec.status === 'Present' || rec.status === 'Late') attendance[dayOfMonth] = 'P';
            else if (rec.status === 'Half Day') attendance[dayOfMonth] = 'H';
            else if (rec.status === 'Absent') attendance[dayOfMonth] = 'A';
            else if (rec.status === 'Leave') attendance[dayOfMonth] = 'L';
        }
      });
      
      const presentDays = attendance.filter(a => a === 'P').length;
      const halfDays = attendance.filter(a => a === 'H').length;
      const leaveDays = attendance.filter(a => a === 'L').length;
      const absentDays = attendance.filter(a => a === 'A').length;

      // Professional tally: (P + L + H*0.5)
      const totalTally = presentDays + leaveDays + (halfDays * 0.5);

      return {
        id: emp.id,
        name: `${emp.firstName} ${emp.lastName}`,
        attendance,
        presentDays: totalTally,
        absentDays: absentDays
      };
    });
    
    if (searchQuery) {
        filteredData = filteredData.filter(d => d.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    
    return filteredData;

  }, [selectedMonth, records, employees, searchQuery]);

  const handlePdfExport = () => {
    setIsExporting(true);
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.text(`Monthly Attendance Report - ${format(selectedMonth, 'MMMM yyyy')}`, 14, 15);
    (doc as any).autoTable({
        head: [['Employee', 'Present Days', 'Absent Days']],
        body: reportData.map(d => [d.name, d.presentDays, d.absentDays]),
        startY: 25,
    });
    doc.save(`Monthly_Attendance_Report_${format(selectedMonth, 'yyyy-MM')}.pdf`);
    toast({ title: "Export Successful", description: "Report exported to PDF." });
    setIsExporting(false);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Monthly Attendance Report</h1>
          <p className="text-muted-foreground">View attendance summaries for a selected month.</p>
        </div>
        <div className="flex items-center space-x-3">
          <Button asChild variant="outline" size="sm"><Link href="/reports"><ArrowLeft className="mr-2 h-4 w-4" />Back to Reports</Link></Button>
        </div>
      </div>
      
      <Card>
        <CardHeader>
            <CardTitle>Attendance Summary for: {format(selectedMonth, 'MMMM yyyy')}</CardTitle>
            <div className="flex items-center gap-2 pt-4">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search by employee name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg bg-background pl-8 md:w-[240px]"
                />
              </div>
              <DatePicker
                selectedDate={selectedMonth}
                onDateChange={setSelectedMonth}
                labelFormat="MMMM yyyy"
                isMonthPicker
              />
              <Button onClick={handlePdfExport} variant="outline" size="sm" disabled={isExporting}>
                 {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                 {isExporting ? 'Exporting...' : 'Export PDF'}
              </Button>
          </div>
        </CardHeader>
        <CardContent>
           <Table>
            <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Present</TableHead><TableHead>Absent</TableHead></TableRow></TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={3} className="text-center h-24"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
              ) : reportData.map((data) => (
                  <TableRow key={data.id}>
                    <TableCell className="font-medium">{data.name}</TableCell>
                    <TableCell><Badge className="bg-green-500/20 text-green-700">{data.presentDays} days</Badge></TableCell>
                    <TableCell><Badge variant="destructive">{data.absentDays} days</Badge></TableCell>
                  </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
