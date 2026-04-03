'use client';

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, PlusCircle, Search, Loader2, Calendar, User, MoreHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { getTrainingSessions, addTrainingSession, deleteTrainingSession } from "@/services/trainingService";
import { CreateTrainingDialog } from "@/components/hr/create-training-dialog";
import type { TrainingSession } from "@/types";
import type { TrainingSessionFormData } from "@/lib/schemas";
import { format, parseISO } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function TrainingPage() {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchData = async () => {
    setLoading(true);
    const data = await getTrainingSessions();
    setSessions(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredSessions = useMemo(() => {
    return sessions.filter(s => 
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.trainer.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [sessions, searchQuery]);

  const handleCreateSession = async (data: TrainingSessionFormData) => {
    const result = await addTrainingSession(data);
    if (result) {
      toast({ title: "Success", description: "Training session scheduled." });
      await fetchData();
      setIsCreateDialogOpen(false);
    } else {
      toast({ variant: "destructive", title: "Error", description: "Failed to create session." });
    }
  };

  const handleDelete = async (id: string) => {
    const success = await deleteTrainingSession(id);
    if (success) {
      toast({ title: "Deleted", description: "Session removed." });
      await fetchData();
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <GraduationCap className="h-8 w-8 text-primary" />
            Training & Development
          </h1>
          <p className="text-muted-foreground">Manage internal training programs and compliance modules.</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Schedule Session
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-primary/5">
          <CardHeader className="py-4">
            <CardTitle className="text-sm font-medium uppercase text-muted-foreground tracking-widest">Active Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{sessions.filter(s => s.status === 'Scheduled').length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-sm font-medium uppercase text-muted-foreground tracking-widest">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{sessions.filter(s => s.status === 'Completed').length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-sm font-medium uppercase text-muted-foreground tracking-widest">Training Reach</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
                {Array.from(new Set(sessions.flatMap(s => s.participants.map(p => p.employeeId)))).length} Staff
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Session Logs</CardTitle>
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filter by title or trainer..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Session Title</TableHead>
                  <TableHead>Lead Trainer</TableHead>
                  <TableHead className="text-center">Participants</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {format(parseISO(session.date), 'MMM dd, yyyy')}
                        </div>
                    </TableCell>
                    <TableCell>{session.title}</TableCell>
                    <TableCell>
                        <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            {session.trainer}
                        </div>
                    </TableCell>
                    <TableCell className="text-center">
                        <Badge variant="secondary">{session.participants.length}</Badge>
                    </TableCell>
                    <TableCell>
                        <Badge variant={session.status === 'Completed' ? 'default' : session.status === 'Cancelled' ? 'destructive' : 'outline'}>
                            {session.status}
                        </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => handleDelete(session.id)} className="text-destructive">Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredSessions.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No sessions found.</TableCell>
                    </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CreateTrainingDialog 
        isOpen={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSubmit={handleCreateSession}
      />
    </div>
  );
}
