'use client'
/**
 * @fileOverview Redesigned Add Training Dialog with 3-step wizard.
 * Fixes recursion errors by using stable UI patterns.
 */

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
  GraduationCap, Users, BookOpen, Zap, Sparkles, ShieldCheck
} from "lucide-react";
import { getEmployees } from "@/services/employeeService";
import { DEFAULT_TRAINING_SKILLS } from "@/types";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: 1, title: "Genesis", icon: Zap },
  { id: 2, title: "Module Core", icon: BookOpen },
  { id: 3, title: "Deployment", icon: Users },
];

export function AddTrainingDialog({ isOpen, setIsOpen, onAddTraining }: any) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [moduleCode, setModuleCode] = useState('');
  const [department, setDepartment] = useState('Kitchen');
  const [location, setLocation] = useState('');
  const [type, setType] = useState('Skill Training');
  const [trainingDate, setTrainingDate] = useState(new Date().toISOString().split('T')[0]);
  const [trainer_name, setTrainerName] = useState('');
  const [durationDays, setDurationDays] = useState(1);
  const [description, setDescription] = useState('');
  const [learningObjectives, setLearningObjectives] = useState<string[]>([]);
  const [newObjective, setNewObjective] = useState('');
  const [employees, setEmployees] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const fetchEmployees = async () => {
        setLoadingEmployees(true);
        const data = await getEmployees();
        setEmployees(data || []);
        setLoadingEmployees(false);
      };
      fetchEmployees();
      setModuleCode(`MDL-${Math.random().toString(36).substring(2, 7).toUpperCase()}`);
    } else {
        resetForm();
    }
  }, [isOpen]);

  const resetForm = () => {
    setCurrentStep(1);
    setTitle('');
    setDepartment('Kitchen');
    setLocation('');
    setTrainerName('');
    setDescription('');
    setLearningObjectives([]);
    setSelectedEmployees([]);
    setSearchQuery('');
  };

  const addObjective = () => {
    if (newObjective.trim()) {
      setLearningObjectives([...learningObjectives, newObjective.trim()]);
      setNewObjective('');
    }
  };

  const toggleEmployee = (id: string) => {
    setSelectedEmployees(prev => 
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    );
  };

  const nextStep = () => {
    if (currentStep < 3) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentStep < 3) {
      nextStep();
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
        custom_skills: [...DEFAULT_TRAINING_SKILLS],
        session_status: 'Upcoming',
        employeeIds: selectedEmployees
      });
      setIsOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredEmployees = (employees || []).filter(emp => 
    `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.department.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] flex flex-col p-0 overflow-hidden bg-background border-none shadow-2xl">
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="bg-primary/5 border-b p-6 space-y-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-lg">
                <GraduationCap className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <DialogHeader className="p-0">
                  <DialogTitle className="text-2xl font-black text-foreground tracking-tight">Setup Training Module</DialogTitle>
                  <DialogDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2">
                    <Sparkles className="h-3 w-3" /> Step {currentStep} of 3 • {STEPS[currentStep - 1].title}
                  </DialogDescription>
                </DialogHeader>
              </div>
            </div>

            <div className="flex items-center justify-between max-w-md mx-auto relative px-4">
              <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-muted -translate-y-1/2 z-0" />
              {STEPS.map((s) => {
                const Icon = s.icon;
                const isActive = currentStep === s.id;
                const isCompleted = currentStep > s.id;
                return (
                  <div key={s.id} className="relative z-10 flex flex-col items-center gap-1.5">
                    <div className={cn(
                      "h-9 w-9 rounded-full flex items-center justify-center border-4 transition-all duration-300",
                      isActive ? "bg-primary border-primary/20 text-white scale-110 shadow-lg" : 
                      isCompleted ? "bg-green-500 border-green-500/20 text-white" : 
                      "bg-background border-muted text-muted-foreground"
                    )}>
                      {isCompleted ? <ShieldCheck className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                    </div>
                    <span className={cn("text-[9px] font-black uppercase tracking-tighter", isActive ? "text-primary" : "text-muted-foreground")}>{s.title}</span>
                  </div>
                );
              })}
            </div>
          </div>
          
          <ScrollArea className="flex-1 px-8 py-6">
              {currentStep === 1 && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Topic / Training Title *</Label>
                        <Input 
                          value={title} 
                          onChange={(e) => setTitle(e.target.value)} 
                          placeholder="e.g. Advanced Pastry Techniques" 
                          className="h-12 text-sm font-bold border-primary/10 bg-muted/5 focus:ring-primary"
                          required 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Module Code</Label>
                        <Input value={moduleCode} readOnly className="bg-muted/30 font-mono text-xs border-dashed" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Managing Department</Label>
                        <select 
                          className="flex h-12 w-full rounded-md border border-primary/10 bg-muted/5 px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-primary outline-none transition-all"
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
                        <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Training Date *</Label>
                        <Input type="date" value={trainingDate} onChange={(e) => setTrainingDate(e.target.value)} className="h-12 font-bold border-primary/10" required />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Lead Trainer *</Label>
                        <Input value={trainer_name} onChange={(e) => setTrainerName(e.target.value)} placeholder="Full name of the instructor" className="h-12 border-primary/10" required />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Venue / Location *</Label>
                        <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Mikocheni Production Site" className="h-12 border-primary/10" required />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Module Overview</Label>
                    <Textarea 
                      value={description} 
                      onChange={(e) => setDescription(e.target.value)} 
                      placeholder="Detail the scope and context of this training session..." 
                      className="min-h-[120px] text-sm leading-relaxed border-primary/10 bg-muted/5"
                      rows={4} 
                    />
                  </div>
                  <div className="space-y-4">
                    <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center justify-between">
                      Learning Objectives
                      <span className="text-[10px] lowercase font-normal italic opacity-60">Add key skills to be acquired</span>
                    </Label>
                    <div className="flex gap-2">
                      <Input 
                        placeholder="e.g. Master the art of dough lamination" 
                        value={newObjective} 
                        onChange={(e) => setNewObjective(e.target.value)} 
                        className="h-11 border-primary/10"
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addObjective(); } }}
                      />
                      <Button type="button" size="icon" onClick={addObjective} className="h-11 w-11 shrink-0 bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all">
                        <Plus className="h-5 w-5" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-2">
                      {learningObjectives.map((obj, i) => (
                        <Badge key={i} variant="secondary" className="gap-2 py-1.5 px-3 font-bold text-xs bg-muted border border-border">
                          <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                          {obj}
                          <X className="h-3 w-3 cursor-pointer hover:text-destructive opacity-40 hover:opacity-100" onClick={() => setLearningObjectives(learningObjectives.filter((_, idx) => idx !== i))} />
                        </Badge>
                      ))}
                      {learningObjectives.length === 0 && (
                        <p className="text-xs italic text-muted-foreground p-4 bg-muted/20 border-2 border-dashed rounded-xl w-full text-center">No objectives added yet.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 3 && (
                <div className="space-y-6">
                  <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input 
                      placeholder="Search personnel by name or department..." 
                      className="pl-12 h-14 text-base font-bold bg-muted/5 border-2 border-primary/5 focus:border-primary transition-all rounded-2xl" 
                      value={searchQuery} 
                      onChange={(e) => setSearchQuery(e.target.value)} 
                    />
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-end px-1">
                      <Label className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Available Personnel</Label>
                      <span className="text-[10px] font-black text-primary uppercase">{selectedEmployees.length} Enrolled</span>
                    </div>
                    
                    <div className="border-2 rounded-3xl bg-muted/5 divide-y overflow-hidden">
                      {loadingEmployees ? (
                          <div className="p-20 flex flex-col items-center gap-4">
                              <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
                              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground animate-pulse">Syncing Employee Ledger...</p>
                          </div>
                      ) : filteredEmployees.length > 0 ? (
                          <div className="max-h-[400px] overflow-y-auto">
                            {filteredEmployees.map(emp => (
                                <div 
                                    key={emp.id} 
                                    className={cn(
                                        "flex items-center gap-4 p-5 transition-all cursor-pointer relative",
                                        selectedEmployees.includes(emp.id) ? "bg-primary/[0.03]" : "hover:bg-muted/30"
                                    )}
                                    onClick={() => toggleEmployee(emp.id)}
                                >
                                    <div className="relative flex items-center">
                                        <input 
                                            type="checkbox" 
                                            id={`emp-${emp.id}`}
                                            className="h-6 w-6 rounded-lg border-2 border-primary/20 text-primary focus:ring-primary cursor-pointer transition-all"
                                            checked={selectedEmployees.includes(emp.id)}
                                            onChange={(e) => {
                                                e.stopPropagation();
                                                toggleEmployee(emp.id);
                                            }}
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-base font-black text-foreground leading-tight">{emp.firstName} {emp.lastName}</p>
                                        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mt-0.5">{emp.department} • {emp.role}</p>
                                    </div>
                                    {selectedEmployees.includes(emp.id) && (
                                        <Badge className="bg-primary text-[10px] font-black uppercase tracking-tighter h-6">Active Enrollment</Badge>
                                    )}
                                </div>
                            ))}
                          </div>
                      ) : (
                          <div className="p-20 text-center space-y-3">
                              <Users className="h-12 w-12 mx-auto text-muted-foreground opacity-20" />
                              <p className="text-sm font-bold text-muted-foreground italic">No matching personnel found in the directory.</p>
                          </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
          </ScrollArea>

          <DialogFooter className="bg-muted/10 border-t px-8 py-6 flex flex-row items-center justify-between w-full sm:justify-between flex-shrink-0">
              <Button type="button" variant="ghost" onClick={currentStep === 1 ? () => setIsOpen(false) : prevStep} className="font-black text-xs uppercase tracking-widest h-12 px-8">
                {currentStep === 1 ? 'Cancel' : 'Back'}
              </Button>
              <div className="flex items-center gap-4">
                  {currentStep < 3 ? (
                    <Button type="button" onClick={nextStep} className="font-black text-xs uppercase tracking-widest h-12 px-10 gap-2">
                      Continue <ChevronRight className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button type="submit" disabled={isSubmitting || selectedEmployees.length === 0} className="font-black text-xs uppercase tracking-widest h-12 px-12 shadow-xl shadow-primary/20 bg-primary hover:bg-black transition-all">
                      {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <GraduationCap className="h-4 w-4" />}
                      Launch Training Session
                    </Button>
                  )}
              </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
