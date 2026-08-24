'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { AttendanceStatus, Employee } from '@/types';

interface BulkMarkAttendanceDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  employees: Employee[];
  defaultDate: string; // yyyy-MM-dd, must fall within the visible month
  onApply: (data: { date: string; status: AttendanceStatus; employeeIds: string[] }) => void;
}

export function BulkMarkAttendanceDialog({ isOpen, setIsOpen, employees, defaultDate, onApply }: BulkMarkAttendanceDialogProps) {
  const [date, setDate] = useState(defaultDate);
  const [status, setStatus] = useState<AttendanceStatus>('Present');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen) {
      setDate(defaultDate);
      setStatus('Present');
      setSelectedIds(new Set(employees.map(e => e.id))); // default: everyone visible
    }
  }, [isOpen, defaultDate, employees]);

  const allSelected = selectedIds.size === employees.length && employees.length > 0;

  const toggleAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(employees.map(e => e.id)));
  };

  const toggleOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleApply = () => {
    if (selectedIds.size === 0 || !date) return;
    onApply({ date, status, employeeIds: Array.from(selectedIds) });
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Bulk Mark Attendance</DialogTitle>
          <DialogDescription>
            Applies to your pending changes — review and click Save Changes on the grid to persist.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="bulk-date">Date</Label>
              <Input id="bulk-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label>Status</Label>
              <Select onValueChange={(v) => setStatus(v as AttendanceStatus)} value={status}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Present">Present</SelectItem>
                  <SelectItem value="Absent">Absent</SelectItem>
                  <SelectItem value="Leave">Leave</SelectItem>
                  <SelectItem value="Half Day">Half Day</SelectItem>
                  <SelectItem value="Late">Late</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Employees ({selectedIds.size} of {employees.length} selected)</Label>
              <Button type="button" variant="outline" size="sm" onClick={toggleAll}>
                {allSelected ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
            <ScrollArea className="h-56 rounded-md border p-2">
              {employees.map((emp) => (
                <label key={emp.id} className="flex items-center gap-2 py-1.5 px-1 text-sm cursor-pointer hover:bg-muted/50 rounded">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(emp.id)}
                    onChange={() => toggleOne(emp.id)}
                  />
                  {emp.firstName} {emp.lastName}
                </label>
              ))}
              {employees.length === 0 && (
                <p className="text-sm text-muted-foreground p-2">No employees to mark.</p>
              )}
            </ScrollArea>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
          <Button type="button" onClick={handleApply} disabled={selectedIds.size === 0 || !date}>
            Apply to {selectedIds.size} Employee{selectedIds.size === 1 ? '' : 's'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
