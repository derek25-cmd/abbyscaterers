// @ts-nocheck
'use client'

import React, { useState, useEffect } from 'react';
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
import { Loader2, UserMinus, CheckCircle, XCircle, Clock } from "lucide-react";
import { getTrainingParticipants, updateParticipantStatus, deleteParticipant } from "@/services/trainingService";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

export function ManageParticipantsDialog({ isOpen, setIsOpen, session, onUpdate }) {
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && session?.id) {
      fetchParticipants();
    }
  }, [isOpen, session]);

  const fetchParticipants = async () => {
    setLoading(true);
    const data = await getTrainingParticipants(session.id);
    setParticipants(data);
    setLoading(false);
  };

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

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Manage Attendees</span>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                {session?.title}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Track enrollment progress and success rates for this session.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden py-4">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <ScrollArea className="h-[400px] border rounded-md">
              <Table>
                <TableHeader className="bg-muted/50 sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="font-bold">Staff Member</TableHead>
                    <TableHead className="font-bold w-[130px]">Status</TableHead>
                    <TableHead className="font-bold w-[100px]">Grade</TableHead>
                    <TableHead className="text-right font-bold w-[80px]">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {participants.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-bold text-sm tracking-tight">{p.employee_name}</span>
                          <span className="text-[10px] text-muted-foreground font-black uppercase">Result: {p.status}</span>
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
                  ))}
                  {participants.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-20 text-muted-foreground">
                        No attendees registered for this session yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => setIsOpen(false)}>Close Manager</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
