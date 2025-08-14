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

export function ViewJobDialog({ isOpen, setIsOpen, position }) {
  if (!position) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Job Posting Details</DialogTitle>
            <DialogDescription>
              Viewing details for the {position.title} position.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
             <div className="grid grid-cols-3 items-center gap-4">
              <Label className="text-right font-semibold">Job ID</Label>
              <span className="col-span-2">{position.id}</span>
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
              <Label className="text-right font-semibold">Title</Label>
              <span className="col-span-2">{position.title}</span>
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
              <Label className="text-right font-semibold">Department</Label>
              <span className="col-span-2">{position.department}</span>
            </div>
             <div className="grid grid-cols-3 items-center gap-4">
              <Label className="text-right font-semibold">Location</Label>
              <span className="col-span-2">{position.location}</span>
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
              <Label className="text-right font-semibold">Type</Label>
               <Badge variant="outline" className="col-span-2">{position.type}</Badge>
            </div>
             <div className="grid grid-cols-3 items-center gap-4">
              <Label className="text-right font-semibold">Applicants</Label>
              <span className="col-span-2">{position.applicants}</span>
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
