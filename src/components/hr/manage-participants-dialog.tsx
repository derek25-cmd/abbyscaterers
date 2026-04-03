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
  TrendingUp, Save, Star, ChevronDown, ChevronUp, Users, Sparkles
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

export function ManageParticipantsDialog({ isOpen, setIsOpen, session, onUpdate }) {
  const [participants, setParticipants] = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('attendees');
  const [evaluationDate, setEvaluationDate] = useState(new Date().toISOString().split('T')[0]);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [pendingEvaluations, setPendingEvaluations] = useState({});
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
      setParticipants(partData);
      setEvaluations(evalData);
    } finally {
      setLoading(false);
    }
  };

  const toggleRow = (id) => {
    const next = new Set(expandedRows);
    if (next.has(id)) next.delete(id);
    else {
      next.add(id);
      if (!pendingEvaluations[id]) {
        setPendingEvaluations(prev => ({ ...prev, [id]: { score: 3, skills: [], notes: '' } }));
      }
    }
    setExpandedRows(next);
  };

  const updatePending = (id, field, value) => {
    setPendingEvaluations(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const toggleSkill = (id, skill) => {
    const current = pendingEvaluations[id]?.skills || [];
    const next = current.includes(skill) ? current.filter(s => s !== skill) : [...current, skill];
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
        evaluator_name: user?.user_metadata?.name || user?.email || 'Evaluator'
      }));

      await addBulkEvaluations(evals);
      await fetchData();
      setPendingEvaluations({});
      setExpandedRows(new Set());
      toast({ title: "Saved", description: "Evaluations recorded." });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[850px] max-h-[90vh] flex flex-col p-0">
        <div className="px-6 pt-6 pb-4 border-b bg-muted/20">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <Users className="h-5 w-5 text-primary" />
              <span className="text-lg font-bold">{session?.title}</span>
            </DialogTitle>
          </DialogHeader>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 pt-2 border-b bg-background">
            <TabsList className="grid w-full grid-cols-2 h-10">
              <TabsTrigger value="attendees" className="font-bold text-xs gap-1.5">Attendees</TabsTrigger>
              <TabsTrigger value="evaluate" className="font-bold text-xs gap-1.5">Daily Evaluation</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="attendees" className="flex-1 overflow-hidden px-6 py-4 m-0">
            <ScrollArea className="h-[450px] border rounded-lg">
              <Table>
                <TableHeader className="bg-muted/50 sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="font-bold">Staff Member</TableHead>
                    <TableHead className="font-bold">Status</TableHead>
                    <TableHead className="text-right font-bold">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {participants.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-bold text-sm">{p.employee_name}</TableCell>
                      <TableCell><Badge variant="outline">{p.status}</Badge></TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="text-red-500" onClick={() => deleteParticipant(p.id, session.id).then(fetchData)}>
                          <UserMinus className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="evaluate" className="flex-1 overflow-hidden px-6 py-4 m-0 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Evaluation Date</Label>
                <input type="date" value={evaluationDate} onChange={e => setEvaluationDate(e.target.value)} className="text-xs font-bold border rounded p-1" />
              </div>
              <Button size="sm" className="font-bold gap-2" onClick={handleSaveAll} disabled={isSaving || expandedRows.size === 0}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save All ({expandedRows.size})
              </Button>
            </div>

            <ScrollArea className="h-[400px] border rounded-lg">
              <div className="divide-y">
                {participants.map((p) => {
                  const isExpanded = expandedRows.has(p.id);
                  const pending = pendingEvaluations[p.id];
                  return (
                    <div key={p.id} className="bg-background">
                      <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30" onClick={() => toggleRow(p.id)}>
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black text-xs">{p.employee_name?.charAt(0)}</div>
                          <span className="font-bold text-sm">{p.employee_name}</span>
                        </div>
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                      {isExpanded && pending && (
                        <div className="p-4 bg-muted/10 border-t border-dashed space-y-4">
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs font-bold">
                              <Label>Daily Score (1-5)</Label>
                              <span className="text-primary">{pending.score}</span>
                            </div>
                            <input 
                              type="range" min="1" max="5" step="1" 
                              className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                              value={pending.score}
                              onChange={e => updatePending(p.id, 'score', parseInt(e.target.value))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-bold">Skills Observed</Label>
                            <div className="flex flex-wrap gap-2">
                              {DEFAULT_TRAINING_SKILLS.map(s => (
                                <label key={s} className={cn("text-[10px] font-bold px-2 py-1 border rounded-full cursor-pointer flex items-center gap-1", pending.skills.includes(s) ? "bg-primary text-white border-primary" : "bg-background")}>
                                  <input type="checkbox" className="hidden" checked={pending.skills.includes(s)} onChange={() => toggleSkill(p.id, s)} />
                                  {s}
                                </label>
                              ))}
                            </div>
                          </div>
                          <Textarea placeholder="Daily performance notes..." rows={2} value={pending.notes} onChange={e => updatePending(p.id, 'notes', e.target.value)} className="text-xs" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <DialogFooter className="px-6 py-3 border-t bg-muted/10">
          <DialogClose asChild><Button variant="outline" className="font-bold">Dismiss</Button></DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
