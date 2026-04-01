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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState, useEffect } from "react";
import { X, Plus } from "lucide-react";
import { DEFAULT_TRAINING_SKILLS } from "@/types";

export function EditTrainingDialog({ isOpen, setIsOpen, session, onEditTraining }) {
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [location, setLocation] = useState('');
  const [type, setType] = useState('');
  const [applicants, setApplicants] = useState(0);
  const [trainingDate, setTrainingDate] = useState('');
  const [trainer_name, setTrainerName] = useState('');
  const [description, setDescription] = useState('');
  const [durationDays, setDurationDays] = useState(1);
  const [expectedOutcomes, setExpectedOutcomes] = useState('');
  const [customSkills, setCustomSkills] = useState<string[]>([...DEFAULT_TRAINING_SKILLS]);
  const [newSkillInput, setNewSkillInput] = useState('');
  const [sessionStatus, setSessionStatus] = useState('Upcoming');

  useEffect(() => {
    if (session) {
      setTitle(session.title);
      setDepartment(session.department);
      setLocation(session.location);
      setType(session.type);
      setApplicants(session.applicants);
      setTrainingDate(session.training_date || new Date(session.createdAt).toISOString().split('T')[0]);
      setTrainerName(session.trainer_name || '');
      setDescription(session.description || '');
      setDurationDays(session.duration_days || 1);
      setExpectedOutcomes(session.expected_outcomes || '');
      setCustomSkills(session.custom_skills?.length > 0 ? session.custom_skills : [...DEFAULT_TRAINING_SKILLS]);
      setSessionStatus(session.session_status || 'Upcoming');
    }
  }, [session]);

  const addCustomSkill = () => {
    const skill = newSkillInput.trim();
    if (skill && !customSkills.includes(skill)) {
      setCustomSkills(prev => [...prev, skill]);
      setNewSkillInput('');
    }
  };

  const removeCustomSkill = (skill) => {
    setCustomSkills(prev => prev.filter(s => s !== skill));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if(!title || !department || !location) {
        alert("Please fill all required fields");
        return;
    }

    onEditTraining({
      ...session,
      title,
      department,
      location,
      type,
      applicants: Number(applicants),
      training_date: trainingDate,
      trainer_name,
      description,
      duration_days: Number(durationDays) || 1,
      expected_outcomes: expectedOutcomes,
      custom_skills: customSkills,
      session_status: sessionStatus
    });

    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col">
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <DialogHeader>
            <DialogTitle>Edit Training Session</DialogTitle>
            <DialogDescription>
              Update the details for the training session.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-2">
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="title" className="text-right">Topic</Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="trainingDate" className="text-right">Date</Label>
                <Input id="trainingDate" type="date" value={trainingDate} onChange={(e) => setTrainingDate(e.target.value)} className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="duration" className="text-right">Duration</Label>
                <div className="col-span-3 flex items-center gap-2">
                  <Input id="duration" type="number" min={1} max={365} value={durationDays} onChange={(e) => setDurationDays(Number(e.target.value))} className="w-20" />
                  <span className="text-xs text-muted-foreground font-medium">day(s)</span>
                </div>
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
                    <SelectValue placeholder="Select a training type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Skill Training">Skill Training</SelectItem>
                    <SelectItem value="Orientation">Orientation</SelectItem>
                    <SelectItem value="Compliance">Compliance</SelectItem>
                    <SelectItem value="Refresher">Refresher</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="status" className="text-right">Status</Label>
                <Select onValueChange={setSessionStatus} value={sessionStatus}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Upcoming">Upcoming</SelectItem>
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="applicants" className="text-right">Participants</Label>
                <Input id="applicants" type="number" value={applicants} onChange={(e) => setApplicants(e.target.value)} className="col-span-3" min="0" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="trainer" className="text-right">Trainer</Label>
                <Input id="trainer" value={trainer_name} onChange={(e) => setTrainerName(e.target.value)} className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="description" className="text-right mt-2">Description</Label>
                <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} className="col-span-3 resize-none" rows={2} />
              </div>
              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="outcomes" className="text-right mt-2">Outcomes</Label>
                <Textarea id="outcomes" value={expectedOutcomes} onChange={(e) => setExpectedOutcomes(e.target.value)} className="col-span-3 resize-none" rows={2} placeholder="Expected learning outcomes..." />
              </div>

              {/* Custom Skills */}
              <div className="grid grid-cols-4 items-start gap-4">
                <Label className="text-right mt-1">Skills</Label>
                <div className="col-span-3 space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {customSkills.map(skill => (
                      <Badge key={skill} variant="secondary" className="text-[10px] font-bold gap-1 pr-1">
                        {skill}
                        <button
                          type="button"
                          onClick={() => removeCustomSkill(skill)}
                          className="ml-0.5 hover:bg-destructive/20 hover:text-destructive rounded-full p-0.5 transition-colors"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add custom skill..."
                      className="text-xs h-8"
                      value={newSkillInput}
                      onChange={(e) => setNewSkillInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomSkill(); } }}
                    />
                    <Button type="button" variant="outline" size="sm" className="h-8 px-2" onClick={addCustomSkill}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="border-t pt-4 mt-2">
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
