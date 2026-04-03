'use client';

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
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Users, Search, GraduationCap } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { TrainingSessionSchema, type TrainingSessionFormData } from "@/lib/schemas";
import { getEmployees } from "@/services/employeeService";
import type { Employee } from "@/types";

interface CreateTrainingDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: TrainingSessionFormData) => Promise<void>;
}

export function CreateTrainingDialog({ isOpen, onOpenChange, onSubmit }: CreateTrainingDialogProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const form = useForm<TrainingSessionFormData>({
    resolver: zodResolver(TrainingSessionSchema),
    defaultValues: {
      title: "",
      topic: "",
      trainer: "",
      date: new Date().toISOString().split('T')[0],
      duration: "1 hour",
      status: 'Scheduled',
      participants: [],
      notes: ""
    }
  });

  useEffect(() => {
    if (isOpen) {
      setLoadingEmployees(true);
      getEmployees().then(data => {
        setEmployees(data.filter(e => e.status === 'Active'));
        setLoadingEmployees(false);
      });
    }
  }, [isOpen]);

  const filteredEmployees = employees.filter(e => 
    `${e.firstName} ${e.lastName}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleParticipant = (employee: Employee) => {
    const current = form.getValues('participants');
    const exists = current.find(p => p.employeeId === employee.id);
    
    if (exists) {
      form.setValue('participants', current.filter(p => p.employeeId !== employee.id));
    } else {
      form.setValue('participants', [
        ...current, 
        { employeeId: employee.id, name: `${employee.firstName} ${employee.lastName}`, attended: false }
      ]);
    }
  };

  const handleFormSubmit = async (data: TrainingSessionFormData) => {
    await onSubmit(data);
    form.reset();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col p-0">
        <form onSubmit={form.handleSubmit(handleFormSubmit)} className="flex flex-col h-full">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="flex items-center gap-2">
                <GraduationCap className="h-6 w-6 text-primary" />
                Schedule Training Session
            </DialogTitle>
            <DialogDescription>
              Define the training objectives and select attendees.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Session Title</Label>
                <Input id="title" {...form.register("title")} placeholder="e.g. Food Safety Standards" />
                {form.formState.errors.title && <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="topic">Topic / Module</Label>
                <Input id="topic" {...form.register("topic")} placeholder="e.g. Hygiene Level 1" />
                {form.formState.errors.topic && <p className="text-xs text-destructive">{form.formState.errors.topic.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="trainer">Lead Trainer</Label>
                <Input id="trainer" {...form.register("trainer")} placeholder="Name of instructor" />
                {form.formState.errors.trainer && <p className="text-xs text-destructive">{form.formState.errors.trainer.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Session Date</Label>
                <Input id="date" type="date" {...form.register("date")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="duration">Duration</Label>
                <Input id="duration" {...form.register("duration")} placeholder="e.g. 2 hours" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Initial Status</Label>
                <Controller
                  name="status"
                  control={form.control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Scheduled">Scheduled</SelectItem>
                        <SelectItem value="Completed">Completed</SelectItem>
                        <SelectItem value="Cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center border-b pb-2">
                <Label className="text-lg font-bold flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Select Participants
                </Label>
                <span className="text-xs font-bold text-muted-foreground uppercase">
                    {form.watch('participants').length} selected
                </span>
              </div>
              
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder="Filter employees..." 
                    className="pl-8" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <ScrollArea className="h-48 border rounded-md p-2 bg-muted/5">
                {loadingEmployees ? (
                    <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {filteredEmployees.map((emp) => {
                            const isSelected = !!form.watch('participants').find(p => p.employeeId === emp.id);
                            return (
                                <div 
                                    key={emp.id} 
                                    className={cn(
                                        "flex items-center space-x-3 p-2 rounded-md transition-colors cursor-pointer border",
                                        isSelected ? "bg-primary/10 border-primary/20" : "hover:bg-muted"
                                    )}
                                    onClick={() => toggleParticipant(emp)}
                                >
                                    <Checkbox 
                                        checked={isSelected} 
                                        onCheckedChange={() => toggleParticipant(emp)}
                                    />
                                    <div className="flex flex-col">
                                        <span className="text-sm font-semibold">{emp.firstName} {emp.lastName}</span>
                                        <span className="text-[10px] text-muted-foreground uppercase tracking-tight">{emp.role}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
              </ScrollArea>
              {form.formState.errors.participants && <p className="text-xs text-destructive">{form.formState.errors.participants.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Lead Trainer Notes (Optional)</Label>
              <Textarea id="notes" {...form.register("notes")} placeholder="Special requirements or instructions..." />
            </div>
          </div>

          <DialogFooter className="p-6 bg-muted/20 border-t">
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={form.formState.isSubmitting}>Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Session
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
