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

export function EditIssuanceDialog({ isOpen, setIsOpen, logEntry, onEditIssuance, employees }) {
  const [issuedTo, setIssuedTo] = useState('');
  const [date, setDate] = useState('');

  useEffect(() => {
    if (logEntry) {
      const employee = employees.find(e => e.name === logEntry.issuedTo);
      setIssuedTo(employee ? employee.id : '');
      setDate(logEntry.date);
    }
  }, [logEntry, employees]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if(!issuedTo || !date) {
        alert("Please fill all required fields");
        return;
    }

    const employee = employees.find(e => e.id === issuedTo);
    
    onEditIssuance({
      ...logEntry,
      issuedTo: employee ? employee.name : '',
      date,
    });

    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Issuance Log</DialogTitle>
            <DialogDescription>
              Update the details for the issuance log entry.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="asset" className="text-right">Asset</Label>
              <Input id="asset" value={logEntry?.name} disabled className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="employee" className="text-right">Issued To</Label>
              <Select onValueChange={setIssuedTo} value={issuedTo}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select an employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.filter(e => e.status === 'Active').map(employee => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="date" className="text-right">Date</Label>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="col-span-3" />
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
