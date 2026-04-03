// @ts-nocheck
'use client'

import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2, UserMinus, CheckCircle, XCircle, Clock, ClipboardCheck,
  TrendingUp, Save, Star, ChevronDown, ChevronUp, Users, CalendarDays, Sparkles
} from "lucide-react";
import {
  getTrainingParticipants, updateParticipantStatus, deleteParticipant,
  getEvaluationsBySession, addTraineeEvaluation, addBulkEvaluations
} from "@/services/trainingService";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { DEFAULT_TRAINING_SKILLS, type TrainingEvaluation } from "@/types";

const SCORE_LABELS = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];
const SCORE_COLORS = ['', 'text-red-500', 'text-orange-500', 'text-yellow-600', 'text-blue-500', 'text-green-500'];
const SCORE_BG = ['', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500'];

export function ManageParticipantsDialog({ isOpen, setIsOpen, session, onUpdate }) {
  const [participants, setParticipants] = useState([]);
  const [evaluations, setEvaluations] = useState<TrainingEvaluation[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('attendees');
  const { toast } = useToast();
  const { user } = useAuth();

  // Evaluation state
  const [evaluationDate, setEvaluationDate] = useState(new Date().toISOString().split('T')[0]);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [pendingEvaluations, setPendingEvaluations] = useState<Record<string, {
    score: number;
    skills: string[];
    notes: string;
  }>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Skills for this session (customizable)
  const sessionSkills = useMemo(() => {
    return session?.custom_skills?.length > 0
      ? session.custom_skills
      : [...DEFAULT_TRAINING_SKILLS];
  }, [session]);

  useEffect(() => {
    if (isOpen && session?.id) {
      fetchData();
    }
  }, [isOpen, session]);

  const fetchData = async () => {
    setLoading(true);
    const [partData, evalData] = await Promise.all([
      getTrainingParticipants(session.id),
      getEvaluationsBySession(session.id)
    ]);
    setParticipants(partData);
    setEvaluations(evalData);
    setLoading(false);
  };

  // === ATTENDEES TAB ===
  const handleStatusChange = async (id, status) => {
    const success = await updateParticipantStatus(id, { status });
    if (success) {
      setParticipants(prev => prev.map(p => p.id === id ? { ...p, status } : p));
      toast({ title: "Status Updated", description: `Participant marked as ${status}.` });
      if (onUpdate) onUpdate();
    }
  };

  const handleGradeChange = async (id, grade) => {
    const success = await updateParticipantStatus(id, { grade });
    if (success) {
      setParticipants(prev => prev.map(p => p.id === id ? { ...p, grade } : p));
    }
  };

  const handleRemove = async (id) => {
    if (!confirm("Are you sure you want to remove this employee from the training?")) return;
    const success = await deleteParticipant(id, session.id);
    if (success) {
      setParticipants(prev => prev.filter(p => p.id !== id));
      toast({ title: "Removed", description: "Employee removed from training session." });
      if (onUpdate) onUpdate();
    }
  };

  // === EVALUATE TAB ===
  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedRows(new Set(participants.map(p => p.id)));
    // Initialize pending evals for all
    const initial: Record<string, any> = {};
    participants.forEach(p => {
      if (!pendingEvaluations[p.id]) {
        initial[p.id] = { score: 3, skills: [], notes: '' };
      }
    });
    if (Object.keys(initial).length > 0) {
      setPendingEvaluations(prev => ({ ...prev, ...initial }));
    }
  };

  const collapseAll = () => setExpandedRows(new Set());

  const initEvaluation = (participantId: string) => {
    if (!pendingEvaluations[participantId]) {
      setPendingEvaluations(prev => ({
        ...prev,
        [participantId]: { score: 3, skills: [], notes: '' }
      }));
    }
  };

  const updatePending = (id: string, field: string, value: any) => {
    setPendingEvaluations(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value }
    }));
  };

  const toggleSkill = (id: string, skill: string) => {
    setPendingEvaluations(prev => {
      const current = prev[id]?.skills || [];
      return {
        ...prev,
        [id]: {
          ...prev[id],
          skills: current.includes(skill)
            ? current.filter(s => s !== skill)
            : [...current, skill]
        }
      };
    });
  };

  const saveSingleEvaluation = async (participantId: string) => {
    const pending = pendingEvaluations[participantId];
    if (!pending) return;

    setIsSaving(true);
    const result = await addTraineeEvaluation({
      participant_id: participantId,
      training_id: session.id,
      evaluation_date: evaluationDate,
      score: pending.score,
      skills_demonstrated: pending.skills,
      notes: pending.notes,
      evaluator_name: user?.user_metadata?.name || user?.email || 'Evaluator'
    });

    if (result) {
      setEvaluations(prev => [...prev, result]);
      setPendingEvaluations(prev => {
        const next = { ...prev };
        delete next[participantId];
        return next;
      });
      setExpandedRows(prev => {
        const next = new Set(prev);
        next.delete(participantId);
        return next;
      });
      toast({ title: "Evaluation Saved", description: `Evaluation for ${evaluationDate} recorded.` });
    }
    setIsSaving(false);
  };

  const saveAllEvaluations = async () => {
    const entries = Object.entries(pendingEvaluations).filter(([id]) => expandedRows.has(id));
    if (entries.length === 0) return;

    setIsSaving(true);
    const evals = entries.map(([participantId, pending]) => ({
      participant_id: participantId,
      training_id: session.id,
      evaluation_date: evaluationDate,
      score: pending.score,
      skills_demonstrated: pending.skills,
      notes: pending.notes,
      evaluator_name: user?.user_metadata?.name || user?.email || 'Evaluator'
    }));

    const success = await addBulkEvaluations(evals);
    if (success) {
      await fetchData();
      setPendingEvaluations({});
      setExpandedRows(new Set());
      toast({ title: "All Evaluations Saved", description: `${entries.length} evaluations recorded for ${evaluationDate}.` });
    }
    setIsSaving(false);
  };

  // === PROGRESS TAB ===
  const participantEvalMap = useMemo(() => {
    const map: Record<string, TrainingEvaluation[]> = {};
    evaluations.forEach(ev => {
      if (!map[ev.participant_id]) map[ev.participant_id] = [];
      map[ev.participant_id].push(ev);
    });
    return map;
  }, [evaluations]);

  const getAvgScore = (evals: TrainingEvaluation[]) => {
    if (!evals || evals.length === 0) return 0;
    return evals.reduce((sum, e) => sum + e.score, 0) / evals.length;
  };

  // Day summary stats
  const dayEvals = useMemo(() => evaluations.filter(e => e.evaluation_date === evaluationDate), [evaluations, evaluationDate]);
  const dayAvg = dayEvals.length > 0 ? (dayEvals.reduce((s, e) => s + e.score, 0) / dayEvals.length).toFixed(1) : '—';

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b bg-muted/20">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-primary/10 text-primary">
                <Users className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <span className="block text-lg font-bold tracking-tight">{session?.title}</span>
                <span className="block text-xs text-muted-foreground font-medium">
                  {session?.department} • {session?.location}
                  {session?.training_date && ` • ${format(parseISO(session.training_date), 'MMM d, yyyy')}`}
                </span>
              </div>
              <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[10px] font-black uppercase">
                {participants.length} Trainees
              </Badge>
            </DialogTitle>
          </DialogHeader>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 pt-3 border-b bg-background">
            <TabsList className="grid w-full grid-cols-3 bg-muted/30 h-10">
              <TabsTrigger value="attendees" className="font-bold text-xs gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <ClipboardCheck className="h-3.5 w-3.5" /> Attendees
              </TabsTrigger>
              <TabsTrigger value="evaluate" className="font-bold text-xs gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Star className="h-3.5 w-3.5" /> Evaluate
              </TabsTrigger>
              <TabsTrigger value="progress" className="font-bold text-xs gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <TrendingUp className="h-3.5 w-3.5" /> Progress
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ═══ TAB 1: ATTENDEES ═══ */}
          <TabsContent value="attendees" className="flex-1 overflow-hidden px-6 py-4 m-0">
            {loading ? (
              <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : (
              <ScrollArea className="h-[400px] border rounded-md">
                <Table>
                  <TableHeader className="bg-muted/50 sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="font-bold">Staff Member</TableHead>
                      <TableHead className="font-bold w-[140px]">Status</TableHead>
                      <TableHead className="font-bold w-[100px]">Grade</TableHead>
                      <TableHead className="font-bold w-[80px] text-center">Evals</TableHead>
                      <TableHead className="text-right font-bold w-[60px]">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {participants.map((p) => {
                      const pEvals = participantEvalMap[p.id] || [];
                      const avgScore = getAvgScore(pEvals);
                      return (
                        <TableRow key={p.id}>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-bold text-sm tracking-tight">{p.employee_name}</span>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-muted-foreground font-black uppercase">
                                  {p.status}
                                </span>
                                {pEvals.length > 0 && (
                                  <div className="flex items-center gap-1">
                                    <div className={cn("h-1.5 w-1.5 rounded-full", SCORE_BG[Math.round(avgScore)] || 'bg-muted')} />
                                    <span className="text-[10px] font-bold text-muted-foreground">{avgScore.toFixed(1)}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Select value={p.status} onValueChange={(val) => handleStatusChange(p.id, val)}>
                              <SelectTrigger className="h-8 text-xs font-bold ring-0 focus:ring-0">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Enrolled">
                                  <div className="flex items-center text-blue-500 font-bold"><Clock className="h-3 w-3 mr-1" /> Enrolled</div>
                                </SelectItem>
                                <SelectItem value="In Progress">
                                  <div className="flex items-center text-amber-500 font-bold"><Sparkles className="h-3 w-3 mr-1" /> In Progress</div>
                                </SelectItem>
                                <SelectItem value="Completed">
                                  <div className="flex items-center text-green-500 font-bold"><CheckCircle className="h-3 w-3 mr-1" /> Completed</div>
                                </SelectItem>
                                <SelectItem value="Failed">
                                  <div className="flex items-center text-red-500 font-bold"><XCircle className="h-3 w-3 mr-1" /> Failed</div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input
                              className="h-8 text-center font-bold text-xs"
                              placeholder="A+, B..."
                              value={p.grade || ''}
                              onChange={(e) => handleGradeChange(p.id, e.target.value)}
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="text-[10px] font-black">
                              {pEvals.length}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemove(p.id)}
                              className="hover:bg-red-500/10 hover:text-red-500"
                            >
                              <UserMinus className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {participants.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-20 text-muted-foreground">
                          No attendees registered for this session yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </TabsContent>

          {/* ═══ TAB 2: EVALUATE ═══ */}
          <TabsContent value="evaluate" className="flex-1 overflow-hidden px-6 py-4 m-0">
            {loading ? (
              <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : (
              <div className="flex flex-col h-[420px] space-y-4">
                {/* Controls Bar */}
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    <Input
                      type="date"
                      value={evaluationDate}
                      onChange={(e) => setEvaluationDate(e.target.value)}
                      className="h-8 w-[160px] text-xs font-bold"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 bg-muted/30 px-3 py-1.5 rounded-lg">
                    <span className="text-[10px] font-black text-muted-foreground uppercase">Day Avg:</span>
                    <span className="text-sm font-black text-primary">{dayAvg}</span>
                    <span className="text-[10px] font-black text-muted-foreground">/ 5</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-muted/30 px-3 py-1.5 rounded-lg">
                    <span className="text-[10px] font-black text-muted-foreground uppercase">Evaluated:</span>
                    <span className="text-sm font-black text-primary">{dayEvals.length}</span>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <Button variant="outline" size="sm" className="h-7 text-[10px] font-bold" onClick={expandAll}>
                      <ChevronDown className="h-3 w-3 mr-1" /> Expand All
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 text-[10px] font-bold" onClick={collapseAll}>
                      <ChevronUp className="h-3 w-3 mr-1" /> Collapse
                    </Button>
                  </div>
                </div>

                {/* Participant Evaluation Rows */}
                <ScrollArea className="flex-1 border rounded-lg">
                  <div className="divide-y">
                    {participants.map((p) => {
                      const isExpanded = expandedRows.has(p.id);
                      const pending = pendingEvaluations[p.id];
                      const existingToday = dayEvals.filter(e => e.participant_id === p.id);
                      return (
                        <div key={p.id} className="group">
                          {/* Collapsed Row */}
                          <div
                            className={cn(
                              "flex items-center justify-between px-4 py-3 cursor-pointer transition-colors",
                              isExpanded ? "bg-primary/5" : "hover:bg-muted/30"
                            )}
                            onClick={() => {
                              toggleRow(p.id);
                              initEvaluation(p.id);
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-black text-white",
                                existingToday.length > 0 ? "bg-green-500" : "bg-muted-foreground/30"
                              )}>
                                {existingToday.length > 0 ? '✓' : p.employee_name?.charAt(0)}
                              </div>
                              <div className="flex flex-col">
                                <span className="font-bold text-sm tracking-tight">{p.employee_name}</span>
                                <span className="text-[10px] text-muted-foreground font-medium">
                                  {existingToday.length > 0
                                    ? `${existingToday.length} eval(s) today • Avg: ${(existingToday.reduce((s, e) => s + e.score, 0) / existingToday.length).toFixed(1)}`
                                    : 'Not yet evaluated today'
                                  }
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {existingToday.length > 0 && (
                                <Badge className={cn("text-[10px] font-black", SCORE_BG[Math.round(existingToday.reduce((s, e) => s + e.score, 0) / existingToday.length)])}>
                                  {SCORE_LABELS[Math.round(existingToday.reduce((s, e) => s + e.score, 0) / existingToday.length)]}
                                </Badge>
                              )}
                              {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                            </div>
                          </div>

                          {/* Expanded Row: Evaluation Form */}
                          {isExpanded && pending && (
                            <div className="px-4 pb-4 pt-2 bg-muted/10 border-t border-dashed space-y-4">
                              {/* Score Slider */}
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <Label className="text-xs font-bold">Score</Label>
                                  <span className={cn("text-sm font-black", SCORE_COLORS[pending.score])}>
                                    {pending.score} — {SCORE_LABELS[pending.score]}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-[10px] font-black text-muted-foreground">1</span>
                                  <Slider
                                    value={[pending.score]}
                                    min={1}
                                    max={5}
                                    step={1}
                                    onValueChange={([val]) => updatePending(p.id, 'score', val)}
                                    className="flex-1"
                                  />
                                  <span className="text-[10px] font-black text-muted-foreground">5</span>
                                </div>
                              </div>

                              {/* Skills Checkboxes */}
                              <div className="space-y-2">
                                <Label className="text-xs font-bold">Skills Demonstrated</Label>
                                <div className="flex flex-wrap gap-2">
                                  {sessionSkills.map((skill) => (
                                    <label
                                      key={skill}
                                      className={cn(
                                        "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-bold cursor-pointer transition-all",
                                        pending.skills.includes(skill)
                                          ? "bg-primary/10 border-primary/30 text-primary"
                                          : "bg-background border-border text-muted-foreground hover:border-primary/20"
                                      )}
                                    >
                                      <Checkbox
                                        className="h-3 w-3"
                                        checked={pending.skills.includes(skill)}
                                        onCheckedChange={() => toggleSkill(p.id, skill)}
                                      />
                                      {skill}
                                    </label>
                                  ))}
                                </div>
                              </div>

                              {/* Notes */}
                              <div className="space-y-2">
                                <Label className="text-xs font-bold">Daily Observation Notes</Label>
                                <Textarea
                                  placeholder="How did this trainee perform today? Strengths, areas to improve..."
                                  rows={2}
                                  className="text-xs resize-none"
                                  value={pending.notes}
                                  onChange={(e) => updatePending(p.id, 'notes', e.target.value)}
                                />
                              </div>

                              {/* Save Button */}
                              <div className="flex justify-end">
                                <Button
                                  size="sm"
                                  className="bg-green-600 hover:bg-green-700 font-bold text-xs gap-1.5"
                                  onClick={() => saveSingleEvaluation(p.id)}
                                  disabled={isSaving}
                                >
                                  {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                                  Save Evaluation
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {participants.length === 0 && (
                      <div className="text-center py-20 text-muted-foreground text-sm">
                        No trainees to evaluate. Add attendees first.
                      </div>
                    )}
                  </div>
                </ScrollArea>

                {/* Bulk Save */}
                {Object.keys(pendingEvaluations).length > 0 && expandedRows.size > 1 && (
                  <div className="flex justify-between items-center pt-2 border-t">
                    <span className="text-xs text-muted-foreground font-medium">
                      {expandedRows.size} trainees expanded
                    </span>
                    <Button
                      className="bg-primary font-bold text-xs gap-1.5"
                      onClick={saveAllEvaluations}
                      disabled={isSaving}
                    >
                      {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                      Save All ({expandedRows.size}) Evaluations
                    </Button>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* ═══ TAB 3: PROGRESS ═══ */}
          <TabsContent value="progress" className="flex-1 overflow-hidden px-6 py-4 m-0">
            {loading ? (
              <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : (
              <ScrollArea className="h-[420px]">
                <div className="space-y-4">
                  {/* Session Summary */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="flex flex-col items-center p-4 bg-muted/20 rounded-xl border">
                      <span className="text-2xl font-black text-primary">{participants.length}</span>
                      <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Total Trainees</span>
                    </div>
                    <div className="flex flex-col items-center p-4 bg-muted/20 rounded-xl border">
                      <span className="text-2xl font-black text-primary">{evaluations.length}</span>
                      <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Total Evaluations</span>
                    </div>
                    <div className="flex flex-col items-center p-4 bg-muted/20 rounded-xl border">
                      <span className="text-2xl font-black text-primary">
                        {evaluations.length > 0 ? (evaluations.reduce((s, e) => s + e.score, 0) / evaluations.length).toFixed(1) : '—'}
                      </span>
                      <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Overall Average</span>
                    </div>
                  </div>

                  {/* Per-Participant Progress */}
                  <div className="space-y-3">
                    {participants.map((p) => {
                      const pEvals = participantEvalMap[p.id] || [];
                      const avg = getAvgScore(pEvals);
                      const progressPercent = pEvals.length > 0 ? (avg / 5) * 100 : 0;

                      return (
                        <div key={p.id} className="border rounded-xl p-4 space-y-3 bg-background">
                          {/* Header */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "h-9 w-9 rounded-full flex items-center justify-center text-xs font-black text-white",
                                avg >= 4 ? "bg-green-500" : avg >= 3 ? "bg-blue-500" : avg >= 2 ? "bg-orange-500" : pEvals.length > 0 ? "bg-red-500" : "bg-muted-foreground/30"
                              )}>
                                {avg > 0 ? avg.toFixed(1) : '?'}
                              </div>
                              <div>
                                <span className="font-bold text-sm">{p.employee_name}</span>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-[9px] font-black h-4">{p.status}</Badge>
                                  <span className="text-[10px] text-muted-foreground font-medium">{pEvals.length} evaluation{pEvals.length !== 1 ? 's' : ''}</span>
                                </div>
                              </div>
                            </div>
                            {pEvals.length > 0 && (
                              <Badge className={cn("text-[10px] font-black border-0",
                                avg >= 4 ? "bg-green-500/10 text-green-600" :
                                avg >= 3 ? "bg-blue-500/10 text-blue-600" :
                                avg >= 2 ? "bg-orange-500/10 text-orange-600" :
                                "bg-red-500/10 text-red-600"
                              )}>
                                {SCORE_LABELS[Math.round(avg)]}
                              </Badge>
                            )}
                          </div>

                          {/* Progress Bar */}
                          <Progress value={progressPercent} className="h-2" />

                          {/* Evaluation Timeline */}
                          {pEvals.length > 0 && (
                            <div className="flex gap-2 flex-wrap">
                              {pEvals.map((ev, i) => (
                                <div
                                  key={ev.id}
                                  className="flex flex-col items-center bg-muted/20 rounded-lg px-2.5 py-1.5 border"
                                  title={`${ev.evaluation_date}: ${SCORE_LABELS[ev.score]} — ${ev.notes || 'No notes'}`}
                                >
                                  <span className="text-[9px] font-bold text-muted-foreground">
                                    {format(parseISO(ev.evaluation_date), 'MMM d')}
                                  </span>
                                  <div className={cn("h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-black text-white mt-0.5", SCORE_BG[ev.score])}>
                                    {ev.score}
                                  </div>
                                  {ev.skills_demonstrated?.length > 0 && (
                                    <span className="text-[8px] text-muted-foreground font-medium mt-0.5">
                                      {ev.skills_demonstrated.length} skill{ev.skills_demonstrated.length !== 1 ? 's' : ''}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {pEvals.length === 0 && (
                            <p className="text-[11px] text-muted-foreground italic">No evaluations recorded yet. Go to the Evaluate tab to start.</p>
                          )}
                        </div>
                      );
                    })}

                    {participants.length === 0 && (
                      <div className="text-center py-20 text-muted-foreground text-sm">
                        No trainees in this session yet.
                      </div>
                    )}
                  </div>
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <DialogFooter className="border-t px-6 py-3 bg-muted/10">
          <Button variant="outline" onClick={() => setIsOpen(false)} className="font-bold">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
