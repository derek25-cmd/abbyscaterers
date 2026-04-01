'use client';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, Users, MoreHorizontal, Loader2, Star, TrendingUp, CalendarDays, Sparkles, CheckCircle, Clock } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { useState, useEffect, useMemo } from "react";
import { format, parseISO, isBefore, isToday, isAfter } from "date-fns";
import { AddTrainingDialog } from "@/components/hr/add-training-dialog";
import { EditTrainingDialog } from "@/components/hr/edit-training-dialog";
import { ViewTrainingDialog } from "@/components/hr/view-training-dialog";
import { getTrainingSessions, addTrainingSession, updateTrainingSession, addTrainingParticipants, getEvaluationsBySession, updateSessionStatus } from "@/services/trainingService";
import { getEmployees } from "@/services/employeeService";
import { ManageParticipantsDialog } from "@/components/hr/manage-participants-dialog";
import { cn } from "@/lib/utils";
import { TrainingSession } from "@/types";

type TrainingStatus = 'Upcoming' | 'In Progress' | 'Completed';

const STATUS_CONFIG: Record<TrainingStatus, { color: string; icon: any; label: string }> = {
  'Upcoming': { color: 'bg-blue-500/10 text-blue-600 border-blue-500/20', icon: Clock, label: 'Upcoming' },
  'In Progress': { color: 'bg-amber-500/10 text-amber-600 border-amber-500/20', icon: Sparkles, label: 'In Progress' },
  'Completed': { color: 'bg-green-500/10 text-green-600 border-green-500/20', icon: CheckCircle, label: 'Completed' },
};

export default function TrainingPage() {
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [sessionEvalCounts, setSessionEvalCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isManageParticipantsOpen, setIsManageParticipantsOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<TrainingSession | null>(null);
  const [startEvalTab, setStartEvalTab] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [sessionsData, employeesData] = await Promise.all([
        getTrainingSessions(),
        getEmployees()
      ]);
      setSessions(sessionsData);
      setEmployees(employeesData);

      // Fetch eval counts per session
      const counts: Record<string, number> = {};
      await Promise.all(
        sessionsData.map(async (s: any) => {
          const evals = await getEvaluationsBySession(s.id);
          counts[s.id] = evals.length;
        })
      );
      setSessionEvalCounts(counts);
      setLoading(false);
    };
    fetchData();
  }, []);

  const handleRefreshSessions = async () => {
    const data = await getTrainingSessions();
    setSessions(data);
    // Refresh eval counts
    const counts: Record<string, number> = {};
    await Promise.all(
      data.map(async (s: any) => {
        const evals = await getEvaluationsBySession(s.id);
        counts[s.id] = evals.length;
      })
    );
    setSessionEvalCounts(counts);
  };

  const handleAddTraining = async (newSession: any) => {
    const { employeeIds, ...sessionData } = newSession;
    const result = await addTrainingSession(sessionData);
    
    if (result) {
        if (employeeIds && employeeIds.length > 0) {
            await addTrainingParticipants(result.id, employeeIds);
            const updatedSessions = await getTrainingSessions();
            setSessions(updatedSessions);
        } else {
            setSessions(prev => [result, ...prev]);
        }
    }
  };

  const handleEditTraining = async (updatedSession: any) => {
    await updateTrainingSession(updatedSession.id, updatedSession);
    setSessions(prev => 
      prev.map(p => p.id === updatedSession.id ? updatedSession : p)
    );
  };

  const openEditDialog = (session: any) => {
    setSelectedSession(session);
    setIsEditDialogOpen(true);
  };

  const openViewDialog = (session: any) => {
    setSelectedSession(session);
    setIsViewDialogOpen(true);
  };

  const openManageParticipants = (session: any, evalTab = false) => {
    setSelectedSession(session);
    setStartEvalTab(evalTab);
    setIsManageParticipantsOpen(true);
  };

  const getSessionStatus = (session: TrainingSession): TrainingStatus => {
    if (session.session_status) return session.session_status;
    // Auto-detect from date
    if (!session.training_date) return 'Upcoming';
    const date = parseISO(session.training_date);
    if (isToday(date)) return 'In Progress';
    if (isBefore(date, new Date())) return 'Completed';
    return 'Upcoming';
  };

  const getEvalProgress = (session: any) => {
    const evalCount = sessionEvalCounts[session.id] || 0;
    const expectedTotal = (session.applicants || 1) * (session.duration_days || 1);
    if (expectedTotal === 0) return 0;
    return Math.min(100, Math.round((evalCount / expectedTotal) * 100));
  };

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 animate-fade-in relative">
      <div className="flex items-center">
        <h1 className="font-headline text-3xl font-black tracking-tight">Staff Training Module</h1>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" className="h-10 gap-1 bg-primary px-4 shadow-md" onClick={() => setIsAddDialogOpen(true)}>
            <PlusCircle className="h-4 w-4" />
            <span className="sr-only sm:not-sr-only sm:whitespace-nowrap font-bold">
              New Training Session
            </span>
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 font-medium">Loading training modules...</span>
        </div>
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {sessions.map((session) => {
              const status = getSessionStatus(session);
              const statusCfg = STATUS_CONFIG[status];
              const StatusIcon = statusCfg.icon;
              const evalProgress = getEvalProgress(session);
              const evalCount = sessionEvalCounts[session.id] || 0;

              return (
                <Card key={session.id} className="hover:shadow-2xl transition-all duration-500 border-primary/10 overflow-hidden group flex flex-col">
                  <CardHeader className="grid grid-cols-[1fr_auto] items-start gap-4 space-y-0 bg-muted/20 pb-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={cn("text-[10px] font-black uppercase tracking-widest", statusCfg.color)}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusCfg.label}
                        </Badge>
                        <Badge variant="outline" className="bg-background text-[10px] font-black uppercase tracking-widest border-primary/20">{session.type}</Badge>
                        {session.training_date && (
                          <span className="text-[10px] font-black text-primary uppercase tracking-tight italic opacity-80">
                            {format(parseISO(session.training_date), 'MMM d, yyyy')}
                          </span>
                        )}
                      </div>
                      <CardTitle className="font-headline text-xl font-bold leading-tight group-hover:text-primary transition-colors">{session.title}</CardTitle>
                      <CardDescription className="text-xs font-medium text-muted-foreground">
                        {session.department} • {session.location}
                        {session.duration_days && session.duration_days > 1 && ` • ${session.duration_days} days`}
                      </CardDescription>
                    </div>
                    <div className="flex items-center rounded-md text-secondary-foreground">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button aria-haspopup="true" size="icon" variant="ghost" className="hover:bg-primary/10 hover:text-primary">
                            <MoreHorizontal className="h-5 w-5" />
                            <span className="sr-only">Toggle menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[180px]">
                          <DropdownMenuLabel className="text-[10px] uppercase font-black text-muted-foreground opacity-50">Operations</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => openViewDialog(session)} className="cursor-pointer font-semibold">View Details</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEditDialog(session)} className="cursor-pointer font-semibold">Edit Session</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => openManageParticipants(session)} className="cursor-pointer font-bold text-primary">Manage Attendees</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openManageParticipants(session, true)} className="cursor-pointer font-bold text-green-600">
                            <Star className="h-3 w-3 mr-1.5" /> Start Evaluation
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-5 pb-4 flex-1 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-3 rounded-2xl bg-primary/10 text-primary">
                          <Users className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-2xl font-black tracking-tighter leading-none">{session.applicants}</span>
                          <span className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Enrolled Staff</span>
                        </div>
                      </div>
                      {session.trainer_name && (
                        <div className="flex flex-col items-end text-right">
                          <span className="text-[10px] uppercase font-black text-muted-foreground tracking-widest mb-1">Trainer</span>
                          <span className="text-xs font-bold text-primary">{session.trainer_name}</span>
                        </div>
                      )}
                    </div>

                    {/* Evaluation Progress Bar */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Evaluation Progress</span>
                        <span className="text-[10px] font-black text-primary tabular-nums">{evalCount} eval{evalCount !== 1 ? 's' : ''} • {evalProgress}%</span>
                      </div>
                      <Progress value={evalProgress} className="h-1.5" />
                    </div>
                  </CardContent>
                  <CardFooter className="bg-muted/10 border-t pt-4 gap-2">
                    <Button
                      variant="outline"
                      className="flex-1 font-bold text-xs"
                      onClick={() => openManageParticipants(session)}
                    >
                      <Users className="h-3.5 w-3.5 mr-1.5" /> Attendees
                    </Button>
                    <Button
                      className="flex-1 font-bold text-xs bg-green-600 hover:bg-green-700 shadow-md"
                      onClick={() => openManageParticipants(session, true)}
                    >
                      <Star className="h-3.5 w-3.5 mr-1.5" /> Evaluate
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>

          {sessions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 bg-muted/10 rounded-xl border-2 border-dashed border-muted-foreground/20">
              <Users className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-bold">No Training Sessions</h3>
              <p className="text-sm text-muted-foreground text-center max-w-xs mt-1">Start by creating your first skill training or staff orientation module.</p>
            </div>
          )}
        </>
      )}

      <AddTrainingDialog
        isOpen={isAddDialogOpen}
        setIsOpen={setIsAddDialogOpen}
        onAddTraining={handleAddTraining}
      />
      
      {selectedSession && (
        <>
          <EditTrainingDialog
            isOpen={isEditDialogOpen}
            setIsOpen={setIsEditDialogOpen}
            session={selectedSession}
            onEditTraining={handleEditTraining}
          />
          <ViewTrainingDialog
            isOpen={isViewDialogOpen}
            setIsOpen={setIsViewDialogOpen}
            session={selectedSession}
          />
          <ManageParticipantsDialog
            isOpen={isManageParticipantsOpen}
            setIsOpen={setIsManageParticipantsOpen}
            session={selectedSession}
            onUpdate={handleRefreshSessions}
          />
        </>
      )}
    </main>
  );
}
