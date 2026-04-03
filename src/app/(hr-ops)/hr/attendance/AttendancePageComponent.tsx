'use client'

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
    Search,
    ChevronLeft,
    ChevronRight,
    MoreHorizontal,
    Check,
    UserCheck,
    UserX,
    Users,
    Calendar as CalendarIcon,
    AlertCircle,
    Clock,
    Filter,
    Loader2,
    FileText
} from "lucide-react";
import {
    format,
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    isWeekend,
    startOfYear,
    addMonths,
    isSameDay
} from "date-fns";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams, useRouter } from 'next/navigation';
import { getAttendanceRecords, upsertAttendanceRecords } from "@/services/attendanceService";
import { getEmployees } from "@/services/employeeService";
import { Attendance, AttendanceStatus, Employee } from "@/types";
import "./AttendanceRedesign.css";

const STATUS_ORDER: (AttendanceStatus | null)[] = ['Present', 'Absent', 'Leave', 'Half Day', 'Late', null];

export function AttendancePageComponent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const employeeIdFilter = searchParams.get('employeeId');

    const [records, setRecords] = useState<Attendance[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    // Track unsaved changes: key is "employeeId:date", value is status
    const [pendingChanges, setPendingChanges] = useState<Record<string, AttendanceStatus | null>>({});

    // Date states
    const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

    const fetchData = useCallback(async () => {
        setLoading(true);
        const [recordsData, employeesData] = await Promise.all([
            getAttendanceRecords(),
            getEmployees()
        ]);
        setRecords(recordsData);
        setEmployees(employeesData);
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const daysInMonth = useMemo(() => {
        const date = new Date(currentYear, currentMonth, 1);
        const start = startOfMonth(date);
        const end = endOfMonth(date);
        return eachDayOfInterval({ start, end });
    }, [currentMonth, currentYear]);

    const yearMonths = useMemo(() => {
        const yearStart = startOfYear(new Date(currentYear, 0, 1));
        return Array.from({ length: 12 }).map((_, i) => addMonths(yearStart, i));
    }, [currentYear]);

    const filteredEmployees = useMemo(() => {
        let result = employees.filter(e => e.status === 'Active');
        if (employeeIdFilter) {
            result = result.filter(e => e.id === employeeIdFilter);
        }
        if (searchQuery) {
            const lowerQuery = searchQuery.toLowerCase();
            result = result.filter(e =>
                `${e.firstName} ${e.lastName}`.toLowerCase().includes(lowerQuery)
            );
        }
        return result;
    }, [employees, searchQuery, employeeIdFilter]);

    const handleToggleStatus = (employeeId: string, date: string, currentStatus?: AttendanceStatus) => {
        const currentIndex = currentStatus ? STATUS_ORDER.indexOf(currentStatus) : 5;
        const nextStatus = STATUS_ORDER[(currentIndex + 1) % STATUS_ORDER.length];

        const key = `${employeeId}:${date}`;
        setPendingChanges(prev => ({
            ...prev,
            [key]: nextStatus as AttendanceStatus
        }));
    };

    const handleSave = async () => {
        if (Object.keys(pendingChanges).length === 0) return;
        setSaving(true);

        const updates: Partial<Attendance>[] = Object.entries(pendingChanges).map(([key, status]) => {
            const [employeeId, date] = key.split(':');
            const emp = employees.find(e => e.id === employeeId);
            // Omit 'id' to let DB handle defaults for new records and avoid null constraint errors in bulk upserts
            return {
                employee_id: employeeId,
                employee: emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown',
                date: date,
                status: status as AttendanceStatus
            };
        });

        const result = await upsertAttendanceRecords(updates);
        if (result) {
            setRecords(prev => {
                const newRecords = [...prev];
                result.forEach(updated => {
                    const idx = newRecords.findIndex(r => r.employee_id === updated.employee_id && r.date === updated.date);
                    if (idx > -1) newRecords[idx] = updated;
                    else newRecords.push(updated);
                });
                return newRecords;
            });
            setPendingChanges({}); // Clear pending changes
        }
        setSaving(false);
    };

    const handleMarkAllPresent = () => {
        const today = format(new Date(), "yyyy-MM-dd");
        const newPending = { ...pendingChanges };
        let hasChanges = false;

        filteredEmployees.forEach(emp => {
            const existing = records.find(r => r.employee_id === emp.id && r.date === today);
            const pending = pendingChanges[`${emp.id}:${today}`];
            const currentStatus = pending !== undefined ? pending : existing?.status;

            if (currentStatus !== 'Present') {
                newPending[`${emp.id}:${today}`] = 'Present' as AttendanceStatus;
                hasChanges = true;
            }
        });

        if (hasChanges) {
            setPendingChanges(newPending);
        }
    };

    const getStatusInfo = (employeeId: string, date: Date) => {
        const dateStr = format(date, "yyyy-MM-dd");
        const key = `${employeeId}:${dateStr}`;

        // Priority: Pending Changes > Existing Records
        const pendingStatus = pendingChanges[key];
        const record = records.find(r => r.employee_id === employeeId && r.date === dateStr);

        return {
            status: pendingStatus !== undefined ? pendingStatus : record?.status,
            isUnsaved: pendingStatus !== undefined && pendingStatus !== record?.status
        };
    };

    const summary = useMemo(() => {
        const currentMonthStr = format(new Date(currentYear, currentMonth, 1), "yyyy-MM");
        const visibleEmployeesIds = new Set(filteredEmployees.map(e => e.id));

        // Create a combined set of status info for the visible month
        let totalPresentUnits = 0;
        let present = 0;
        let absent = 0;
        let halfDay = 0;
        let late = 0;
        let totalMarked = 0;

        filteredEmployees.forEach(emp => {
            daysInMonth.forEach(day => {
                if (isWeekend(day)) return;
                const dateStr = format(day, "yyyy-MM-dd");
                const info = getStatusInfo(emp.id, day);
                const status = info.status;

                if (status) {
                    totalMarked++;
                    if (status === 'Present') { present++; totalPresentUnits += 1; }
                    else if (status === 'Late') { late++; totalPresentUnits += 1; }
                    else if (status === 'Half Day') { halfDay++; totalPresentUnits += 0.5; }
                    else if (status === 'Absent') { absent++; }
                }
            });
        });

        return {
            totalEmployees: filteredEmployees.length,
            present: present + late,
            absent,
            late,
            rate: totalMarked > 0 ? (totalPresentUnits / totalMarked) * 100 : 0
        };
    }, [records, currentMonth, currentYear, filteredEmployees, pendingChanges, daysInMonth]);

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                    <p className="text-lg font-semibold text-muted-foreground">Loading Registry...</p>
                </div>
            </div>
        );
    }

    return (
        <main className="attendance-content-wrapper p-4 md:p-8">
            <div className="attendance-container">
                <div className="attendance-header">
                    <h1>✨ Employee Attendance Registry</h1>
                    <p>Streamlined daily presence tracking and registry management</p>
                    <div className="attendance-date-range">
                        <CalendarIcon className="mr-2 inline-block h-4 w-4" />
                        {format(new Date(currentYear, currentMonth, 1), "MMMM yyyy")}
                    </div>
                </div>

                <div className="attendance-controls">
                    <div className="flex flex-1 items-center gap-4">
                        <div className="relative w-full max-w-sm">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder="Search employees..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <Button variant="outline" onClick={handleMarkAllPresent} className="hidden md:flex">
                            <Check className="mr-2 h-4 w-4" /> Mark All Present Today
                        </Button>

                        {Object.keys(pendingChanges).length > 0 && (
                            <Button className="btn-save" onClick={handleSave} disabled={saving}>
                                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                                Save Changes ({Object.keys(pendingChanges).length})
                            </Button>
                        )}

                        <Button
                            variant="outline"
                            className="btn-report ml-2"
                            onClick={() => router.push(`/reports/monthly-attendance?month=${currentMonth}&year=${currentYear}`)}
                        >
                            <FileText className="mr-2 h-4 w-4" /> View Full Report
                        </Button>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center rounded-lg border bg-background p-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => {
                                    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); }
                                    else { setCurrentMonth(m => m - 1); }
                                }}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="px-4 text-sm font-bold">
                                {format(new Date(currentYear, currentMonth, 1), "MMM yyyy")}
                            </span>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => {
                                    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); }
                                    else { setCurrentMonth(m => m + 1); }
                                }}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                        <Button variant="ghost" size="icon">
                            <Filter className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                <div className="attendance-month-selector">
                    {yearMonths.map((m, i) => (
                        <button
                            key={i}
                            className={cn("attendance-month-btn", currentMonth === i && "active")}
                            onClick={() => setCurrentMonth(i)}
                        >
                            {format(m, "MMMM")}
                        </button>
                    ))}
                </div>

                <div className="attendance-content">
                    <div className="mb-6 flex flex-wrap gap-6 border-b pb-6">
                        <div className="legend-item"><div className="legend-box attendance-cell p">P</div> <span>Present</span></div>
                        <div className="legend-item"><div className="legend-box attendance-cell a">A</div> <span>Absent</span></div>
                        <div className="legend-item"><div className="legend-box attendance-cell l">L</div> <span>Leave</span></div>
                        <div className="legend-item"><div className="legend-box attendance-cell h">H</div> <span>Half Day</span></div>
                        <div className="legend-item"><div className="legend-box attendance-cell t">T</div> <span>Late</span></div>
                        <div className="ml-auto text-xs font-bold uppercase tracking-widest text-muted-foreground">
                            💡 Click cells to cycle status • <span className="text-destructive">●</span> Unsaved
                        </div>
                    </div>

                    <div className="attendance-table-container">
                        <table className="attendance-table">
                            <thead>
                                <tr>
                                    <th>No.</th>
                                    <th>Employee Name</th>
                                    {daysInMonth.map(day => (
                                        <th key={day.toString()} className={cn(isWeekend(day) && "attendance-weekend")}>
                                            {format(day, "d")}
                                            <div className="text-[10px] uppercase opacity-50">{format(day, "eee")}</div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredEmployees.map((emp, idx) => (
                                    <tr key={emp.id}>
                                        <td>{idx + 1}</td>
                                        <td>
                                            <div className="flex flex-col">
                                                <span className="truncate">{emp.firstName} {emp.lastName}</span>
                                                <span className="text-[10px] text-muted-foreground">{emp.role} • {emp.department}</span>
                                            </div>
                                        </td>
                                        {daysInMonth.map(day => {
                                            const isWknd = isWeekend(day);
                                            const info = getStatusInfo(emp.id, day);
                                            const status = info.status;
                                            const isUnsaved = info.isUnsaved;

                                            return (
                                                <td key={day.toString()} className={cn(isWknd && "attendance-weekend")}>
                                                    <div
                                                        className={cn(
                                                            "attendance-cell",
                                                            status?.toLowerCase().replace(' ', ''),
                                                            isUnsaved && "unsaved"
                                                        )}
                                                        onClick={() => handleToggleStatus(emp.id, format(day, "yyyy-MM-dd"), (status || undefined) as AttendanceStatus | undefined)}
                                                    >
                                                        {status ? status.charAt(0) : ''}
                                                    </div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="attendance-summary-section">
                        <h3>📊 Monthly Performance Summary</h3>
                        <div className="attendance-summary-grid">
                            <div className="attendance-summary-card">
                                <div className="attendance-summary-number">{summary.totalEmployees}</div>
                                <div className="attendance-summary-label">Active Staff</div>
                            </div>
                            <div className="attendance-summary-card">
                                <div className="attendance-summary-number" style={{ color: '#22c55e' }}>{summary.present}</div>
                                <div className="attendance-summary-label">Total Present</div>
                            </div>
                            <div className="attendance-summary-card">
                                <div className="attendance-summary-number" style={{ color: '#ef4444' }}>{summary.absent}</div>
                                <div className="attendance-summary-label">Total Absent</div>
                            </div>
                            <div className="attendance-summary-card">
                                <div className="attendance-summary-number" style={{ color: '#8b5cf6' }}>{summary.rate.toFixed(1)}%</div>
                                <div className="attendance-summary-label">Attendance Rate</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
