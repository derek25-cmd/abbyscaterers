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
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";

const STATUS_COLORS = {
  'Upcoming': 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  'In Progress': 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  'Completed': 'bg-green-500/10 text-green-600 border-green-500/20',
};

export function ViewTrainingDialog({ isOpen, setIsOpen, session }) {
  if (!session) return null;

  const status = session.session_status || 'Upcoming';

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[480px]">
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
              <span className="col-span-2 font-bold">{session.title}</span>
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
              <Label className="text-right font-semibold">Date</Label>
              <span className="col-span-2 font-bold">{session.training_date ? format(parseISO(session.training_date), 'PPP') : 'Not Set'}</span>
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
              <Label className="text-right font-semibold">Duration</Label>
              <span className="col-span-2">{session.duration_days || 1} day{(session.duration_days || 1) !== 1 ? 's' : ''}</span>
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
              <Label className="text-right font-semibold">Status</Label>
              <Badge variant="outline" className={`col-span-2 w-fit ${STATUS_COLORS[status] || ''}`}>{status}</Badge>
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
               <Badge variant="outline" className="col-span-2 w-fit">{session.type}</Badge>
            </div>
             <div className="grid grid-cols-3 items-center gap-4 border-t pt-3">
              <Label className="text-right font-semibold">Trainer</Label>
              <span className="col-span-2 font-bold text-primary">{session.trainer_name || 'N/A'}</span>
            </div>
            <div className="grid grid-cols-3 items-start gap-4">
              <Label className="text-right font-semibold mt-1">Description</Label>
              <span className="col-span-2 text-sm italic text-muted-foreground">{session.description || 'No description provided.'}</span>
            </div>
            {session.expected_outcomes && (
              <div className="grid grid-cols-3 items-start gap-4">
                <Label className="text-right font-semibold mt-1">Outcomes</Label>
                <span className="col-span-2 text-sm text-muted-foreground">{session.expected_outcomes}</span>
              </div>
            )}
            {session.custom_skills?.length > 0 && (
              <div className="grid grid-cols-3 items-start gap-4 border-t pt-3">
                <Label className="text-right font-semibold mt-1">Eval Skills</Label>
                <div className="col-span-2 flex flex-wrap gap-1.5">
                  {session.custom_skills.map((skill: string) => (
                    <Badge key={skill} variant="secondary" className="text-[10px] font-bold">{skill}</Badge>
                  ))}
                </div>
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
