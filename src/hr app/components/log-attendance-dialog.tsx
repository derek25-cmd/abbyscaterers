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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";

export function LogAttendanceDialog({ isOpen, setIsOpen, employees, onLogAttendance }) {
  const [employeeId, setEmployeeId] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!employeeId) {
      alert("Please select an employee.");
      return;
    }
    
    const employee = employees.find(e => e.id === employeeId);

    onLogAttendance({
      employeeId,
      employeeName: employee.name
    });

    // Reset form and close dialog
    setEmployeeId('');
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Clock In / Clock Out</DialogTitle>
            <DialogDescription>
              Select your name to log your attendance. The system will automatically detect if you are clocking in or out.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="employee" className="text-right">
                Employee
              </Label>
              <Select onValueChange={setEmployeeId} value={employeeId}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select an employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map(employee => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit">Submit</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
