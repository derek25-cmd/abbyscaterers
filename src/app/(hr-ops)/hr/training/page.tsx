'use client';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, Users, MoreHorizontal, Loader2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { AddTrainingDialog } from "@/components/hr/add-training-dialog";
import { EditTrainingDialog } from "@/components/hr/edit-training-dialog";
import { ViewTrainingDialog } from "@/components/hr/view-training-dialog";
import { getTrainingSessions, addTrainingSession, updateTrainingSession, addTrainingParticipants } from "@/services/trainingService";
import { getEmployees } from "@/services/employeeService";
import { ManageParticipantsDialog } from "@/components/hr/manage-participants-dialog";

export default function TrainingPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isManageParticipantsOpen, setIsManageParticipantsOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [sessionsData, employeesData] = await Promise.all([
        getTrainingSessions(),
        getEmployees()
      ]);
      setSessions(sessionsData);
      setEmployees(employeesData);
      setLoading(false);
    };
    fetchData();
  }, []);

  const handleRefreshSessions = async () => {
      const data = await getTrainingSessions();
      setSessions(data);
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

  const openManageParticipants = (session: any) => {
    setSelectedSession(session);
    setIsManageParticipantsOpen(true);
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
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {sessions.map((session) => (
            <Card key={session.id} className="hover:shadow-2xl transition-all duration-500 border-primary/10 overflow-hidden group">
              <CardHeader className="grid grid-cols-[1fr_auto] items-start gap-4 space-y-0 bg-muted/20 pb-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
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
                        <DropdownMenuContent align="end" className="w-[160px]">
                          <DropdownMenuLabel className="text-[10px] uppercase font-black text-muted-foreground opacity-50">Operations</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => openViewDialog(session)} className="cursor-pointer font-semibold">View Details</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEditDialog(session)} className="cursor-pointer font-semibold">Edit Session</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openManageParticipants(session)} className="cursor-pointer font-bold text-primary">Manage Attendees</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="pt-6 pb-6">
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
                </div>
              </CardContent>
              <CardFooter className="bg-muted/10 border-t pt-4">
                <Button 
                    className="w-full font-bold shadow-md bg-primary hover:bg-primary/90" 
                    onClick={() => openManageParticipants(session)}
                >
                    Manage Attendees
                </Button>
              </CardFooter>
            </Card>
          ))}
          {sessions.length === 0 && (
             <div className="col-span-full flex flex-col items-center justify-center py-20 bg-muted/10 rounded-xl border-2 border-dashed border-muted-foreground/20">
                <Users className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-bold">No Training Sessions</h3>
                <p className="text-sm text-muted-foreground text-center max-w-xs mt-1">Start by creating your first skill training or staff orientation module.</p>
             </div>
          )}
        </div>
        )}
      
      <AddTrainingDialog
        isOpen={isAddDialogOpen}
        setIsOpen={setIsAddDialogOpen}
        onAddTraining={handleAddTraining}
      />
      {selectedSession && (
        <EditTrainingDialog
          isOpen={isEditDialogOpen}
          setIsOpen={setIsEditDialogOpen}
          session={selectedSession}
          onEditTraining={handleEditTraining}
        />
      )}
      {selectedSession && (
        <ViewTrainingDialog
          isOpen={isViewDialogOpen}
          setIsOpen={setIsViewDialogOpen}
          session={selectedSession}
        />
      )}
      {selectedSession && (
          <ManageParticipantsDialog
            isOpen={isManageParticipantsOpen}
            setIsOpen={setIsManageParticipantsOpen}
            session={selectedSession}
            onUpdate={handleRefreshSessions}
          />
      )}
    </main>
  );
}
