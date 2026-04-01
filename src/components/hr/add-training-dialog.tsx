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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { getEmployees } from "@/services/employeeService";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Loader2, X, Plus } from "lucide-react";
import { DEFAULT_TRAINING_SKILLS } from "@/types";

export function AddTrainingDialog({ isOpen, setIsOpen, onAddTraining }) {
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [location, setLocation] = useState('');
  const [type, setType] = useState('Skill Training');
  const [trainingDate, setTrainingDate] = useState(new Date().toISOString().split('T')[0]);
  const [trainer_name, setTrainerName] = useState('');
  const [description, setDescription] = useState('');
  const [durationDays, setDurationDays] = useState(1);
  const [expectedOutcomes, setExpectedOutcomes] = useState('');
  const [customSkills, setCustomSkills] = useState([...DEFAULT_TRAINING_SKILLS]);
  const [newSkillInput, setNewSkillInput] = useState('');
  
  const [employees, setEmployees] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const fetchEmployees = async () => {
        setLoadingEmployees(true);
        const data = await getEmployees();
        setEmployees(data);
        setLoadingEmployees(false);
      };
      fetchEmployees();
    }
  }, [isOpen]);

  const resetForm = () => {
    setTitle('');
    setDepartment('');
    setLocation('');
    setType('Skill Training');
    setTrainingDate(new Date().toISOString().split('T')[0]);
    setTrainerName('');
    setDescription('');
    setDurationDays(1);
    setExpectedOutcomes('');
    setCustomSkills([...DEFAULT_TRAINING_SKILLS]);
    setNewSkillInput('');
    setSelectedEmployees([]);
    setSearchQuery('');
  }

  const toggleEmployee = (id) => {
    setSelectedEmployees(prev => 
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    );
  };

  const filteredEmployees = employees.filter(emp => 
    `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.department.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

    onAddTraining({
      title,
      department,
      location,
      type,
      training_date: trainingDate,
      trainer_name,
      description,
      duration_days: Number(durationDays) || 1,
      expected_outcomes: expectedOutcomes,
      custom_skills: customSkills,
      session_status: 'Upcoming',
      employeeIds: selectedEmployees
    });

    resetForm();
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] flex flex-col">
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <DialogHeader>
            <DialogTitle>Create New Training Session</DialogTitle>
            <DialogDescription>
              Define training details, assign staff, and configure evaluation criteria.
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="flex-1 pr-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
              {/* Left Column: Details */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title">Topic *</Label>
                  <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Food Safety" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="trainingDate">Training Date *</Label>
                    <Input id="trainingDate" type="date" value={trainingDate} onChange={(e) => setTrainingDate(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="duration">Duration (Days)</Label>
                    <Input id="duration" type="number" min={1} max={365} value={durationDays} onChange={(e) => setDurationDays(Number(e.target.value))} />
                  </div>
                </div>
                <div>
                  <Label htmlFor="department">Managing Department *</Label>
                  <Select onValueChange={setDepartment} value={department}>
                    <SelectTrigger>
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
                <div>
                  <Label htmlFor="location">Location *</Label>
                  <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="type">Training Type</Label>
                  <Select onValueChange={setType} value={type}>
                    <SelectTrigger>
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
                <div>
                  <Label htmlFor="trainer">Trainer Name</Label>
                  <Input id="trainer" value={trainer_name} onChange={(e) => setTrainerName(e.target.value)} placeholder="Full Name" />
                </div>
                <div>
                  <Label htmlFor="description">Training Description</Label>
                  <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief overview of the module" rows={2} className="resize-none" />
                </div>
                <div>
                  <Label htmlFor="outcomes">Expected Outcomes</Label>
                  <Textarea id="outcomes" value={expectedOutcomes} onChange={(e) => setExpectedOutcomes(e.target.value)} placeholder="What trainees should be able to do after this training..." rows={2} className="resize-none" />
                </div>

                {/* Custom Skills Configuration */}
                <div className="space-y-2">
                  <Label>Evaluation Skills</Label>
                  <p className="text-[11px] text-muted-foreground">Skills to assess during evaluations. Customize for this session.</p>
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

              {/* Right Column: Employee Selection */}
              <div className="flex flex-col space-y-2">
                <Label>Assign Staff ({selectedEmployees.length} selected)</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search staff or department..." 
                    className="pl-8" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                
                <div className="border rounded-md p-2 bg-muted/20 flex-1">
                  <ScrollArea className="h-[400px]">
                    {loadingEmployees ? (
                        <div className="flex justify-center items-center h-full py-20">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                    ) : (
                        <div className="space-y-2 pr-4">
                            {filteredEmployees.map(emp => (
                                <div key={emp.id} className="flex items-center space-x-3 p-2 rounded-md hover:bg-background transition-colors border border-transparent hover:border-border">
                                    <Checkbox 
                                        id={`emp-${emp.id}`} 
                                        checked={selectedEmployees.includes(emp.id)}
                                        onCheckedChange={() => toggleEmployee(emp.id)}
                                    />
                                    <Label htmlFor={`emp-${emp.id}`} className="flex flex-col cursor-pointer flex-1">
                                        <span className="font-bold text-sm tracking-tight">{emp.firstName} {emp.lastName}</span>
                                        <span className="text-[10px] uppercase text-muted-foreground font-black">{emp.department} • {emp.role}</span>
                                    </Label>
                                </div>
                            ))}
                            {filteredEmployees.length === 0 && (
                                <div className="text-center py-10 text-muted-foreground">No staff found</div>
                            )}
                        </div>
                    )}
                  </ScrollArea>
                </div>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="border-t pt-4 mt-2">
            <DialogClose asChild>
              <Button type="button" variant="outline" onClick={() => resetForm()}>Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={selectedEmployees.length === 0}>
               Schedule with {selectedEmployees.length} Participants
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
