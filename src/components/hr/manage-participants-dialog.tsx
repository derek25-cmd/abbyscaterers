'use client'
/**
 * @fileOverview Redesigned Participant Management & Daily Evaluation interface.
 * Replaces complex Radix sliders with stable inputs to fix recursion errors.
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2, UserMinus, CheckCircle, XCircle, Clock, ClipboardCheck,
  TrendingUp, Save, Star, ChevronDown, ChevronUp, Users, Sparkles, MapPin, Target
} from "lucide-react";
import {
  getTrainingParticipants, updateParticipantStatus, deleteParticipant,
  getEvaluationsBySession, addBulkEvaluations
} from "@/services/trainingService";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { DEFAULT_TRAINING_SKILLS } from "@/types";

export function ManageParticipantsDialog({ isOpen, setIsOpen, session, onUpdate }: any) {
  const [participants, setParticipants] = useState<any[]>([]);
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('attendees');
  const [evaluationDate, setEvaluationDate] = useState(new Date().toISOString().split('T')[0]);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [pendingEvaluations, setPendingEvaluations] = useState<Record<string, any>>({});
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (isOpen && session?.id) {
      fetchData();
    }
  }, [isOpen, session]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [partData, evalData] = await Promise.all([
        getTrainingParticipants(session.id),
        getEvaluationsBySession(session.id)
      ]);
      setParticipants(partData || []);
      setEvaluations(evalData || []);
    } finally {
      setLoading(false);
    }
  };

  const toggleRow = (id: string) => {
    const next = new Set(expandedRows);
    if (next.has(id)) {
        next.delete(id);
    } else {
      next.add(id);
      if (!pendingEvaluations[id]) {
        setPendingEvaluations(prev => ({ ...prev, [id]: { score: 3, skills: [], notes: '' } }));
      }
    }
    setExpandedRows(next);
  };

  const updatePending = (id: string, field: string, value: any) => {
    setPendingEvaluations(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const toggleSkill = (id: string, skill: string) => {
    const current = pendingEvaluations[id]?.skills || [];
    const next = current.includes(skill) ? current.filter((s: string) => s !== skill) : [...current, skill];
    updatePending(id, 'skills', next);
  };

  const handleSaveAll = async () => {
    const entries = Object.entries(pendingEvaluations).filter(([id]) => expandedRows.has(id));
    if (entries.length === 0) return;

    setIsSaving(true);
    try {
      const evals = entries.map(([participantId, pending]) => ({
        participant_id: participantId,
        training_id: session.id,
        evaluation_date: evaluationDate,
        score: pending.score,
        skills_demonstrated: pending.skills,
        notes: pending.notes,
        evaluator_name: user?.user_metadata?.name || user?.email || 'Lead Supervisor'
      }));

      await addBulkEvaluations(evals);
      await fetchData();
      setPendingEvaluations({});
      setExpandedRows(new Set());
      toast({ title: "Metrics Synchronized", description: "All participant evaluations have been saved to the database." });
      if (onUpdate) onUpdate();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteParticipant = async (id: string) => {
      if(!confirm("Remove this staff member from the session enrollment?")) return;
      await deleteParticipant(id, session.id);
      await fetchData();
      if (onUpdate) onUpdate();
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[900px] max-h-[92vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
        <div className="bg-primary p-8 text-white relative overflow-hidden flex-shrink-0">
          <div className="absolute top-0 right-0 p-8 opacity-10"><Target className="h-32 w-32" /></div>
          <DialogHeader className="relative z-10">
            <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30">
                    <Users className="h-8 w-8" />
                </div>
                <div>
                    <DialogTitle className="text-2xl font-black tracking-tight">{session?.title}</DialogTitle>
                    <DialogDescription className="text-white/70 font-bold uppercase tracking-widest text-[10px] flex items-center gap-2 mt-1">
                        <MapPin className="h-3 w-3" /> {session?.location} • {session?.duration_days} Day(s) Session
                    </DialogDescription>
                </div>
            </div>
          </DialogHeader>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden bg-background">
          <div className="px-8 pt-4 border-b bg-muted/10">
            <TabsList className="grid w-full max-w-md grid-cols-2 h-12 bg-muted/50 p-1 rounded-2xl">
              <TabsTrigger value="attendees" className="rounded-xl font-black text-[10px] uppercase tracking-widest gap-2">
                <Users className="h-3 w-3" /> Personnel
              </TabsTrigger>
              <TabsTrigger value="evaluate" className="rounded-xl font-black text-[10px] uppercase tracking-widest gap-2">
                <Star className="h-3 w-3" /> Day Evaluation
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="attendees" className="flex-1 overflow-hidden px-8 py-6 m-0">
            <ScrollArea className="h-full border-2 rounded-3xl bg-muted/5">
              {loading ? (
                  <div className="p-20 flex flex-col items-center gap-4">
                      <Loader2 className="h-8 w-8 animate-spin text-primary opacity-20" />
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Reading Enrollment Ledger...</p>
                  </div>
              ) : participants.length > 0 ? (
                <Table>
                    <TableHeader className="bg-muted/50 sticky top-0 z-10">
                    <TableRow className="border-b-2">
                        <TableHead className="font-black uppercase text-[10px] tracking-widest h-12 px-6">Staff Member</TableHead>
                        <TableHead className="font-black uppercase text-[10px] tracking-widest h-12">Enrollment Status</TableHead>
                        <TableHead className="text-right font-black uppercase text-[10px] tracking-widest h-12 px-6">Management</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {participants.map((p) => (
                        <TableRow key={p.id} className="hover:bg-muted/20 border-b-slate-100 last:border-0 h-16">
                        <TableCell className="px-6">
                            <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black text-xs">
                                    {p.employee_name?.charAt(0)}
                                </div>
                                <span className="font-bold text-sm">{p.employee_name}</span>
                            </div>
                        </TableCell>
                        <TableCell>
                            <Badge variant="outline" className="bg-background text-[9px] font-black uppercase tracking-tighter py-0.5">{p.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right px-6">
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-red-500 hover:bg-red-50 rounded-xl" 
                                onClick={() => handleDeleteParticipant(p.id)}
                            >
                            <UserMinus className="h-4 w-4" />
                            </Button>
                        </TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
              ) : (
                  <div className="p-20 text-center space-y-3">
                      <Users className="h-12 w-12 mx-auto text-muted-foreground opacity-10" />
                      <p className="text-sm font-bold text-muted-foreground italic">No participants enrolled in this session.</p>
                  </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="evaluate" className="flex-1 overflow-hidden px-8 py-6 m-0 flex flex-col gap-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-muted/20 p-4 rounded-2xl border">
              <div className="flex items-center gap-4 w-full md:w-auto">
                <div className="flex flex-col gap-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Evaluation Date</Label>
                    <input 
                        type="date" 
                        value={evaluationDate} 
                        onChange={e => setEvaluationDate(e.target.value)} 
                        className="h-10 px-4 font-bold border-2 rounded-xl text-sm focus:ring-primary focus:border-primary transition-all outline-none" 
                    />
                </div>
              </div>
              <Button 
                size="lg" 
                className="font-black text-xs uppercase tracking-widest gap-2 bg-green-600 hover:bg-green-700 shadow-lg shadow-green-600/20 px-10 h-12 rounded-xl w-full md:w-auto" 
                onClick={handleSaveAll} 
                disabled={isSaving || expandedRows.size === 0}
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                SYNC {expandedRows.size} EVALUATIONS
              </Button>
            </div>

            <ScrollArea className="flex-1 border-2 rounded-3xl bg-muted/5">
              <div className="divide-y-2 divide-slate-100">
                {participants.length > 0 ? participants.map((p) => {
                  const isExpanded = expandedRows.has(p.id);
                  const pending = pendingEvaluations[p.id];
                  return (
                    <div key={p.id} className={cn("bg-background transition-all", isExpanded && "bg-muted/10")}>
                      <div 
                        className={cn(
                            "flex items-center justify-between p-5 cursor-pointer hover:bg-muted/30 transition-all",
                            isExpanded && "border-l-4 border-primary"
                        )} 
                        onClick={() => toggleRow(p.id)}
                      >
                        <div className="flex items-center gap-4">
                          <div className={cn(
                              "h-10 w-10 rounded-2xl flex items-center justify-center font-black text-sm transition-all",
                              isExpanded ? "bg-primary text-white" : "bg-primary/10 text-primary"
                          )}>
                              {p.employee_name?.charAt(0)}
                          </div>
                          <div>
                            <span className="font-black text-base text-foreground tracking-tight">{p.employee_name}</span>
                            <div className="flex items-center gap-2 mt-0.5">
                                <Badge variant="outline" className="text-[8px] font-bold uppercase tracking-tighter h-4">Enrolled</Badge>
                                {isExpanded && <span className="text-[10px] font-black text-primary uppercase animate-pulse">Session Active</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {pending && isExpanded && (
                                <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] font-black">Score: {pending.score}/5</Badge>
                            )}
                            {isExpanded ? <ChevronUp className="h-5 w-5 text-primary" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                        </div>
                      </div>
                      
                      {isExpanded && pending && (
                        <div className="p-8 bg-background border-t border-dashed space-y-8 animate-in slide-in-from-top-2 duration-300">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <div className="flex justify-between items-end mb-2">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Skill Execution Score (1-5)</Label>
                                    <span className="text-2xl font-black text-primary tabular-nums">{pending.score}</span>
                                </div>
                                <div className="px-1">
                                    <input 
                                        type="range" 
                                        min="1" 
                                        max="5" 
                                        step="1" 
                                        className="w-full h-2 bg-muted rounded-full appearance-none cursor-pointer accent-primary border-2 border-muted"
                                        value={pending.score}
                                        onChange={e => updatePending(p.id, 'score', parseInt(e.target.value))}
                                    />
                                </div>
                                <div className="flex justify-between px-1 text-[8px] font-black text-muted-foreground/40 uppercase tracking-widest">
                                    <span>Novice</span>
                                    <span>Expert</span>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-2">Observed Competencies</Label>
                                <div className="flex flex-wrap gap-2">
                                    {DEFAULT_TRAINING_SKILLS.map(s => (
                                        <label 
                                            key={s} 
                                            className={cn(
                                                "text-[9px] font-black uppercase tracking-tighter px-3 py-1.5 border-2 rounded-xl cursor-pointer flex items-center gap-2 transition-all select-none", 
                                                pending.skills.includes(s) 
                                                    ? "bg-primary border-primary text-white shadow-md scale-105" 
                                                    : "bg-muted/20 border-transparent text-muted-foreground hover:border-primary/20"
                                            )}
                                        >
                                            <input type="checkbox" className="hidden" checked={pending.skills.includes(s)} onChange={() => toggleSkill(p.id, s)} />
                                            {pending.skills.includes(s) ? <CheckCircle className="h-3 w-3" /> : <div className="h-3 w-3 rounded-full border border-current opacity-30" />}
                                            {s}
                                        </label>
                                    ))}
                                </div>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Session Feedback & Notes</Label>
                            <Textarea 
                                placeholder="Record specific performance highlights or areas requiring additional remedial attention..." 
                                rows={3} 
                                value={pending.notes} 
                                onChange={e => updatePending(p.id, 'notes', e.target.value)} 
                                className="text-sm font-medium leading-relaxed border-2 bg-muted/5 focus:ring-primary/20 resize-none p-4 rounded-2xl" 
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }) : (
                    <div className="p-20 text-center space-y-3">
                        <Star className="h-12 w-12 mx-auto text-muted-foreground opacity-10" />
                        <p className="text-sm font-bold text-muted-foreground italic">No participants found to evaluate.</p>
                    </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <DialogFooter className="px-8 py-6 border-t bg-muted/10 flex items-center justify-between flex-shrink-0">
          <p className="text-[10px] font-bold text-muted-foreground italic max-w-xs leading-tight">
            * All expanded rows will have their evaluations saved when you click SYNC.
          </p>
          <DialogClose asChild><Button variant="outline" className="font-black text-xs uppercase tracking-widest h-12 px-10 rounded-xl">Dismiss Control Center</Button></DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
