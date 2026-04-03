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
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Loader2, X, Plus, ChevronRight, ChevronLeft, 
  Target, GraduationCap, BookOpen, Clock, MapPin, 
  ShieldCheck, Briefcase, Zap, Sparkles, Save
} from "lucide-react";
import { DEFAULT_TRAINING_SKILLS } from "@/types";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: 1, title: "Configuration", description: "Basic Session Info", icon: Zap },
  { id: 2, title: "Curriculum", description: "Module Core Content", icon: BookOpen },
];

export function EditTrainingDialog({ isOpen, setIsOpen, session, onEditTraining }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [moduleCode, setModuleCode] = useState('');
  const [department, setDepartment] = useState('');
  const [location, setLocation] = useState('');
  const [type, setType] = useState('');
  const [trainingDate, setTrainingDate] = useState('');
  const [trainer_name, setTrainerName] = useState('');
  const [durationDays, setDurationDays] = useState(1);
  const [description, setDescription] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [learningObjectives, setLearningObjectives] = useState<string[]>([]);
  const [newObjective, setNewObjective] = useState('');
  const [expectedOutcomes, setExpectedOutcomes] = useState('');
  const [assessmentMethod, setAssessmentMethod] = useState('');
  const [resourceRequirements, setResourceRequirements] = useState('');
  const [customSkills, setCustomSkills] = useState<string[]>([]);
  const [newSkillInput, setNewSkillInput] = useState('');
  const [sessionStatus, setSessionStatus] = useState('Upcoming');

  useEffect(() => {
    if (session) {
      setTitle(session.title);
      setModuleCode(session.module_code || '');
      setDepartment(session.department);
      setLocation(session.location);
      setType(session.type);
      setTrainingDate(session.training_date || new Date().toISOString().split('T')[0]);
      setTrainerName(session.trainer_name || '');
      setDurationDays(session.duration_days || 1);
      setDescription(session.description || '');
      setTargetAudience(session.target_audience || '');
      setLearningObjectives(session.learning_objectives || []);
      setExpectedOutcomes(session.expected_outcomes || '');
      setAssessmentMethod(session.assessment_method || 'Observation');
      setResourceRequirements(session.resource_requirements || '');
      setCustomSkills(session.custom_skills || [...DEFAULT_TRAINING_SKILLS]);
      setSessionStatus(session.session_status || 'Upcoming');
    }
  }, [session]);

  const nextStep = () => { if (currentStep < 2) setCurrentStep(currentStep + 1); };
  const prevStep = () => { if (currentStep > 1) setCurrentStep(currentStep - 1); };

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (currentStep < 2) {
      nextStep();
      return;
    }

    setIsSubmitting(true);
    try {
      await onEditTraining({
        ...session,
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
        session_status: sessionStatus
      });
      setIsOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[800px] max-h-[92vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl">
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden bg-background">
          <div className="bg-primary/5 border-b p-6 space-y-6">
            <DialogHeader className="p-0">
               <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-amber-500 text-white shadow-lg">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <div>
                    <DialogTitle className="text-2xl font-black tracking-tight">Modify Training Module</DialogTitle>
                    <DialogDescription className="text-xs font-bold text-muted-foreground/60 uppercase tracking-widest">
                      Updating framework parameters
                    </DialogDescription>
                  </div>
                </div>
            </DialogHeader>

            <div className="flex items-center justify-between max-w-md mx-auto relative px-4">
              <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-muted -translate-y-1/2 z-0" />
              {STEPS.map((s, i) => {
                const Icon = s.icon;
                const isActive = currentStep === s.id;
                const isCompleted = currentStep > s.id;
                return (
                  <div key={s.id} className="relative z-10 flex flex-col items-center gap-2">
                    <div 
                      className={cn(
                        "h-9 w-9 rounded-full flex items-center justify-center border-4 transition-all duration-500",
                        isActive ? "bg-amber-500 border-amber-500/20 text-white scale-110 shadow-lg" : 
                        isCompleted ? "bg-green-500 border-green-500/20 text-white" : 
                        "bg-background border-muted text-muted-foreground"
                      )}
                    >
                      {isCompleted ? <ShieldCheck className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                    </div>
                    <span className={cn("text-[9px] font-black uppercase tracking-widest", isActive ? "text-amber-600" : "text-muted-foreground")}>
                      {s.title}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex-1 px-8 py-6 overflow-y-auto">
              {currentStep === 1 && (
                <div
                  key="editStep1"
                  className="space-y-6 animate-in fade-in zoom-in-95 duration-300"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold">Topic Title *</Label>
                        <Input value={title} onChange={(e) => setTitle(e.target.value)} className="font-bold border-primary/20" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs font-bold">Module Code</Label>
                          <Input value={moduleCode} onChange={(e) => setModuleCode(e.target.value)} className="font-mono text-xs border-primary/20" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-bold">Session Status</Label>
                          <Select onValueChange={setSessionStatus} value={sessionStatus}>
                            <SelectTrigger className="font-bold border-primary/20">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Upcoming" className="font-bold">Upcoming</SelectItem>
                              <SelectItem value="In Progress" className="font-bold text-amber-600">In Progress</SelectItem>
                              <SelectItem value="Completed" className="font-bold text-green-600">Completed</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold">Managing Department</Label>
                        <Select onValueChange={setDepartment} value={department}>
                          <SelectTrigger className="font-bold border-primary/20">
                            <SelectValue />
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
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs font-bold">Date *</Label>
                          <Input type="date" value={trainingDate} onChange={(e) => setTrainingDate(e.target.value)} className="font-bold border-primary/20" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-bold">Duration (Days)</Label>
                          <Input type="number" min={1} value={durationDays} onChange={(e) => setDurationDays(Number(e.target.value))} className="font-bold border-primary/20" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold">Trainer Name</Label>
                        <Input value={trainer_name} onChange={(e) => setTrainerName(e.target.value)} className="font-bold border-primary/20" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold">Location / Venue</Label>
                        <Input value={location} onChange={(e) => setLocation(e.target.value)} className="font-bold border-primary/20" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div
                  key="editStep2"
                  className="space-y-6 animate-in fade-in zoom-in-95 duration-300"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold">Module Description</Label>
                        <Textarea 
                          value={description} 
                          onChange={(e) => setDescription(e.target.value)} 
                          className="text-sm border-primary/20 resize-none h-24" 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold">Learning Objectives</Label>
                        <div className="space-y-2 bg-muted/20 p-4 rounded-xl border border-dashed">
                          {learningObjectives.map((obj, i) => (
                            <div key={i} className="flex items-center gap-2 group transition-all">
                              <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                              <span className="text-xs font-medium flex-1">{obj}</span>
                              <button type="button" onClick={() => removeObjective(i)} className="text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
                            </div>
                          ))}
                          <div className="flex gap-2 pt-2">
                            <Input 
                              placeholder="New objective..." 
                              className="text-xs h-8 border-primary/10 bg-background"
                              value={newObjective}
                              onChange={(e) => setNewObjective(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addObjective(); } }}
                            />
                            <Button type="button" size="sm" variant="outline" className="h-8 shadow-sm" onClick={addObjective}><Plus className="h-3 w-3" /></Button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                       <div className="space-y-2">
                          <Label className="text-xs font-bold">Assessment Method</Label>
                          <Select onValueChange={setAssessmentMethod} value={assessmentMethod}>
                            <SelectTrigger className="font-bold border-primary/20">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Observation">Practical Observation</SelectItem>
                              <SelectItem value="Written">Written Questionnaire</SelectItem>
                              <SelectItem value="Practical">Execution Performance</SelectItem>
                              <SelectItem value="Oral">Oral Viva / Presentation</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                         <div className="space-y-2">
                          <Label className="text-xs font-bold">Resource Requirements</Label>
                          <Textarea 
                            value={resourceRequirements} 
                            onChange={(e) => setResourceRequirements(e.target.value)} 
                            className="text-xs border-primary/20 resize-none h-20" 
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-bold font-black tracking-tight uppercase text-muted-foreground">Competencies</Label>
                          <div className="flex flex-wrap gap-1.5 p-3 bg-muted/10 rounded-xl border">
                            {customSkills.map(skill => (
                              <Badge key={skill} variant="secondary" className="text-[9px] font-black uppercase tracking-tighter gap-1 pr-1 bg-background border">
                                {skill}
                                <button type="button" onClick={() => removeCustomSkill(skill)} className="ml-0.5 hover:text-destructive"><X className="h-2.5 w-2.5" /></button>
                              </Badge>
                            ))}
                            <div className="flex gap-1.5 w-full mt-2">
                              <Input
                                placeholder="Add skill..."
                                className="text-[10px] h-7 border-none bg-muted/40"
                                value={newSkillInput}
                                onChange={(e) => setNewSkillInput(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomSkill(); } }}
                              />
                            </div>
                          </div>
                        </div>
                    </div>
                  </div>
                </div>
              )}
          </div>

          <DialogFooter className="bg-muted/10 border-t px-8 py-4 gap-3 flex items-center">
            {currentStep > 1 && (
              <Button type="button" variant="outline" onClick={prevStep} className="font-bold border-none bg-background shadow-sm">
                <ChevronLeft className="h-4 w-4 mr-2" /> Back
              </Button>
            )}
            <div className="ml-auto flex items-center gap-3">
              <DialogClose asChild>
                <Button type="button" variant="ghost" className="font-bold text-muted-foreground">Cancel</Button>
              </DialogClose>
              {currentStep < 2 ? (
                <Button type="button" onClick={nextStep} className="font-bold bg-amber-600 hover:bg-amber-700 text-white px-8 shadow-md">
                  Continue <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button type="submit" disabled={isSubmitting} className="bg-primary font-bold px-8 shadow-lg">
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Update Module
                </Button>
              )}
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
