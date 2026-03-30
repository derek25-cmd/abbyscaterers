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
    Filter
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
import { useSearchParams } from 'next/navigation';
import { getAttendanceRecords, upsertAttendanceRecord, upsertAttendanceRecords } from "@/services/attendanceService";
import { getEmployees } from "@/services/employeeService";
import { Attendance, AttendanceStatus, Employee } from "@/types";
import "./AttendanceRedesign.css";

const STATUS_ORDER: (AttendanceStatus | null)[] = ['Present', 'Absent', 'Leave', 'Half Day', 'Late', null];

export function AttendancePageComponent() {
    const searchParams = useSearchParams();
    const employeeIdFilter = searchParams.get('employeeId');

    const [records, setRecords] = useState<Attendance[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    
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

    const handleToggleStatus = async (employeeId: string, date: string, currentStatus?: AttendanceStatus) => {
        const currentIndex = currentStatus ? STATUS_ORDER.indexOf(currentStatus) : 5;
        const nextStatus = STATUS_ORDER[(currentIndex + 1) % STATUS_ORDER.length];
        
        const emp = employees.find(e => e.id === employeeId);
        if (!emp) return;

        const employeeName = `${emp.firstName} ${emp.lastName}`;

        if (nextStatus === null) {
            // In a real app we might delete, but here we just leave as empty/null logic if desired
            // For now, let's just cycle back to Present or keep it null.
            // If they want to "clear", we'd need a delete service.
            // Let's just cycle through: P -> A -> L -> H -> T -> (Empty then P again)
        }

        const numericStatus = nextStatus as AttendanceStatus;

        // Optimistic update
        const tempId = Math.random().toString();
        const newRecord: Attendance = {
            id: records.find(r => r.employee_id === employeeId && r.date === date)?.id || tempId,
            employee_id: employeeId,
            employee: employeeName,
            date: date,
            status: numericStatus,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        if (!numericStatus) {
            // If it's null, we just remove it locally for now (assuming cycling to empty)
            setRecords(prev => prev.filter(r => !(r.employee_id === employeeId && r.date === date)));
            // In a real app, call deleteAttendanceRecord
            return;
        }

        setRecords(prev => {
            const index = prev.findIndex(r => r.employee_id === employeeId && r.date === date);
            if (index > -1) {
                const newArr = [...prev];
                newArr[index] = newRecord;
                return newArr;
            }
            return [...prev, newRecord];
        });

        await upsertAttendanceRecord(newRecord);
    };

    const handleMarkAllPresent = async () => {
        const today = format(new Date(), "yyyy-MM-dd");
        const updates: any[] = filteredEmployees.map(emp => {
            const existing = records.find(r => r.employee_id === emp.id && r.date === today);
            if (existing && existing.status === 'Present') return null;
            
            return {
                id: existing?.id, // Supabase needs the ID for proper upsert if it exists
                employee_id: emp.id,
                employee: `${emp.firstName} ${emp.lastName}`,
                date: today,
                status: 'Present' as AttendanceStatus
            };
        }).filter((u) => u !== null);

        if (updates.length === 0) return;

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
        }
    };

    const getStatusInfo = (employeeId: string, date: Date) => {
        const dateStr = format(date, "yyyy-MM-dd");
        const record = records.find(r => r.employee_id === employeeId && r.date === dateStr);
        return record;
    };

    const summary = useMemo(() => {
        const currentMonthStr = format(new Date(currentYear, currentMonth, 1), "yyyy-MM");
        
        // Only count records that belong to the current visible month AND one of our active employees
        const visibleEmployeesIds = new Set(filteredEmployees.map(e => e.id));
        const monthRecords = records.filter(r => 
            r.date.startsWith(currentMonthStr) && visibleEmployeesIds.has(r.employee_id)
        );

        const present = monthRecords.filter(r => r.status === 'Present').length;
        const absent = monthRecords.filter(r => r.status === 'Absent').length;
        const halfDay = monthRecords.filter(r => r.status === 'Half Day').length;
        const late = monthRecords.filter(r => r.status === 'Late').length;

        // Total "Present-like" units (treating Half Day as 0.5 can be done here if desired)
        const totalPresentUnits = present + late + (halfDay * 0.5);

        return {
            totalEmployees: filteredEmployees.length,
            present: present + late, // Combined for simplicity in summary card
            absent,
            late,
            rate: monthRecords.length > 0 ? (totalPresentUnits / monthRecords.length) * 100 : 0
        };
    }, [records, currentMonth, currentYear, filteredEmployees]);

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
                            💡 Click cells to cycle status
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
                                            const record = getStatusInfo(emp.id, day);
                                            const status = record?.status;
                                            
                                            return (
                                                <td key={day.toString()} className={cn(isWknd && "attendance-weekend")}>
                                                    <div 
                                                        className={cn(
                                                            "attendance-cell",
                                                            status?.toLowerCase().replace(' ', '')
                                                        )}
                                                        onClick={() => handleToggleStatus(emp.id, format(day, "yyyy-MM-dd"), status)}
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
