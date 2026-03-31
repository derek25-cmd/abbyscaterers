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
import { Badge } from "./ui/badge";

export function ViewTrainingDialog({ isOpen, setIsOpen, session }) {
  if (!session) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Training Session Details</DialogTitle>
            <DialogDescription>
              Viewing details for the {session.title} session.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
             <div className="grid grid-cols-3 items-center gap-4">
              <Label className="text-right font-semibold">Session ID</Label>
              <span className="col-span-2 text-xs font-mono">{session.id}</span>
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
              <Label className="text-right font-semibold">Topic</Label>
              <span className="col-span-2">{session.title}</span>
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
              <Label className="text-right font-semibold">Date</Label>
              <span className="col-span-2 font-bold">{session.training_date ? format(parseISO(session.training_date), 'PPP') : 'Not Set'}</span>
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
              <Label className="text-right font-semibold">Department</Label>
              <span className="col-span-2">{session.department}</span>
            </div>
             <div className="grid grid-cols-3 items-center gap-4">
              <Label className="text-right font-semibold">Location</Label>
              <span className="col-span-2">{session.location}</span>
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
              <Label className="text-right font-semibold">Type</Label>
               <Badge variant="outline" className="col-span-2">{session.type}</Badge>
            </div>
             <div className="grid grid-cols-3 items-center gap-4 border-t pt-2 mt-2">
              <Label className="text-right font-semibold">Trainer</Label>
              <span className="col-span-2 font-bold text-primary">{session.trainer_name || 'N/A'}</span>
            </div>
            <div className="grid grid-cols-3 items-start gap-4 border-t pt-2">
              <Label className="text-right font-semibold mt-1">Description</Label>
              <span className="col-span-2 text-sm italic text-muted-foreground">{session.description || 'No description provided.'}</span>
            </div>
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
