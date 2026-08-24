"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  Phone, Mail, MessageCircle, MapPin, FileText, ClipboardList, PlusCircle,
  CalendarClock, Check, X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useFollowUps, useCompleteFollowUp, useUpdateFollowUp } from "@/features/marketing/hooks/useMarketingQuery";
import { FollowUpForm } from "@/features/marketing/components/forms/FollowUpForm";
import { formatDate, initials, isDueToday, isOverdue, titleCase } from "@/features/marketing/utils/format";
import type { FollowUp, FollowUpType } from "@/features/marketing/types";

const TYPE_ICONS: Record<FollowUpType, typeof Phone> = {
  CALL: Phone,
  EMAIL: Mail,
  WHATSAPP: MessageCircle,
  IN_PERSON_VISIT: MapPin,
  SEND_QUOTATION: FileText,
  SEND_COMPANY_PROFILE: FileText,
  ARRANGE_TASTING: ClipboardList,
  MEET_CEO: MapPin,
  MEET_PROCUREMENT: MapPin,
  CONTRACT_SIGNING: FileText,
};

function FollowUpRow({ followUp, onMarkDone, onReschedule }: {
  followUp: FollowUp;
  onMarkDone: (id: string) => Promise<void>;
  onReschedule: (id: string, date: Date) => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const Icon = TYPE_ICONS[followUp.type];
  const overdue = isOverdue(followUp.due_date);
  const dueToday = isDueToday(followUp.due_date);

  return (
    <motion.div
      layout
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      className="flex items-center gap-3 rounded-lg border p-3"
    >
      <Icon className="h-4 w-4 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <Link href={`/marketing/companies/${followUp.company_id}`} className="font-medium hover:underline">
          {followUp.company?.name ?? "Unknown company"}
        </Link>
        <p className="text-xs text-muted-foreground">{titleCase(followUp.type)}</p>
      </div>
      <div className="flex items-center gap-2">
        <Avatar className="h-6 w-6"><AvatarFallback className="text-[10px]">{followUp.marketer ? initials(followUp.marketer.full_name) : "—"}</AvatarFallback></Avatar>
        <span className="hidden text-xs text-muted-foreground sm:inline">{followUp.marketer?.full_name ?? "Unassigned"}</span>
      </div>
      <Badge variant={overdue ? "destructive" : dueToday ? "default" : "secondary"}>{formatDate(followUp.due_date, "relative")}</Badge>
      <Badge variant="outline">{titleCase(followUp.status)}</Badge>

      {confirming ? (
        <div className="flex items-center gap-1">
          <Button size="sm" variant="default" onClick={() => onMarkDone(followUp.id)}><Check className="h-3.5 w-3.5" /></Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}><X className="h-3.5 w-3.5" /></Button>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={() => setConfirming(true)}>Mark Done</Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="ghost"><CalendarClock className="h-4 w-4" /></Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar mode="single" selected={new Date(followUp.due_date)} onSelect={(date) => date && onReschedule(followUp.id, date)} initialFocus />
            </PopoverContent>
          </Popover>
        </div>
      )}
    </motion.div>
  );
}

export default function FollowUpsPage() {
  const { toast } = useToast();
  const { data: followUps, isLoading } = useFollowUps();
  const completeFollowUp = useCompleteFollowUp();
  const updateFollowUp = useUpdateFollowUp();
  const [formOpen, setFormOpen] = useState(false);

  const active = (followUps ?? []).filter((f) => f.status !== "DONE" && f.status !== "CANCELLED");
  const overdue = active.filter((f) => isOverdue(f.due_date));
  const dueToday = active.filter((f) => !isOverdue(f.due_date) && isDueToday(f.due_date));
  const upcoming = active.filter((f) => !isOverdue(f.due_date) && !isDueToday(f.due_date));

  const handleMarkDone = async (id: string) => {
    try {
      await completeFollowUp.mutateAsync(id);
      toast({ title: "Follow-up completed" });
    } catch (error) {
      toast({ variant: "destructive", title: "Could not complete follow-up", description: error instanceof Error ? error.message : undefined });
    }
  };

  const handleReschedule = async (id: string, date: Date) => {
    try {
      await updateFollowUp.mutateAsync({ id, input: { dueDate: date.toISOString(), status: "RESCHEDULED" } });
      toast({ title: "Follow-up rescheduled", description: formatDate(date.toISOString()) });
    } catch (error) {
      toast({ variant: "destructive", title: "Could not reschedule", description: error instanceof Error ? error.message : undefined });
    }
  };

  const renderList = (items: FollowUp[], emptyLabel: string) => (
    <div className="space-y-2">
      <AnimatePresence initial={false}>
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          items.map((item) => (
            <FollowUpRow key={item.id} followUp={item} onMarkDone={handleMarkDone} onReschedule={handleReschedule} />
          ))
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Follow-ups</h2>
          <p className="text-sm text-muted-foreground">{formatDate(new Date(), "long")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="destructive">{overdue.length} overdue</Badge>
          <Badge>{dueToday.length} due today</Badge>
          <Button onClick={() => setFormOpen(true)}><PlusCircle className="mr-2 h-4 w-4" /> Schedule Follow-up</Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : (
        <Tabs defaultValue="today">
          <TabsList>
            <TabsTrigger value="today">Today ({dueToday.length})</TabsTrigger>
            <TabsTrigger value="overdue">Overdue ({overdue.length})</TabsTrigger>
            <TabsTrigger value="upcoming">All Upcoming ({upcoming.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="today" className="pt-4">{renderList(dueToday, "Nothing due today.")}</TabsContent>
          <TabsContent value="overdue" className="pt-4">{renderList(overdue, "Nothing overdue. Great work!")}</TabsContent>
          <TabsContent value="upcoming" className="pt-4">{renderList(upcoming, "No upcoming follow-ups.")}</TabsContent>
        </Tabs>
      )}

      <FollowUpForm open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}
