"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Phone, Mail, MessageCircle, MapPin, FileText, ClipboardList } from "lucide-react";
import { formatRelative, isOverdue as isOverdueDate, titleCase } from "../../utils/format";
import type { FollowUp, FollowUpType } from "../../types";

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

export function FollowUpFeed({ followUps }: { followUps: FollowUp[] }) {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>Upcoming Follow-ups</CardTitle>
        <CardDescription>Tasks due across the marketing team.</CardDescription>
      </CardHeader>
      <CardContent>
        {followUps.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2 text-muted-foreground">
            <CheckCircle2 className="h-8 w-8" />
            <p className="text-sm">All caught up!</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {followUps.map((followUp) => {
              const Icon = TYPE_ICONS[followUp.type];
              const overdue = followUp.status === "OVERDUE" || isOverdueDate(followUp.due_date);
              return (
                <li key={followUp.id} className="flex items-start gap-3 rounded-lg border p-3">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      {titleCase(followUp.type)} — {followUp.company?.name ?? "Unknown company"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {followUp.marketer?.full_name ?? "Unassigned"}
                    </p>
                  </div>
                  <Badge variant={overdue ? "destructive" : "secondary"} className="shrink-0">
                    {formatRelative(followUp.due_date)}
                  </Badge>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
