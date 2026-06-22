"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, CheckCircle, Flame, MapPin, Radio, Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase-client";
import { formatDate, initials, titleCase } from "../../utils/format";

type ActivityType = "visit_checkin" | "deal_won" | "hot_lead" | "followup_done" | "stage_change";

interface ActivityEvent {
  id: string;
  type: ActivityType;
  marketerName: string;
  companyId: string;
  companyName: string;
  detail: string;
  timestamp: string;
  leadScore?: number;
}

const TYPE_ICON: Record<ActivityType, typeof MapPin> = {
  visit_checkin: MapPin,
  deal_won: Trophy,
  hot_lead: Flame,
  followup_done: CheckCircle,
  stage_change: ArrowRight,
};

const TYPE_COLOR: Record<ActivityType, string> = {
  visit_checkin: "text-primary",
  deal_won: "text-success",
  hot_lead: "text-destructive",
  followup_done: "text-success",
  stage_change: "text-muted-foreground",
};

export function LiveActivityFeed({ onHotLead }: { onHotLead?: (companyName: string, score: number, companyId: string) => void }) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [, setTick] = useState(0);
  const previousStages = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const pushEvent = (event: ActivityEvent) => {
      setEvents((prev) => [event, ...prev].slice(0, 20));
    };

    const channel = supabase
      .channel("marketing-activity-feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "visits" }, async (payload) => {
        const visit = payload.new as { id: string; company_id: string; marketer_id: string; check_in_time: string | null };
        const { data } = await supabase
          .from("visits")
          .select("company:companies(name), marketer:marketing_users(full_name)")
          .eq("id", visit.id)
          .maybeSingle();
        const companyName = (data as any)?.company?.name ?? "a company";
        const marketerName = (data as any)?.marketer?.full_name ?? "Someone";
        pushEvent({
          id: `visit-${visit.id}`,
          type: "visit_checkin",
          marketerName,
          companyId: visit.company_id,
          companyName,
          detail: `Checked in at ${companyName}`,
          timestamp: visit.check_in_time ?? new Date().toISOString(),
        });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "companies" }, (payload) => {
        const company = payload.new as { id: string; name: string; lead_score: number; pipeline_stage: string };
        const old = payload.old as { lead_score?: number; pipeline_stage?: string };

        if (company.pipeline_stage === "WON" && old.pipeline_stage && old.pipeline_stage !== "WON") {
          pushEvent({
            id: `won-${company.id}-${Date.now()}`,
            type: "deal_won",
            marketerName: "",
            companyId: company.id,
            companyName: company.name,
            detail: `${company.name} converted to a client`,
            timestamp: new Date().toISOString(),
          });
        } else if (company.lead_score >= 80 && (old.lead_score == null || old.lead_score < 80)) {
          pushEvent({
            id: `hot-${company.id}-${Date.now()}`,
            type: "hot_lead",
            marketerName: "",
            companyId: company.id,
            companyName: company.name,
            detail: `${company.name} scored ${company.lead_score}/100`,
            timestamp: new Date().toISOString(),
            leadScore: company.lead_score,
          });
          onHotLead?.(company.name, company.lead_score, company.id);
        } else if (
          old.pipeline_stage &&
          old.pipeline_stage !== company.pipeline_stage &&
          previousStages.current.get(company.id) !== company.pipeline_stage
        ) {
          previousStages.current.set(company.id, company.pipeline_stage);
          pushEvent({
            id: `stage-${company.id}-${Date.now()}`,
            type: "stage_change",
            marketerName: "",
            companyId: company.id,
            companyName: company.name,
            detail: `Moved to ${titleCase(company.pipeline_stage)}`,
            timestamp: new Date().toISOString(),
          });
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "follow_ups" }, async (payload) => {
        const followUp = payload.new as { id: string; company_id: string; status: string; completed_at: string | null };
        const old = payload.old as { status?: string };
        if (followUp.status !== "DONE" || old.status === "DONE") return;

        const { data } = await supabase.from("companies").select("name").eq("id", followUp.company_id).maybeSingle();
        pushEvent({
          id: `followup-${followUp.id}`,
          type: "followup_done",
          marketerName: "",
          companyId: followUp.company_id,
          companyName: data?.name ?? "a company",
          detail: `Follow-up completed for ${data?.name ?? "a company"}`,
          timestamp: followUp.completed_at ?? new Date().toISOString(),
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Radio className="h-4 w-4 text-primary" /> Live Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Waiting for live activity...</p>
        ) : (
          <ul className="space-y-2">
            <AnimatePresence initial={false}>
              {events.map((event) => {
                const Icon = TYPE_ICON[event.type];
                return (
                  <motion.li
                    key={event.id}
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-3 rounded-md border p-2 text-sm"
                  >
                    <Icon className={`h-4 w-4 shrink-0 ${TYPE_COLOR[event.type]}`} />
                    {event.marketerName && (
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                        {initials(event.marketerName)}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <Link href={`/marketing/companies/${event.companyId}`} className="truncate font-medium hover:underline">
                        {event.detail}
                      </Link>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatDate(event.timestamp, "relative")}</span>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
