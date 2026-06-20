"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { addDays, format } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useCreateFollowUp, useMarketersList } from "../../hooks/useMarketingQuery";
import { titleCase } from "../../utils/format";
import type { FollowUpType } from "../../types";
import { CompanyCombobox } from "./CompanyCombobox";

const FOLLOW_UP_TYPES: FollowUpType[] = [
  "CALL", "EMAIL", "WHATSAPP", "IN_PERSON_VISIT", "SEND_QUOTATION",
  "SEND_COMPANY_PROFILE", "ARRANGE_TASTING", "MEET_CEO", "MEET_PROCUREMENT", "CONTRACT_SIGNING",
];

const followUpSchema = z.object({
  companyId: z.string().min(1, "Company is required"),
  assignedTo: z.string().min(1, "Assigned marketer is required"),
  type: z.enum(FOLLOW_UP_TYPES as unknown as [string, ...string[]]),
  dueDate: z.date(),
  notes: z.string().optional(),
});

type FollowUpFormValues = z.infer<typeof followUpSchema>;

export function FollowUpForm({
  open,
  onOpenChange,
  companyId,
  companyName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId?: string;
  companyName?: string;
}) {
  const { toast } = useToast();
  const { data: marketers } = useMarketersList();
  const createFollowUp = useCreateFollowUp();
  const [selectedCompanyName, setSelectedCompanyName] = useState(companyName);

  const form = useForm<FollowUpFormValues>({
    resolver: zodResolver(followUpSchema),
    defaultValues: {
      companyId: companyId ?? "",
      assignedTo: "",
      type: "CALL",
      dueDate: addDays(new Date(), 3),
      notes: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        companyId: companyId ?? "",
        assignedTo: "",
        type: "CALL",
        dueDate: addDays(new Date(), 3),
        notes: "",
      });
      setSelectedCompanyName(companyName);
    }
  }, [open, companyId, companyName, form]);

  const onSubmit = async (values: FollowUpFormValues) => {
    try {
      await createFollowUp.mutateAsync({ ...values, dueDate: values.dueDate.toISOString() });
      toast({ title: "Follow-up scheduled", description: "The follow-up has been added to the schedule." });
      onOpenChange(false);
    } catch (error) {
      toast({ variant: "destructive", title: "Could not schedule follow-up", description: error instanceof Error ? error.message : "Please try again." });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Schedule Follow-up</DialogTitle>
          <DialogDescription>Set a reminder to follow up with a prospect.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="companyId" render={({ field }) => (
              <FormItem>
                <FormLabel>Company</FormLabel>
                <FormControl>
                  <CompanyCombobox
                    value={field.value}
                    label={selectedCompanyName}
                    disabled={Boolean(companyId)}
                    onSelect={(company) => {
                      field.onChange(company.id);
                      setSelectedCompanyName(company.name);
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="type" render={({ field }) => (
              <FormItem>
                <FormLabel>Follow-up type</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    {FOLLOW_UP_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>{titleCase(type)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="assignedTo" render={({ field }) => (
              <FormItem>
                <FormLabel>Assigned marketer</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select marketer" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {marketers?.map((marketer) => (
                      <SelectItem key={marketer.id} value={marketer.id}>{marketer.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="dueDate" render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Due date</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button variant="outline" className={cn("justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value ? format(field.value, "dd MMM yyyy") : "Pick a date"}
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={field.value} onSelect={(date) => date && field.onChange(date)} initialFocus />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl><Textarea rows={3} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={createFollowUp.isPending}>
                {createFollowUp.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Schedule
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
