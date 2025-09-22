
'use client'

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { CalendarIcon, MoreHorizontal, Clock, Search, X, Users, UserCheck, UserX } from "lucide-react";
import { format, parse } from "date-fns";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from 'next/navigation';
import { EditAttendanceDialog } from "@/components/hr/edit-attendance-dialog";
import { ViewAttendanceDialog } from "@/components/hr/view-attendance-dialog";
import { LogAttendanceDialog } from "@/components/hr/log-attendance-dialog";
import { getAttendanceRecords, addAttendanceRecord, updateAttendanceRecord, findAttendanceRecord } from "@/services/attendanceService";
import { getEmployees } from "@/services/employeeService";
import { Input } from "@/components/ui/input";

export function AttendancePageComponent() {
  const searchParams = useSearchParams();
  const employeeIdFilter = searchParams.get('employeeId');

  const [records, setRecords] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isLogDialogOpen, setIsLogDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setSelectedDate(new Date());
    const fetchData = async () => {
        setLoading(true);
        const [recordsData, employeesData] = await Promise.all([
            getAttendanceRecords(),
            getEmployees()
        ]);
        setRecords(recordsData);
        setEmployees(employeesData);
        setLoading(false);
    }
    fetchData();
  }, []);
  
  const filteredRecords = useMemo(() => {
    let dateFilteredRecords = [];
    if (selectedDate) {
        const dateStr = format(selectedDate, "yyyy-MM-dd");
        dateFilteredRecords = records.filter(r => r.date === dateStr);
    } else {
        dateFilteredRecords = records;
    }
    
    let employeeFilteredRecords = dateFilteredRecords;
    if (employeeIdFilter) {
        const employee = employees.find(e => e.id === employeeIdFilter);
        if (employee) {
            const fullName = [employee.firstName, employee.middleName, employee.lastName].filter(Boolean).join(' ');
            employeeFilteredRecords = dateFilteredRecords.filter(r => r.employee === fullName);
        }
    }
    
    if (!searchQuery) {
        return employeeFilteredRecords;
    }
    
    const lowercasedQuery = searchQuery.toLowerCase();
    return employeeFilteredRecords.filter(record => 
        record.employee.toLowerCase().includes(lowercasedQuery)
    );
  }, [records, selectedDate, searchQuery, employeeIdFilter, employees]);


  const handleEditRecord = async (updatedRecord: any) => {
    await updateAttendanceRecord(updatedRecord.id, updatedRecord);
    setRecords(prevRecords => 
        prevRecords.map(record => 
            record.id === updatedRecord.id ? updatedRecord : record
        )
    );
  };

  const handleLogAttendance = async (logData: any) => {
    const now = new Date();
    const time = format(now, 'hh:mm a'); // e.g., 05:30 PM
    const date = format(now, 'yyyy-MM-dd');
    
    const employee = employees.find(e => e.id === logData.employeeId);
    if (!employee) return;
    
    const employeeFullName = [employee.firstName, employee.middleName, employee.lastName].filter(Boolean).join(' ');
    const existingRecord = await findAttendanceRecord(employeeFullName, date);

    if (existingRecord) {
       // Clocking out
      const updatedRecord = { ...existingRecord, clockOut: time };
      
      const clockInTime = parse(`${existingRecord.date} ${existingRecord.clockIn}`, 'yyyy-MM-dd hh:mm a', new Date());
      const clockOutTime = parse(`${date} ${time}`, 'yyyy-MM-dd hh:mm a', new Date());

      const diffMs = clockOutTime.getTime() - clockInTime.getTime();
      const diffHours = Math.floor(diffMs / 3600000);
      const diffMins = Math.floor((diffMs % 3600000) / 60000);
      updatedRecord.totalHours = `${diffHours}h ${diffMins}m`;
      
      await updateAttendanceRecord(existingRecord.id, updatedRecord);
      setRecords(records.map(r => r.id === existingRecord.id ? updatedRecord : r));
    } else {
      // Clocking in
      const newRecord = {
        employee: employeeFullName,
        date: date,
        clockIn: time,
        clockOut: "—",
        totalHours: "—",
      };
      const newId = await addAttendanceRecord(newRecord);
      setRecords([{ id: newId, ...newRecord }, ...records]);
    }
  };

  const openEditDialog = (record: any) => {
    setSelectedRecord(record);
    setIsEditDialogOpen(true);
  };
  
  const openViewDialog = (record: any) => {
    setSelectedRecord(record);
    setIsViewDialogOpen(true);
  };
  
  const openLogDialog = () => {
    setIsLogDialogOpen(true);
  }
  
  const attendanceSummary = useMemo(() => {
    const activeEmployees = employees.filter(e => e.status === 'Active');
    const presentToday = new Set(filteredRecords.map(r => r.employee));
    const absentCount = activeEmployees.length - presentToday.size;
    return {
        total: activeEmployees.length,
        present: presentToday.size,
        absent: absentCount < 0 ? 0 : absentCount,
    }
  }, [employees, filteredRecords]);

  return (
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="flex items-center">
          <h1 className="font-headline text-2xl font-bold">Attendance Log</h1>
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" className="h-8 gap-1" onClick={openLogDialog}>
                <Clock className="h-3.5 w-3.5" />
                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                    Clock In / Out
                </span>
            </Button>
          </div>
        </div>

         <div className="grid gap-4 md:grid-cols-3">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{attendanceSummary.total}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Present Today</CardTitle>
                    <UserCheck className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-green-600">{attendanceSummary.present}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Absent Today</CardTitle>
                    <UserX className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-red-600">{attendanceSummary.absent}</div>
                </CardContent>
            </Card>
        </div>


        <Card>
          <CardHeader>
            <CardTitle>Daily Attendance</CardTitle>
            <CardDescription>
              {selectedDate ? `Showing records for ${format(selectedDate, "MMMM dd, yyyy")}` : "Showing all records"}.
            </CardDescription>
          </CardHeader>
           <div className="p-6 pt-0 flex items-center gap-2">
              <div className="relative flex-1 md:grow-0">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search by employee..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg bg-background pl-8 md:w-[200px] lg:w-[320px]"
                />
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-[240px] justify-start text-left font-normal h-9",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
               {selectedDate && (
                <Button variant="ghost" size="sm" onClick={() => setSelectedDate(undefined)}>
                  <X className="h-4 w-4 mr-1" />
                  Show All
                </Button>
              )}
          </div>
          <CardContent>
            {loading ? (
                <p>Loading attendance records...</p>
            ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Clock In</TableHead>
                  <TableHead>Clock Out</TableHead>
                  <TableHead>Total Hours</TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium">{record.employee}</TableCell>
                    <TableCell>{record.clockIn}</TableCell>
                    <TableCell>{record.clockOut}</TableCell>
                    <TableCell>{record.totalHours}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button aria-haspopup="true" size="icon" variant="ghost">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Toggle menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => openViewDialog(record)}>View Details</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEditDialog(record)}>Edit</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            )}
          </CardContent>
        </Card>
      
      {selectedRecord && (
        <EditAttendanceDialog
          isOpen={isEditDialogOpen}
          setIsOpen={setIsEditDialogOpen}
          record={selectedRecord}
          onEditRecord={handleEditRecord}
        />
      )}
       {selectedRecord && (
        <ViewAttendanceDialog
          isOpen={isViewDialogOpen}
          setIsOpen={setIsViewDialogOpen}
          record={selectedRecord}
        />
      )}
      <LogAttendanceDialog
        isOpen={isLogDialogOpen}
        setIsOpen={setIsLogDialogOpen}
        employees={employees.filter(e => e.status === 'Active')}
        onLogAttendance={handleLogAttendance}
      />
    </main>
  );
}
