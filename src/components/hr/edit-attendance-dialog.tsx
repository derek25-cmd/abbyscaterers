// @ts-nocheck
'use client'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";

export function EditAttendanceDialog({ isOpen, setIsOpen, record, onEditRecord }) {
  const [employee, setEmployee] = useState('');
  const [date, setDate] = useState('');
  const [clockInTime, setClockInTime] = useState('');
  const [clockOutTime, setClockOutTime] = useState('');
  const [status, setStatus] = useState('Present');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (record) {
      setEmployee(record.employee);
      setDate(record.date || '');
      setClockInTime(record.clock_in_time || (record.clockIn !== '—' ? record.clockIn : ''));
      setClockOutTime(record.clock_out_time || (record.clockOut !== '—' ? record.clockOut : ''));
      setStatus(record.status || 'Present');
      setNotes(record.notes || '');
    }
  }, [record]);

  const handleSubmit = (e) => {
    e.preventDefault();

    onEditRecord({
      ...record,
      employee,
      date,
      clock_in_time: clockInTime,
      clock_out_time: clockOutTime,
      status,
      notes,
      // fallback legacy properties to avoid UI crashes
      clockIn: clockInTime || "—",
      clockOut: clockOutTime || "—",
    });

    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Attendance Record</DialogTitle>
            <DialogDescription>
              Update the details for the attendance record.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="employee" className="text-right">Employee</Label>
              <Input id="employee" value={employee} disabled className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="date" className="text-right">Date</Label>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="status" className="text-right">Status</Label>
              <Select onValueChange={setStatus} value={status}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Present">Present</SelectItem>
                  <SelectItem value="Absent">Absent</SelectItem>
                  <SelectItem value="Leave">On Leave</SelectItem>
                  <SelectItem value="Half Day">Half Day</SelectItem>
                  <SelectItem value="Late">Late / Tardy</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="clockIn" className="text-right">Clock In</Label>
              <Input id="clockIn" type="time" value={clockInTime} onChange={(e) => setClockInTime(e.target.value)} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="clockOut" className="text-right">Clock Out</Label>
              <Input id="clockOut" type="time" value={clockOutTime} onChange={(e) => setClockOutTime(e.target.value)} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="notes" className="text-right">Notes</Label>
              <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="col-span-3" placeholder="Optional remarks" />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit">Save Changes</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
