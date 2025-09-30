
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export default function MonthlyAttendanceReportPage() {
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), 'yyyy-MM'));
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

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    records.forEach(rec => months.add(format(parseISO(rec.date), 'yyyy-MM')));
    return Array.from(months).sort().reverse();
  }, [records]);

  const reportData = useMemo(() => {
    const activeEmployees = employees.filter(e => e.status === 'Active');
    const daysInMonth = getDaysInMonth(parseISO(`${selectedMonth}-01`));
    
    let filteredData = activeEmployees.map(emp => {
      const empName = [emp.firstName, emp.middleName, emp.lastName].filter(Boolean).join(' ');
      const empRecords = records.filter(r => r.employee === empName && r.date.startsWith(selectedMonth));
      
      const attendance = Array(daysInMonth).fill('A'); // A for Absent
      empRecords.forEach(rec => {
        const dayOfMonth = parseISO(rec.date).getDate() -1;
        if(rec.clockIn !== '—') attendance[dayOfMonth] = 'P'; // P for Present
      });
      
      const presentDays = attendance.filter(a => a === 'P').length;
      const absentDays = daysInMonth - presentDays;

      return {
        id: emp.id,
        name: empName,
        attendance,
        presentDays,
        absentDays
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
    doc.text(`Monthly Attendance Report - ${format(parseISO(`${selectedMonth}-01`), 'MMMM yyyy')}`, 14, 15);
    (doc as any).autoTable({
        head: [['Employee', 'Present Days', 'Absent Days']],
        body: reportData.map(d => [d.name, d.presentDays, d.absentDays]),
        startY: 25,
    });
    doc.save(`Monthly_Attendance_Report_${selectedMonth}.pdf`);
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
            <CardTitle>Attendance Summary for: {format(parseISO(`${selectedMonth}-01`), 'MMMM yyyy')}</CardTitle>
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
              <Select onValueChange={setSelectedMonth} value={selectedMonth}>
                  <SelectTrigger className="w-[240px]"><SelectValue placeholder="Select a month" /></SelectTrigger>
                  <SelectContent>{availableMonths.map(month => (<SelectItem key={month} value={month}>{format(parseISO(`${month}-01`), 'MMMM yyyy')}</SelectItem>))}</SelectContent>
              </Select>
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
