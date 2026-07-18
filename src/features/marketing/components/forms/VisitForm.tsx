"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { addDays, format } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useCreateVisit, useCreateFollowUp, useMarketersList } from "../../hooks/useMarketingQuery";
import { calculateLeadScore, getTierFromScore } from "../../utils/lead-score";
import { titleCase } from "../../utils/format";
import { SERVICE_OPTIONS, type FollowUpType, type InterestLevel, type VisitOutcome, type VisitPurpose } from "../../types";
import { FileUpload } from "../ui/FileUpload";

const VISIT_PURPOSES: VisitPurpose[] = [
  "INTRODUCTION", "FOLLOW_UP", "PROPOSAL_DELIVERY", "QUOTATION_FOLLOW_UP",
  "CONTRACT_RENEWAL", "COMPLAINT_RESOLUTION", "EVENT_INVITATION", "TASTING_SESSION",
];

const VISIT_OUTCOMES: VisitOutcome[] = [
  "VISITED", "NO_ONE_AVAILABLE", "MEETING_POSTPONED", "PROPOSAL_REQUESTED",
  "QUOTATION_SENT", "CONTRACT_NEGOTIATION", "CUSTOMER_ACQUIRED",
];

const FOLLOW_UP_TYPES: FollowUpType[] = [
  "CALL", "EMAIL", "WHATSAPP", "IN_PERSON_VISIT", "SEND_QUOTATION",
  "SEND_COMPANY_PROFILE", "ARRANGE_TASTING", "MEET_CEO", "MEET_PROCUREMENT", "CONTRACT_SIGNING",
];

const INTEREST_LEVELS: { value: InterestLevel; label: string }[] = [
  { value: "NOT_INTERESTED", label: "🔴 Not Interested" },
  { value: "MAYBE", label: "🟡 Maybe" },
  { value: "INTERESTED", label: "🟢 Interested" },
  { value: "VERY_INTERESTED", label: "⭐ Very Interested" },
];

const visitSchema = z.object({
  marketerId: z.string().min(1, "Marketer is required"),
  purpose: z.enum(VISIT_PURPOSES as unknown as [string, ...string[]]).optional(),
  visitDateTime: z.date(),
  outcome: z.enum(VISIT_OUTCOMES as unknown as [string, ...string[]]).optional(),
  notes: z.string().min(10, "Notes must be at least 10 characters"),
  interestLevel: z.enum(["NOT_INTERESTED", "MAYBE", "INTERESTED", "VERY_INTERESTED"]).optional(),
  decisionMakerMet: z.boolean(),
  budgetConfirmed: z.boolean(),
  followUpRequested: z.boolean(),
  servicesPresented: z.array(z.string()),
  scheduleFollowUp: z.boolean(),
  followUpType: z.enum(FOLLOW_UP_TYPES as unknown as [string, ...string[]]).optional(),
  followUpDueDate: z.date().optional(),
  followUpNotes: z.string().optional(),
}).refine((data) => !data.scheduleFollowUp || Boolean(data.followUpType), {
  message: "Follow-up type is required",
  path: ["followUpType"],
});

type VisitFormValues = z.infer<typeof visitSchema>;

const DEFAULT_VALUES: VisitFormValues = {
  marketerId: "",
  visitDateTime: new Date(),
  notes: "",
  decisionMakerMet: false,
  budgetConfirmed: false,
  followUpRequested: false,
  servicesPresented: [],
  scheduleFollowUp: false,
  followUpDueDate: addDays(new Date(), 3),
};

export function VisitForm({
  open,
  onOpenChange,
  companyId,
  companyName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  companyName: string;
}) {
  const { toast } = useToast();
  const { data: marketers } = useMarketersList();
  const createVisit = useCreateVisit();
  const createFollowUp = useCreateFollowUp();
  const [tab, setTab] = useState("details");
  const [savedVisitId, setSavedVisitId] = useState<string | null>(null);

  const form = useForm<VisitFormValues>({
    resolver: zodResolver(visitSchema),
    defaultValues: DEFAULT_VALUES,
  });

  useEffect(() => {
    if (open) {
      form.reset(DEFAULT_VALUES);
      setTab("details");
      setSavedVisitId(null);
    }
  }, [open, form]);

  const interestLevel = form.watch("interestLevel");
  const decisionMakerMet = form.watch("decisionMakerMet");
  const budgetConfirmed = form.watch("budgetConfirmed");
  const followUpRequested = form.watch("followUpRequested");
  const scheduleFollowUp = form.watch("scheduleFollowUp");
  const servicesPresented = form.watch("servicesPresented");

  const liveScore = calculateLeadScore({
    interestLevel,
    decisionMakerMet,
    budgetConfirmed,
    followUpRequested,
    gpsVerified: false,
  });
  const tier = getTierFromScore(liveScore);

  const toggleService = (service: string) => {
    const current = form.getValues("servicesPresented");
    form.setValue(
      "servicesPresented",
      current.includes(service) ? current.filter((s) => s !== service) : [...current, service]
    );
  };

  const isSubmitting = createVisit.isPending || createFollowUp.isPending;

  const onSubmit = async (values: VisitFormValues) => {
    if (savedVisitId) {
      onOpenChange(false);
      return;
    }
    try {
      const result = await createVisit.mutateAsync({
        companyId,
        marketerId: values.marketerId,
        purpose: values.purpose,
        checkInTime: values.visitDateTime.toISOString(),
        outcome: values.outcome,
        interestLevel: values.interestLevel,
        decisionMakerMet: values.decisionMakerMet,
        budgetConfirmed: values.budgetConfirmed,
        followUpRequested: values.followUpRequested,
        servicesPresented: values.servicesPresented,
        notes: values.notes,
        gpsVerified: false,
      });

      const visitId = (result.data as { id?: string })?.id;

      if (values.scheduleFollowUp && values.followUpType && values.followUpDueDate) {
        await createFollowUp.mutateAsync({
          companyId,
          assignedTo: values.marketerId,
          type: values.followUpType,
          dueDate: values.followUpDueDate.toISOString(),
          notes: values.followUpNotes,
          visitId,
        });
      }

      toast({ title: "Visit logged", description: `Lead score updated to ${result.leadScore}/100. You can now attach photos or a voice note.` });
      if (visitId) {
        setSavedVisitId(visitId);
        setTab("media");
      } else {
        onOpenChange(false);
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Could not log visit", description: error instanceof Error ? error.message : "Please try again." });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log Visit — {companyName}</DialogTitle>
          <DialogDescription>Manually record a field visit and update this prospect&apos;s lead score.</DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between rounded-lg border p-3">
          <span className="text-sm text-muted-foreground">Live lead score</span>
          <Badge variant="outline" className={cn("gap-1.5 text-base", tier.color)}>
            <span className={cn("h-2 w-2 rounded-full", tier.dot)} />
            {liveScore}/100 · {tier.label}
          </Badge>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger type="button" value="details">Visit Details</TabsTrigger>
                <TabsTrigger type="button" value="scoring">Scoring Inputs</TabsTrigger>
                <TabsTrigger type="button" value="followup">Follow-up</TabsTrigger>
                <TabsTrigger type="button" value="media" disabled={!savedVisitId}>Media</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4 pt-4">
                <FormField control={form.control} name="marketerId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Marketer</FormLabel>
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

                <FormField control={form.control} name="purpose" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Visit purpose</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select purpose" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {VISIT_PURPOSES.map((purpose) => (
                          <SelectItem key={purpose} value={purpose}>{titleCase(purpose)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="visitDateTime" render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Visit date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant="outline" className={cn("justify-start text-left font-normal", !field.value && "text-muted-foreground")}>
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? format(field.value, "dd MMM yyyy, HH:mm") : "Pick a date"}
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

                <FormField control={form.control} name="outcome" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Visit outcome</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select outcome" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {VISIT_OUTCOMES.map((outcome) => (
                          <SelectItem key={outcome} value={outcome}>{titleCase(outcome)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="notes" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl><Textarea rows={3} placeholder="What happened during the visit?" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </TabsContent>

              <TabsContent value="scoring" className="space-y-4 pt-4">
                <FormField control={form.control} name="interestLevel" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Interest level</FormLabel>
                    <FormControl>
                      <RadioGroup onValueChange={field.onChange} value={field.value} className="grid grid-cols-2 gap-2">
                        {INTEREST_LEVELS.map((level) => (
                          <FormItem key={level.value} className="flex items-center space-x-2 space-y-0 rounded-md border p-2">
                            <FormControl><RadioGroupItem value={level.value} /></FormControl>
                            <FormLabel className="cursor-pointer font-normal">{level.label}</FormLabel>
                          </FormItem>
                        ))}
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="decisionMakerMet" render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-md border p-3">
                    <FormLabel className="font-normal">Decision maker met?</FormLabel>
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  </FormItem>
                )} />

                <FormField control={form.control} name="budgetConfirmed" render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-md border p-3">
                    <FormLabel className="font-normal">Budget confirmed?</FormLabel>
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  </FormItem>
                )} />

                <FormField control={form.control} name="followUpRequested" render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-md border p-3">
                    <FormLabel className="font-normal">Follow-up requested?</FormLabel>
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  </FormItem>
                )} />

                <div>
                  <FormLabel>Services presented</FormLabel>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {SERVICE_OPTIONS.map((service) => (
                      <label key={service} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                        <Checkbox checked={servicesPresented.includes(service)} onCheckedChange={() => toggleService(service)} />
                        {service}
                      </label>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="followup" className="space-y-4 pt-4">
                <FormField control={form.control} name="scheduleFollowUp" render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <FormLabel className="font-normal">Schedule a follow-up?</FormLabel>
                      <FormDescription>Adds a follow-up task linked to this visit.</FormDescription>
                    </div>
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  </FormItem>
                )} />

                {scheduleFollowUp && (
                  <>
                    <FormField control={form.control} name="followUpType" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Follow-up type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                          <SelectContent>
                            {FOLLOW_UP_TYPES.map((type) => (
                              <SelectItem key={type} value={type}>{titleCase(type)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="followUpDueDate" render={({ field }) => (
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

                    <FormField control={form.control} name="followUpNotes" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl><Textarea rows={2} {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </>
                )}
              </TabsContent>

              <TabsContent value="media" className="space-y-4 pt-4">
                {savedVisitId ? (
                  <>
                    <p className="text-sm text-muted-foreground">Attach a selfie, gate photo, or voice note for this visit.</p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FileUpload
                        bucket="visit-photos"
                        entityType="visit"
                        entityId={savedVisitId}
                        documentType="SELFIE"
                        uploadedBy={form.getValues("marketerId")}
                        accept="image/jpeg,image/png,image/webp,image/heic"
                        label="Selfie"
                      />
                      <FileUpload
                        bucket="visit-photos"
                        entityType="visit"
                        entityId={savedVisitId}
                        documentType="GATE_PHOTO"
                        uploadedBy={form.getValues("marketerId")}
                        accept="image/jpeg,image/png,image/webp,image/heic"
                        label="Gate Photo"
                      />
                    </div>
                    <FileUpload
                      bucket="voice-notes"
                      entityType="visit"
                      entityId={savedVisitId}
                      documentType="VOICE_NOTE"
                      uploadedBy={form.getValues("marketerId")}
                      accept="audio/webm,audio/mp4,audio/mpeg,audio/ogg,audio/wav"
                      label="Voice Note"
                    />
                  </>
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">Save the visit first to attach media.</p>
                )}
              </TabsContent>
            </Tabs>

            <DialogFooter>
              {savedVisitId ? (
                <Button type="button" onClick={() => onOpenChange(false)}>Done</Button>
              ) : (
                <>
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Log Visit
                  </Button>
                </>
              )}
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
