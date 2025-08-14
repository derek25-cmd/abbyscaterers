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

export function EditJobDialog({ isOpen, setIsOpen, position, onEditJob }) {
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [location, setLocation] = useState('');
  const [type, setType] = useState('');
  const [applicants, setApplicants] = useState(0);

  useEffect(() => {
    if (position) {
      setTitle(position.title);
      setDepartment(position.department);
      setLocation(position.location);
      setType(position.type);
      setApplicants(position.applicants);
    }
  }, [position]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if(!title || !department || !location) {
        alert("Please fill all required fields");
        return;
    }

    onEditJob({
      ...position,
      title,
      department,
      location,
      type,
      applicants: Number(applicants)
    });

    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Job Posting</DialogTitle>
            <DialogDescription>
              Update the details for the job posting.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="title" className="text-right">Title</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="department" className="text-right">Department</Label>
               <Select onValueChange={setDepartment} value={department}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select a department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Kitchen">Kitchen</SelectItem>
                  <SelectItem value="Operations">Operations</SelectItem>
                  <SelectItem value="Logistics">Logistics</SelectItem>
                  <SelectItem value="Service Staff">Service Staff</SelectItem>
                  <SelectItem value="Admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
             <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="location" className="text-right">Location</Label>
              <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="type" className="text-right">Type</Label>
               <Select onValueChange={setType} value={type}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select a job type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Full-time">Full-time</SelectItem>
                  <SelectItem value="Part-time">Part-time</SelectItem>
                  <SelectItem value="Contract">Contract</SelectItem>
                  <SelectItem value="Internship">Internship</SelectItem>
                </SelectContent>
              </Select>
            </div>
             <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="applicants" className="text-right">Applicants</Label>
              <Input id="applicants" type="number" value={applicants} onChange={(e) => setApplicants(e.target.value)} className="col-span-3" min="0" />
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
