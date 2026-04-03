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
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, parseISO } from "date-fns";
import { 
  GraduationCap, Calendar, MapPin, Users, Target, 
  BookOpen, ClipboardList, Briefcase, Sparkles, Clock
} from "lucide-react";
import { cn } from "@/lib/utils";

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
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl">
        <div className="bg-primary/5 border-b p-6">
          <DialogHeader>
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground shadow-lg">
                <GraduationCap className="h-7 w-7" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-3">
                  <DialogTitle className="text-2xl font-black tracking-tight">{session.title}</DialogTitle>
                  <Badge variant="outline" className={cn("text-[10px] font-black uppercase tracking-widest px-3", STATUS_COLORS[status])}>
                    {status}
                  </Badge>
                </div>
                <DialogDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2">
                  <Briefcase className="h-3 w-3" /> {session.module_code || 'UNCODED-MODULE'} • {session.type}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <ScrollArea className="flex-1 px-8 py-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Left Column: Logistics & Meta */}
            <div className="space-y-8">
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5" /> Logistics Summary
                </h3>
                <div className="grid grid-cols-1 gap-3">
                  <div className="p-3 rounded-xl bg-muted/20 border flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-primary" />
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Date</span>
                      <span className="text-sm font-bold">{session.training_date ? format(parseISO(session.training_date), 'PPP') : 'Not Set'}</span>
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-muted/20 border flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-primary" />
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Venue</span>
                      <span className="text-sm font-bold">{session.location}</span>
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-muted/20 border flex items-center gap-3">
                    <Users className="h-4 w-4 text-primary" />
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Lead Trainer</span>
                      <span className="text-sm font-bold">{session.trainer_name || 'Internal Lead'}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                  <Target className="h-3.5 w-3.5" /> Target Audience
                </h3>
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 overflow-hidden relative">
                  <div className="absolute top-0 right-0 p-2 opacity-10">
                    <Users className="h-8 w-8" />
                  </div>
                  <p className="text-sm font-bold text-primary">{session.target_audience || 'All Relevant Departments'}</p>
                  <p className="text-[10px] font-medium text-muted-foreground mt-1 uppercase tracking-widest">{session.department} Personnel</p>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5" /> Tagged Competencies
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {(session.custom_skills || []).map((skill: string) => (
                    <Badge key={skill} variant="secondary" className="text-[10px] font-black uppercase tracking-tighter bg-background border">
                      {skill}
                    </Badge>
                  ))}
                  {(!session.custom_skills || session.custom_skills.length === 0) && (
                    <span className="text-xs italic text-muted-foreground">No custom competencies tagged.</span>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Module Content */}
            <div className="space-y-8">
              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                  <BookOpen className="h-3.5 w-3.5" /> Module Scope
                </h3>
                <div className="space-y-3">
                  <p className="text-sm font-medium leading-relaxed text-muted-foreground italic">
                    &ldquo;{session.description || 'No module description provided.'}&rdquo;
                  </p>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Core Objectives</Label>
                    <div className="space-y-2">
                      {(session.learning_objectives || []).map((obj: string, i: number) => (
                        <div key={i} className="flex gap-3 items-start group">
                          <div className="h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-black shrink-0">
                            {i + 1}
                          </div>
                          <span className="text-xs font-bold leading-tight pt-1 text-foreground/80">{obj}</span>
                        </div>
                      ))}
                      {(!session.learning_objectives || session.learning_objectives.length === 0) && (
                        <span className="text-xs italic text-muted-foreground">No specific learning objectives defined.</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                  <ClipboardList className="h-3.5 w-3.5" /> Framework Details
                </h3>
                <div className="space-y-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Assessment Method</span>
                    <Badge variant="outline" className="w-fit bg-background text-xs font-bold border-primary/20">
                      {session.assessment_method || 'Observation'}
                    </Badge>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Required Resources</span>
                    <p className="text-xs font-medium text-foreground/70 bg-muted/30 p-2 rounded-lg border border-dashed">
                      {session.resource_requirements || 'Standard training facilities.'}
                    </p>
                  </div>
                  {session.expected_outcomes && (
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Expected Post-Training Outcomes</span>
                      <p className="text-xs font-medium text-foreground/70 bg-primary/5 p-2 rounded-lg border border-primary/10">
                        {session.expected_outcomes}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="border-t p-6 bg-muted/10">
          <DialogClose asChild>
            <Button type="button" variant="outline" className="font-bold px-8 shadow-sm">
              Dismiss
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
