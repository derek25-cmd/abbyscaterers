"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
    FileText, 
    Loader2, 
    ArrowLeft, 
    Search,
    Calendar as CalendarIcon,
    ChevronLeft,
    ChevronRight,
    Users,
    CheckCircle2,
    XCircle,
    Clock,
    Filter
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getAttendanceRecords } from "@/services/attendanceService";
import { getEmployees } from "@/services/employeeService";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { 
    format, 
    startOfMonth, 
    endOfMonth, 
    startOfWeek, 
    endOfWeek, 
    eachDayOfInterval, 
    isSameDay,
    parseISO,
    getDaysInMonth,
    addMonths,
    subMonths,
    addDays,
    subDays,
    isWeekend
} from 'date-fns';
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useSearchParams, useRouter } from 'next/navigation';

type ReportInterval = 'day' | 'week' | 'month';

export default function AttendanceReportPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  // Initial date from query params or now
  const initialMonth = searchParams.get('month');
  const initialYear = searchParams.get('year');
  
  const [reportDate, setReportDate] = useState<Date>(() => {
    if (initialMonth !== null && initialYear !== null) {
        return new Date(parseInt(initialYear), parseInt(initialMonth), 1);
    }
    return new Date();
  });

  const [interval, setInterval] = useState<ReportInterval>('month');
  const [records, setRecords] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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

  const dateRange = useMemo(() => {
    if (interval === 'day') {
        return { start: reportDate, end: reportDate };
    } else if (interval === 'week') {
        return { start: startOfWeek(reportDate), end: endOfWeek(reportDate) };
    } else {
        return { start: startOfMonth(reportDate), end: endOfMonth(reportDate) };
    }
  }, [reportDate, interval]);

  const reportData = useMemo(() => {
    const activeEmployees = employees.filter(e => e.status === 'Active');
    const rangeDays = eachDayOfInterval(dateRange);
    
    let results = activeEmployees.map(emp => {
      const empRecords = records.filter(r => 
        r.employee_id === emp.id && 
        parseISO(r.date) >= dateRange.start && 
        parseISO(r.date) <= dateRange.end
      );
      
      const stats = {
        present: 0,
        absent: 0,
        late: 0,
        halfDay: 0,
        leave: 0,
        totalUnits: 0,
        details: [] as any[]
      };

      rangeDays.forEach(day => {
        const dateStr = format(day, "yyyy-MM-dd");
        const rec = empRecords.find(r => r.date === dateStr);
        const status = rec?.status;

        if (status === 'Present') { stats.present++; stats.totalUnits += 1; }
        else if (status === 'Late') { stats.late++; stats.totalUnits += 1; }
        else if (status === 'Half Day') { stats.halfDay++; stats.totalUnits += 0.5; }
        else if (status === 'Absent') { stats.absent++; }
        else if (status === 'Leave') { stats.leave++; stats.totalUnits += 1; }

        stats.details.push({ date: dateStr, status });
      });

      return {
        id: emp.id,
        name: `${emp.firstName} ${emp.lastName}`,
        role: emp.role,
        department: emp.department,
        stats,
        // For daily view convenience
        statusToday: empRecords.find(r => r.date === format(reportDate, "yyyy-MM-dd"))?.status,
        notesToday: empRecords.find(r => r.date === format(reportDate, "yyyy-MM-dd"))?.notes
      };
    });
    
    if (searchQuery) {
        results = results.filter(d => d.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    
    return results;
  }, [dateRange, records, employees, searchQuery, reportDate]);

  const summary = useMemo(() => {
    const totalPossible = reportData.length * (interval === 'day' ? 1 : eachDayOfInterval(dateRange).filter(d => !isWeekend(d)).length);
    const totalUnits = reportData.reduce((sum, d) => sum + d.stats.totalUnits, 0);
    const totalAbsent = reportData.reduce((sum, d) => sum + d.stats.absent, 0);

    return {
        totalStaff: reportData.length,
        attendanceRate: totalPossible > 0 ? (totalUnits / totalPossible) * 100 : 0,
        absentCount: totalAbsent
    };
  }, [reportData, interval, dateRange]);

  const handlePdfExport = () => {
    setIsExporting(true);
    const doc = new jsPDF({ orientation: 'landscape' });
    const rangeStr = interval === 'day' ? format(reportDate, 'PP') : `${format(dateRange.start, 'PP')} - ${format(dateRange.end, 'PP')}`;
    
    doc.setFontSize(18);
    doc.text(`Attendance Report - ${interval.toUpperCase()}`, 14, 15);
    doc.setFontSize(12);
    doc.text(`Period: ${rangeStr}`, 14, 22);

    const head = interval === 'day' 
        ? [['Employee', 'Role', 'Department', 'Status', 'Notes']]
        : [['Employee', 'Role', 'Present/Late', 'Absent', 'Leave', 'Half Day', 'Total Points']];

    const body = reportData.map(d => interval === 'day' 
        ? [d.name, d.role, d.department, d.statusToday || 'Not Marked', d.notesToday || '-']
        : [d.name, d.role, d.stats.present + d.stats.late, d.stats.absent, d.stats.leave, d.stats.halfDay, d.stats.totalUnits]
    );

    (doc as any).autoTable({
        head,
        body,
        startY: 30,
        theme: 'striped',
        headStyles: { fillColor: [30, 41, 59] }
    });

    doc.save(`Attendance_Report_${interval}_${format(reportDate, 'yyyy-MM-dd')}.pdf`);
    toast({ title: "Export Successful", description: "Your report has been downloaded." });
    setIsExporting(false);
  };

  const adjustDate = (amount: number) => {
    if (interval === 'day') setReportDate(prev => amount > 0 ? addDays(prev, 1) : subDays(prev, 1));
    else if (interval === 'week') setReportDate(prev => amount > 0 ? addDays(prev, 7) : subDays(prev, 7));
    else setReportDate(prev => amount > 0 ? addMonths(prev, 1) : subMonths(prev, 1));
  };

  return (
    <div className="container mx-auto p-6 space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
        <div className="flex items-center gap-4">
             <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
                <ArrowLeft className="h-5 w-5" />
             </Button>
             <div>
                <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Attendance Analytics</h1>
                <p className="text-muted-foreground">Comprehensive insights into workforce participation.</p>
             </div>
        </div>
        <div className="flex items-center gap-2">
            <Button onClick={handlePdfExport} className="bg-primary hover:bg-primary/90 text-white shadow-lg" disabled={isExporting}>
                {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                Export to PDF
            </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-l-4 border-l-blue-500 shadow-sm">
                <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Active Workforce</p>
                            <h3 className="text-3xl font-bold">{summary.totalStaff}</h3>
                        </div>
                        <Users className="h-10 w-10 text-blue-500/20" />
                    </div>
                </CardContent>
            </Card>
            <Card className="border-l-4 border-l-green-500 shadow-sm">
                <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Attendance Rate</p>
                            <h3 className="text-3xl font-bold">{summary.attendanceRate.toFixed(1)}%</h3>
                        </div>
                        <CheckCircle2 className="h-10 w-10 text-green-500/20" />
                    </div>
                </CardContent>
            </Card>
            <Card className="border-l-4 border-l-rose-500 shadow-sm">
                <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Absences</p>
                            <h3 className="text-3xl font-bold">{summary.absentCount}</h3>
                        </div>
                        <XCircle className="h-10 w-10 text-rose-500/20" />
                    </div>
                </CardContent>
            </Card>
      </div>
      
      <Card className="shadow-xl border-t-4 border-t-primary">
        <CardHeader className="bg-secondary/5 border-b">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div className="space-y-1">
                    <CardTitle className="text-2xl font-bold">Reporting Controls</CardTitle>
                    <CardDescription>Select your interval and search for specific staff.</CardDescription>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center rounded-lg border bg-background p-1 shadow-sm">
                        {(['day', 'week', 'month'] as ReportInterval[]).map((t) => (
                            <Button 
                                key={t}
                                variant={interval === t ? "default" : "ghost"}
                                size="sm"
                                className="h-8 px-4 font-semibold capitalize"
                                onClick={() => setInterval(t)}
                            >
                                {t}
                            </Button>
                        ))}
                    </div>

                    <div className="flex items-center rounded-lg border bg-background p-1 shadow-sm">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => adjustDate(-1)}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="px-4 text-sm font-bold min-w-[140px] text-center">
                            {interval === 'day' ? format(reportDate, 'PP') : 
                             interval === 'week' ? `Week of ${format(dateRange.start, 'MMM d')}` : 
                             format(reportDate, 'MMMM yyyy')}
                        </span>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => adjustDate(1)}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Search staff..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-[200px] pl-10 shadow-sm"
                        />
                    </div>
                </div>
            </div>
        </CardHeader>
        <CardContent className="pt-6">
           <div className="rounded-xl border overflow-hidden shadow-inner">
            <Table>
                <TableHeader className="bg-secondary/20">
                    <TableRow>
                        <TableHead className="font-bold">Employee</TableHead>
                        <TableHead className="font-bold">Department & Role</TableHead>
                        {interval === 'day' ? (
                            <>
                                <TableHead className="text-center font-bold">Status</TableHead>
                                <TableHead className="text-left font-bold w-[250px]">Notes / Remarks</TableHead>
                            </>
                        ) : (
                            <>
                                <TableHead className="text-center font-bold">P / L</TableHead>
                                <TableHead className="text-center font-bold">Absent</TableHead>
                                <TableHead className="text-center font-bold">Leave</TableHead>
                                <TableHead className="text-center font-bold">Half Day</TableHead>
                                <TableHead className="text-center font-bold">Total Pts</TableHead>
                            </>
                        )}
                    </TableRow>
                </TableHeader>
                <TableBody>
                {isLoading ? (
                    <TableRow><TableCell colSpan={interval === 'day' ? 3 : 7} className="text-center h-48"><Loader2 className="mx-auto h-10 w-10 animate-spin text-primary opacity-20" /></TableCell></TableRow>
                ) : reportData.map((d) => (
                    <TableRow key={d.id} className="hover:bg-accent/5 transition-colors">
                        <TableCell className="font-bold text-base py-4">{d.name}</TableCell>
                        <TableCell>
                            <div className="flex flex-col">
                                <span className="font-medium text-sm">{d.department}</span>
                                <span className="text-xs text-muted-foreground uppercase tracking-widest">{d.role}</span>
                            </div>
                        </TableCell>
                        {interval === 'day' ? (
                            <>
                            <TableCell className="text-center">
                                {d.statusToday ? (
                                    <Badge className={cn(
                                        "px-4 py-1",
                                        d.statusToday === 'Present' && "bg-green-500/20 text-green-700",
                                        d.statusToday === 'Absent' && "bg-rose-500/20 text-rose-700",
                                        d.statusToday === 'Late' && "bg-amber-500/20 text-amber-700",
                                        d.statusToday === 'Half Day' && "bg-orange-500/20 text-orange-700",
                                        d.statusToday === 'Leave' && "bg-purple-500/20 text-purple-700",
                                    )}>
                                        {d.statusToday}
                                    </Badge>
                                ) : (
                                    <span className="text-muted-foreground text-xs italic">Not Marked</span>
                                )}
                            </TableCell>
                            <TableCell className="text-left text-xs text-muted-foreground max-w-[250px] truncate" title={d.notesToday}>
                                {d.notesToday || <span className="italic opacity-50">No remarks</span>}
                            </TableCell>
                            </>
                        ) : (
                            <>
                                <TableCell className="text-center font-bold text-green-600">{d.stats.present + d.stats.late}</TableCell>
                                <TableCell className="text-center font-bold text-rose-600">{d.stats.absent}</TableCell>
                                <TableCell className="text-center font-bold text-purple-600">{d.stats.leave}</TableCell>
                                <TableCell className="text-center font-bold text-orange-600">{d.stats.halfDay}</TableCell>
                                <TableCell className="text-center">
                                    <Badge variant="outline" className="font-black border-2 border-primary/20 text-primary">
                                        {d.stats.totalUnits.toFixed(1)}
                                    </Badge>
                                </TableCell>
                            </>
                        )}
                    </TableRow>
                ))}
                </TableBody>
            </Table>
           </div>
        </CardContent>
      </Card>
    </div>
  );
}
