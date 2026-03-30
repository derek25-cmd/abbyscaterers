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

export function ViewAttendanceDialog({ isOpen, setIsOpen, record }) {
  if (!record) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Attendance Details</DialogTitle>
            <DialogDescription>
              Viewing attendance for {record.employee} on {record.date}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-3 items-center gap-4">
              <Label className="text-right font-semibold">Record ID</Label>
              <span className="col-span-2">{record.id}</span>
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
              <Label className="text-right font-semibold">Employee</Label>
              <span className="col-span-2">{record.employee}</span>
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
              <Label className="text-right font-semibold">Date</Label>
              <span className="col-span-2">{record.date}</span>
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
              <Label className="text-right font-semibold">Status</Label>
              <span className="col-span-2">{record.status || 'Present'}</span>
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
              <Label className="text-right font-semibold">Clock In</Label>
              <span className="col-span-2">{record.clock_in_time || record.clockIn || '—'}</span>
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
              <Label className="text-right font-semibold">Clock Out</Label>
              <span className="col-span-2">{record.clock_out_time || record.clockOut || '—'}</span>
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
              <Label className="text-right font-semibold">Total Hours</Label>
              <span className="col-span-2">{record.totalHours || '—'}</span>
            </div>
            {record.notes && (
              <div className="grid grid-cols-3 items-center gap-4">
                <Label className="text-right font-semibold">Notes</Label>
                <span className="col-span-2 text-sm italic">{record.notes}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Close</Button>
            </DialogClose>
          </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
