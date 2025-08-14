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
import { useState, useEffect } from "react";

export function EditAttendanceDialog({ isOpen, setIsOpen, record, onEditRecord }) {
  const [employee, setEmployee] = useState('');
  const [date, setDate] = useState('');
  const [clockIn, setClockIn] = useState('');
  const [clockOut, setClockOut] = useState('');

  useEffect(() => {
    if (record) {
      setEmployee(record.employee);
      setDate(record.date);
      setClockIn(record.clockIn);
      setClockOut(record.clockOut);
    }
  }, [record]);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // In a real app, you would recalculate this
    const totalHours = record.totalHours;

    onEditRecord({
      ...record,
      employee,
      date,
      clockIn,
      clockOut,
      totalHours
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
              <Label htmlFor="clockIn" className="text-right">Clock In</Label>
              <Input id="clockIn" type="time" value={clockIn} onChange={(e) => setClockIn(e.target.value)} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="clockOut" className="text-right">Clock Out</Label>
              <Input id="clockOut" type="time" value={clockOut} onChange={(e) => setClockOut(e.target.value)} className="col-span-3" />
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
