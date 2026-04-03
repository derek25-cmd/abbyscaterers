// @ts-nocheck
'use client'

import React, { useState, useEffect } from "react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Search, Loader2, X, Plus, ChevronRight, ChevronLeft, 
  GraduationCap, Users, BookOpen, Zap, Sparkles, MapPin, ShieldCheck
} from "lucide-react";
import { getEmployees } from "@/services/employeeService";
import { DEFAULT_TRAINING_SKILLS } from "@/types";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: 1, title: "Genesis", icon: Zap },
  { id: 2, title: "Module Core", icon: BookOpen },
  { id: 3, title: "Deployment", icon: Users },
];

export function AddTrainingDialog({ isOpen, setIsOpen, onAddTraining }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [moduleCode, setModuleCode] = useState(`MDL-${Math.random().toString(36).substring(2, 7).toUpperCase()}`);
  const [department, setDepartment] = useState('Kitchen');
  const [location, setLocation] = useState('');
  const [type, setType] = useState('Skill Training');
  const [trainingDate, setTrainingDate] = useState(new Date().toISOString().split('T')[0]);
  const [trainer_name, setTrainerName] = useState('');
  const [durationDays, setDurationDays] = useState(1);
  const [description, setDescription] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [learningObjectives, setLearningObjectives] = useState([]);
  const [newObjective, setNewObjective] = useState('');
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
    setCurrentStep(1);
    setTitle('');
    setModuleCode(`MDL-${Math.random().toString(36).substring(2, 7).toUpperCase()}`);
    setDepartment('Kitchen');
    setLocation('');
    setTrainerName('');
    setDescription('');
    setLearningObjectives([]);
    setSelectedEmployees([]);
  };

  const addObjective = () => {
    if (newObjective.trim()) {
      setLearningObjectives([...learningObjectives, newObjective.trim()]);
      setNewObjective('');
    }
  };

  const toggleEmployee = (id) => {
    setSelectedEmployees(prev => 
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
      return;
    }

    setIsSubmitting(true);
    try {
      await onAddTraining({
        title,
        module_code: moduleCode,
        department,
        location,
        type,
        training_date: trainingDate,
        trainer_name,
        description,
        duration_days: Number(durationDays) || 1,
        learning_objectives: learningObjectives,
        custom_skills: customSkills,
        session_status: 'Upcoming',
        employeeIds: selectedEmployees
      });
      resetForm();
      setIsOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredEmployees = employees.filter(emp => 
    `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.department.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="bg-primary/5 border-b p-6 space-y-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-lg">
                <GraduationCap className="h-6 w-6" />
              </div>
              <DialogHeader className="p-0">
                <DialogTitle className="text-2xl font-black">Create Training Module</DialogTitle>
                <DialogDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Step {currentStep} of 3</DialogDescription>
              </DialogHeader>
            </div>

            <div className="flex items-center justify-between max-w-md mx-auto relative">
              <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-muted -translate-y-1/2 z-0" />
              {STEPS.map((s) => {
                const Icon = s.icon;
                const isActive = currentStep === s.id;
                const isCompleted = currentStep > s.id;
                return (
                  <div key={s.id} className="relative z-10 flex flex-col items-center gap-1">
                    <div className={cn(
                      "h-8 w-8 rounded-full flex items-center justify-center border-2 transition-all",
                      isActive ? "bg-primary border-primary text-primary-foreground scale-110 shadow-md" : 
                      isCompleted ? "bg-green-500 border-green-500 text-white" : 
                      "bg-background border-muted text-muted-foreground"
                    )}>
                      {isCompleted ? <ShieldCheck className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                    </div>
                    <span className={cn("text-[8px] font-black uppercase tracking-tighter", isActive ? "text-primary" : "text-muted-foreground")}>{s.title}</span>
                  </div>
                );
              })}
            </div>
          </div>
          
          <ScrollArea className="flex-1 p-8">
              {currentStep === 1 && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold">Topic / Training Title *</Label>
                        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Kitchen Safety" required />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold">Module Code</Label>
                        <Input value={moduleCode} readOnly className="bg-muted/50 font-mono text-xs" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold">Managing Department</Label>
                        <select 
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-primary outline-none"
                          value={department}
                          onChange={(e) => setDepartment(e.target.value)}
                        >
                          <option value="Kitchen">Kitchen Operations</option>
                          <option value="Operations">Internal Operations</option>
                          <option value="Logistics">Supply & Logistics</option>
                          <option value="Service Staff">Guest Services</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold">Training Date *</Label>
                        <Input type="date" value={trainingDate} onChange={(e) => setTrainingDate(e.target.value)} required />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold">Lead Trainer *</Label>
                        <Input value={trainer_name} onChange={(e) => setTrainerName(e.target.value)} placeholder="Trainer Name" required />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold">Venue / Location *</Label>
                        <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Main Kitchen" required />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold">Module Overview</Label>
                    <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description..." rows={3} />
                  </div>
                  <div className="space-y-3">
                    <Label className="text-xs font-bold">Learning Objectives</Label>
                    <div className="flex gap-2">
                      <Input placeholder="Define an objective..." value={newObjective} onChange={(e) => setNewObjective(e.target.value)} />
                      <Button type="button" size="icon" onClick={addObjective}><Plus className="h-4 w-4" /></Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {learningObjectives.map((obj, i) => (
                        <Badge key={i} variant="secondary" className="gap-1 py-1">
                          {obj}
                          <X className="h-3 w-3 cursor-pointer" onClick={() => setLearningObjectives(learningObjectives.filter((_, idx) => idx !== i))} />
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 3 && (
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search staff..." className="pl-10" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                  </div>
                  <div className="border rounded-xl bg-muted/5 divide-y">
                    {filteredEmployees.map(emp => (
                      <div key={emp.id} className="flex items-center gap-3 p-3 hover:bg-background transition-colors">
                        <input 
                          type="checkbox" 
                          id={`emp-${emp.id}`}
                          className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
                          checked={selectedEmployees.includes(emp.id)}
                          onChange={() => toggleEmployee(emp.id)}
                        />
                        <label htmlFor={`emp-${emp.id}`} className="flex-1 cursor-pointer">
                          <p className="text-sm font-bold">{emp.firstName} {emp.lastName}</p>
                          <p className="text-[10px] uppercase font-black text-muted-foreground">{emp.department} • {emp.role}</p>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
          </ScrollArea>

          <DialogFooter className="bg-muted/10 border-t px-8 py-4">
            <div className="flex justify-between w-full">
              <Button type="button" variant="ghost" onClick={currentStep === 1 ? () => setIsOpen(false) : prevStep} className="font-bold">
                {currentStep === 1 ? 'Cancel' : 'Back'}
              </Button>
              <Button type="submit" disabled={isSubmitting} className="font-bold px-8">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {currentStep < 3 ? 'Continue' : 'Launch Session'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
