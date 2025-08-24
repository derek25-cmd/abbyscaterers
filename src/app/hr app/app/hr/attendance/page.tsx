// @ts-nocheck
'use client'

import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { CalendarIcon, MoreHorizontal, Clock } from "lucide-react";
import { format, parse } from "date-fns";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useState, useEffect } from "react";
import { EditAttendanceDialog } from "@/components/edit-attendance-dialog";
import { ViewAttendanceDialog } from "@/components/view-attendance-dialog";
import { LogAttendanceDialog } from "@/components/log-attendance-dialog";
import { getAttendanceRecords, addAttendanceRecord, updateAttendanceRecord, findAttendanceRecord } from "@/services/attendanceService";
import { getEmployees } from "@/services/employeeService";

export default function AttendancePage() {
  const [records, setRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isLogDialogOpen, setIsLogDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);

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

  const handleEditRecord = async (updatedRecord) => {
    await updateAttendanceRecord(updatedRecord.id, updatedRecord);
    setRecords(prevRecords => 
        prevRecords.map(record => 
            record.id === updatedRecord.id ? updatedRecord : record
        )
    );
  };

  const handleLogAttendance = async (logData) => {
    const now = new Date();
    const time = format(now, 'hh:mm a'); // e.g., 05:30 PM
    const date = format(now, 'yyyy-MM-dd');
    
    const existingRecord = await findAttendanceRecord(logData.employeeName, date);

    if (existingRecord) {
       // Clocking out
      const updatedRecord = { ...existingRecord, clockOut: time };
      
      const clockInTime = parse(`${existingRecord.date} ${existingRecord.clockIn}`, 'yyyy-MM-dd hh:mm a', new Date());
      const clockOutTime = parse(`${date} ${time}`, 'yyyy-MM-dd hh:mm a', new Date());

      const diffMs = clockOutTime - clockInTime;
      const diffHours = Math.floor(diffMs / 3600000);
      const diffMins = Math.floor((diffMs % 3600000) / 60000);
      updatedRecord.totalHours = `${diffHours}h ${diffMins}m`;
      
      await updateAttendanceRecord(existingRecord.id, updatedRecord);
      setRecords(records.map(r => r.id === existingRecord.id ? updatedRecord : r));
    } else {
      // Clocking in
      const newRecord = {
        employee: logData.employeeName,
        date: date,
        clockIn: time,
        clockOut: "—",
        totalHours: "—",
      };
      const newId = await addAttendanceRecord(newRecord);
      setRecords([{ id: newId, ...newRecord }, ...records]);
    }
  };

  const openEditDialog = (record) => {
    setSelectedRecord(record);
    setIsEditDialogOpen(true);
  };
  
  const openViewDialog = (record) => {
    setSelectedRecord(record);
    setIsViewDialogOpen(true);
  };
  
  const openLogDialog = () => {
    setIsLogDialogOpen(true);
  }

  return (
    <AppLayout>
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
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-[240px] justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Daily Attendance</CardTitle>
            <CardDescription>
              Showing records for {selectedDate ? format(selectedDate, "MMMM dd, yyyy") : ''}.
            </CardDescription>
          </CardHeader>
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
                {selectedDate && records.filter(r => r.date === format(selectedDate, "yyyy-MM-dd")).map((record) => (
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
      </main>
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
    </AppLayout>
  );
}
