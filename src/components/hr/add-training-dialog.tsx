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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Search, Loader2, X, Plus, ChevronRight, ChevronLeft, 
  Target, GraduationCap, Users, BookOpen, Clock, MapPin, 
  ShieldCheck, Briefcase, Zap, Sparkles
} from "lucide-react";
import { getEmployees } from "@/services/employeeService";
import { DEFAULT_TRAINING_SKILLS } from "@/types";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: 1, title: "Genesis", description: "Basic Session Info", icon: Zap },
  { id: 2, title: "Module Core", description: "Curriculum & Goals", icon: BookOpen },
  { id: 3, title: "Deployment", description: "Enroll Participants", icon: Users },
];

export function AddTrainingDialog({ isOpen, setIsOpen, onAddTraining }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 1: Genesis
  const [title, setTitle] = useState('');
  const [moduleCode, setModuleCode] = useState(`MDL-${Math.random().toString(36).substring(2, 7).toUpperCase()}`);
  const [department, setDepartment] = useState('');
  const [location, setLocation] = useState('');
  const [type, setType] = useState('Skill Training');
  const [trainingDate, setTrainingDate] = useState(new Date().toISOString().split('T')[0]);
  const [trainer_name, setTrainerName] = useState('');
  const [durationDays, setDurationDays] = useState(1);

  // Step 2: Module Core
  const [description, setDescription] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [learningObjectives, setLearningObjectives] = useState<string[]>([]);
  const [newObjective, setNewObjective] = useState('');
  const [expectedOutcomes, setExpectedOutcomes] = useState('');
  const [assessmentMethod, setAssessmentMethod] = useState('Observation');
  const [resourceRequirements, setResourceRequirements] = useState('');
  const [customSkills, setCustomSkills] = useState([...DEFAULT_TRAINING_SKILLS]);
  const [newSkillInput, setNewSkillInput] = useState('');
  
  // Step 3: Deployment
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
    setDepartment('');
    setLocation('');
    setType('Skill Training');
    setTrainingDate(new Date().toISOString().split('T')[0]);
    setTrainerName('');
    setDescription('');
    setDurationDays(1);
    setTargetAudience('');
    setLearningObjectives([]);
    setExpectedOutcomes('');
    setAssessmentMethod('Observation');
    setResourceRequirements('');
    setCustomSkills([...DEFAULT_TRAINING_SKILLS]);
    setNewSkillInput('');
    setSelectedEmployees([]);
    setSearchQuery('');
  };

  const nextStep = () => {
    if (currentStep < 3) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const addObjective = () => {
    const obj = newObjective.trim();
    if (obj && !learningObjectives.includes(obj)) {
      setLearningObjectives([...learningObjectives, obj]);
      setNewObjective('');
    }
  };

  const removeObjective = (index: number) => {
    setLearningObjectives(learningObjectives.filter((_, i) => i !== index));
  };

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

  const toggleEmployee = (id) => {
    setSelectedEmployees(prev => 
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    );
  };

  const filteredEmployees = employees.filter(emp => 
    `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.department.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmit = async (e) => {
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
        target_audience: targetAudience,
        learning_objectives: learningObjectives,
        expected_outcomes: expectedOutcomes,
        assessment_method: assessmentMethod,
        resource_requirements: resourceRequirements,
        custom_skills: customSkills,
        session_status: 'Upcoming',
        employeeIds: selectedEmployees
      });
      resetForm();
      setIsOpen(false);
    } catch (error) {
      console.error("Error creating training:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isStep1Valid = title && department && location && trainer_name;
  const isStep2Valid = description && learningObjectives.length > 0;
  const isStep3Valid = selectedEmployees.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[900px] max-h-[92vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl">
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden bg-background">
          {/* Custom Premium Header & Stepper */}
          <div className="bg-primary/5 border-b p-6 space-y-6">
            <div className="flex items-center justify-between">
              <DialogHeader className="p-0">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                    <GraduationCap className="h-6 w-6" />
                  </div>
                  <div>
                    <DialogTitle className="text-2xl font-black tracking-tight">Create Training Module</DialogTitle>
                    <DialogDescription className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
                      Professional Development Framework
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
            </div>

            {/* Stepper Component */}
            <div className="flex items-center justify-between max-w-2xl mx-auto relative px-4">
              <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-muted -translate-y-1/2 z-0" />
              {STEPS.map((s, i) => {
                const Icon = s.icon;
                const isActive = currentStep === s.id;
                const isCompleted = currentStep > s.id;
                return (
                  <div key={s.id} className="relative z-10 flex flex-col items-center gap-2">
                    <div 
                      className={cn(
                        "h-10 w-10 rounded-full flex items-center justify-center border-4 transition-all duration-500",
                        isActive ? "bg-primary border-primary/20 text-primary-foreground scale-110 shadow-xl shadow-primary/30" : 
                        isCompleted ? "bg-green-500 border-green-500/20 text-white" : 
                        "bg-background border-muted text-muted-foreground"
                      )}
                    >
                      {isCompleted ? <ShieldCheck className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                    </div>
                    <div className="flex flex-col items-center">
                      <span className={cn("text-[10px] font-black uppercase tracking-tighter", isActive ? "text-primary" : "text-muted-foreground")}>
                        {s.title}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          
          <div className="flex-1 px-8 py-6 overflow-y-auto">
              {currentStep === 1 && (
                <div
                  key="step1"
                  className="space-y-8 animate-in fade-in zoom-in-95 duration-300"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Zap className="h-4 w-4 text-primary" />
                        <h3 className="text-sm font-black uppercase tracking-widest text-primary">Core Assignment</h3>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold">Topic / Training Title *</Label>
                        <Input 
                          value={title} 
                          onChange={(e) => setTitle(e.target.value)} 
                          placeholder="e.g. Advanced Kitchen Safety" 
                          className="font-bold border-primary/20 focus:border-primary transition-all"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs font-bold">Module Code</Label>
                          <Input value={moduleCode} readOnly className="bg-muted/50 font-mono text-xs uppercase tracking-widest" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-bold">Training Type</Label>
                          <Select onValueChange={setType} value={type}>
                            <SelectTrigger className="font-bold border-primary/20">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Skill Training" className="font-bold">Skill Training</SelectItem>
                              <SelectItem value="Orientation" className="font-bold">Orientation</SelectItem>
                              <SelectItem value="Compliance" className="font-bold">Compliance</SelectItem>
                              <SelectItem value="Refresher" className="font-bold">Refresher</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold">Managing Department *</Label>
                        <Select onValueChange={setDepartment} value={department}>
                          <SelectTrigger className="font-bold border-primary/20">
                            <SelectValue placeholder="Assign a department" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Kitchen">Kitchen Operations</SelectItem>
                            <SelectItem value="Operations">Internal Operations</SelectItem>
                            <SelectItem value="Logistics">Supply & Logistics</SelectItem>
                            <SelectItem value="Service Staff">Guest Services</SelectItem>
                            <SelectItem value="Admin">Administration</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center gap-2 mb-2">
                        <MapPin className="h-4 w-4 text-primary" />
                        <h3 className="text-sm font-black uppercase tracking-widest text-primary">Logistics & Scale</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs font-bold">Training Date *</Label>
                          <Input 
                            type="date" 
                            value={trainingDate} 
                            onChange={(e) => setTrainingDate(e.target.value)} 
                            className="font-bold border-primary/20"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-bold">Duration (Days)</Label>
                          <Input 
                            type="number" 
                            min={1} 
                            value={durationDays} 
                            onChange={(e) => setDurationDays(Number(e.target.value))} 
                            className="font-bold border-primary/20"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold">Lead Trainer / Instructor *</Label>
                        <Input 
                          value={trainer_name} 
                          onChange={(e) => setTrainerName(e.target.value)} 
                          placeholder="Professional Trainer Name" 
                          className="font-bold border-primary/20"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold">Physical Location / Room *</Label>
                        <Input 
                          value={location} 
                          onChange={(e) => setLocation(e.target.value)} 
                          placeholder="e.g. Main Hall / External Site" 
                          className="font-bold border-primary/20"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div
                  key="step2"
                  className="space-y-8 animate-in fade-in zoom-in-95 duration-300"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                    {/* Left: Objectives & Curriculum */}
                    <div className="space-y-6">
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-primary" />
                          <h3 className="text-sm font-black uppercase tracking-widest text-primary">Module Curriculum</h3>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-bold">Module Overview / Description *</Label>
                          <Textarea 
                            value={description} 
                            onChange={(e) => setDescription(e.target.value)} 
                            placeholder="Detailed mission and scope of this training module..." 
                            rows={3} 
                            className="text-sm border-primary/20 resize-none leading-relaxed"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-bold">Target Audience</Label>
                          <Input 
                            value={targetAudience} 
                            onChange={(e) => setTargetAudience(e.target.value)} 
                            placeholder="e.g. Junior Chefs, Warehouse Team" 
                            className="text-sm font-medium border-primary/20"
                          />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <Label className="text-xs font-bold flex items-center justify-between">
                          Learning Objectives *
                          <Badge variant="outline" className="text-[10px] font-black">{learningObjectives.length} Active</Badge>
                        </Label>
                        <div className="space-y-2 bg-muted/20 p-4 rounded-xl border border-dashed">
                          {learningObjectives.map((obj, i) => (
                            <div key={i} className="flex items-center gap-2 group animate-in slide-in-from-left-2 transition-all">
                              <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                              <span className="text-xs font-medium flex-1 lowercase first-letter:uppercase">{obj}</span>
                              <button 
                                type="button" 
                                onClick={() => removeObjective(i)}
                                className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                          <div className="flex gap-2 pt-2">
                            <Input 
                              placeholder="Define a key objective..." 
                              className="text-xs h-8 border-primary/10 bg-background"
                              value={newObjective}
                              onChange={(e) => setNewObjective(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addObjective(); } }}
                            />
                            <Button type="button" size="sm" variant="outline" className="h-8 w-8 p-0 hover:bg-primary hover:text-white" onClick={addObjective}>
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right: Assessment & Resources */}
                    <div className="space-y-6">
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="h-4 w-4 text-primary" />
                          <h3 className="text-sm font-black uppercase tracking-widest text-primary">Evaluation Framework</h3>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-bold">Assessment Method</Label>
                          <Select onValueChange={setAssessmentMethod} value={assessmentMethod}>
                            <SelectTrigger className="font-bold border-primary/20">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Observation" className="font-bold">Practical Observation</SelectItem>
                              <SelectItem value="Written" className="font-bold">Written Questionnaire</SelectItem>
                              <SelectItem value="Practical" className="font-bold">Execution Performance</SelectItem>
                              <SelectItem value="Oral" className="font-bold">Oral Viva / Presentation</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-bold">Resource Requirements</Label>
                          <Textarea 
                            value={resourceRequirements} 
                            onChange={(e) => setResourceRequirements(e.target.value)} 
                            placeholder="e.g. Projector, Kitchen Manual v2, Tasting Kits..." 
                            rows={2} 
                            className="text-xs border-primary/20 resize-none"
                          />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <Label className="text-xs font-bold">Competency Skills Tagged</Label>
                        <div className="flex flex-wrap gap-1.5 p-3 bg-muted/10 rounded-xl border">
                          {customSkills.map(skill => (
                            <Badge key={skill} variant="secondary" className="text-[9px] font-black uppercase tracking-tighter gap-1 pr-1 bg-background border-primary/5">
                              {skill}
                              <button type="button" onClick={() => removeCustomSkill(skill)} className="ml-0.5 hover:text-destructive">
                                <X className="h-2.5 w-2.5" />
                              </button>
                            </Badge>
                          ))}
                          <div className="flex gap-1.5 w-full mt-2">
                            <Input
                              placeholder="Tag a competency..."
                              className="text-[10px] h-7 border-none bg-muted/40"
                              value={newSkillInput}
                              onChange={(e) => setNewSkillInput(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomSkill(); } }}
                            />
                            <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={addCustomSkill}>
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 3 && (
                <div
                  key="step3"
                  className="space-y-6 animate-in fade-in zoom-in-95 duration-300"
                >
                  <div className="flex flex-col space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-primary" />
                        <h3 className="text-sm font-black uppercase tracking-widest text-primary">Trainee Enrollment</h3>
                      </div>
                      <Badge variant="outline" className={cn("text-xs font-black px-4", selectedEmployees.length > 0 ? "bg-primary text-white border-none" : "")}>
                        {selectedEmployees.length} Participants Assigned
                      </Badge>
                    </div>

                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input 
                        placeholder="Search by name, department, or role..." 
                        className="pl-10 h-10 border-primary/10 bg-muted/20" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                    
                    <div className="border rounded-2xl p-2 bg-muted/5 flex-1 shadow-inner">
                      <div className="h-[380px] overflow-y-auto pr-2">
                        {loadingEmployees ? (
                            <div className="flex flex-col justify-center items-center h-full py-32 space-y-3">
                                <Loader2 className="h-10 w-10 animate-spin text-primary opacity-40" />
                                <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Aggregating Human Capital...</span>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2">
                                {filteredEmployees.map(emp => {
                                  const isSelected = selectedEmployees.includes(emp.id);
                                  return (
                                    <div 
                                      key={emp.id} 
                                      className={cn(
                                        "flex items-center space-x-3 p-3 rounded-xl transition-all cursor-pointer border",
                                        isSelected ? "bg-primary/10 border-primary/30 shadow-sm" : "hover:bg-background border-transparent"
                                      )}
                                      onClick={() => toggleEmployee(emp.id)}
                                    >
                                        <Checkbox 
                                            id={`emp-${emp.id}`} 
                                            checked={isSelected}
                                            onCheckedChange={() => toggleEmployee(emp.id)}
                                            className="h-5 w-5"
                                        />
                                        <Label htmlFor={`emp-${emp.id}`} className="flex flex-col cursor-pointer flex-1">
                                            <span className="font-bold text-sm tracking-tight">{emp.firstName} {emp.lastName}</span>
                                            <span className="text-[10px] uppercase text-muted-foreground font-black tracking-widest">
                                              {emp.department} • <span className="text-primary/60">{emp.role}</span>
                                            </span>
                                        </Label>
                                    </div>
                                  );
                                })}
                                {filteredEmployees.length === 0 && (
                                    <div className="col-span-2 text-center py-20 text-muted-foreground font-bold italic">No records found matching your search.</div>
                                )}
                            </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
          </div>

          <DialogFooter className="bg-muted/10 border-t px-8 py-4 gap-3 flex items-center">
            {currentStep > 1 && (
              <Button type="button" variant="outline" onClick={prevStep} className="font-bold border-none bg-background shadow-sm px-6">
                <ChevronLeft className="h-4 w-4 mr-2" /> Back
              </Button>
            )}
            
            <div className="ml-auto flex items-center gap-3">
              <DialogClose asChild>
                <Button type="button" variant="ghost" onClick={resetForm} className="font-bold text-muted-foreground">Cancel</Button>
              </DialogClose>
              
              {currentStep < 3 ? (
                <Button 
                  type="button" 
                  onClick={nextStep} 
                  disabled={(currentStep === 1 && !isStep1Valid) || (currentStep === 2 && !isStep2Valid)}
                  className="font-bold bg-primary px-8 shadow-lg shadow-primary/20"
                >
                  Continuum <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button 
                  type="submit" 
                  disabled={!isStep3Valid || isSubmitting}
                  className="bg-green-600 hover:bg-green-700 font-bold px-8 shadow-lg shadow-green-500/20"
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                  Finalize & Launch Module
                </Button>
              )}
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
