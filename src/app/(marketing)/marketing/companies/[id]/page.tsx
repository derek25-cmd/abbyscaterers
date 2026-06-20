"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ChevronRight, Pencil, MapPin, Phone, Mail, Briefcase, Building2, FileText, Image as ImageIcon,
  Mic, Pin, Plus, Loader2, CheckCircle2, Clock, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase-client";
import { useAuth } from "@/hooks/useAuth";
import { useCompany, useCompleteFollowUp } from "@/features/marketing/hooks/useMarketingQuery";
import { CompanyForm } from "@/features/marketing/components/forms/CompanyForm";
import { VisitForm } from "@/features/marketing/components/forms/VisitForm";
import { FollowUpForm } from "@/features/marketing/components/forms/FollowUpForm";
import { getStageMeta } from "@/features/marketing/utils/pipeline";
import { getTierFromScore } from "@/features/marketing/utils/lead-score";
import { formatDate, formatDateTime, formatTZS, gpsVerificationTag, isDueToday, isOverdue, titleCase } from "@/features/marketing/utils/format";
import { useQueryClient } from "@tanstack/react-query";
import type { FollowUp } from "@/features/marketing/types";

function ScoreRing({ score }: { score: number }) {
  const tier = getTierFromScore(score);
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);

  return (
    <div className="relative h-16 w-16 shrink-0">
      <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
        <circle cx="32" cy="32" r={radius} strokeWidth="6" fill="none" className="stroke-muted" />
        <circle
          cx="32" cy="32" r={radius} strokeWidth="6" fill="none" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          className={tier.dot.replace("bg-", "stroke-")}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold">{score}</div>
    </div>
  );
}

function DocumentIcon({ type }: { type: string }) {
  if (type.includes("image") || type.includes("photo") || type.includes("selfie")) return <ImageIcon className="h-5 w-5" />;
  if (type.includes("audio") || type.includes("voice")) return <Mic className="h-5 w-5" />;
  return <FileText className="h-5 w-5" />;
}

export default function CompanyDetailPage() {
  const params = useParams<{ id: string }>();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: company, isLoading } = useCompany(params.id);
  const completeFollowUp = useCompleteFollowUp();

  const [editOpen, setEditOpen] = useState(false);
  const [visitOpen, setVisitOpen] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!company) {
    return <div className="py-16 text-center text-muted-foreground">Company not found.</div>;
  }

  const stageMeta = getStageMeta(company.pipeline_stage);

  const addNote = async () => {
    if (!noteContent.trim()) return;
    setSavingNote(true);
    const { error } = await supabase.from("company_notes").insert([{
      company_id: company.id,
      author_id: user?.id ?? company.id,
      content: noteContent.trim(),
    }]);
    setSavingNote(false);
    if (error) {
      toast({ variant: "destructive", title: "Could not save note", description: error.message });
      return;
    }
    setNoteContent("");
    queryClient.invalidateQueries({ queryKey: ["marketing", "company", company.id] });
  };

  const markDone = async (id: string) => {
    try {
      await completeFollowUp.mutateAsync(id);
      toast({ title: "Follow-up completed" });
    } catch (error) {
      toast({ variant: "destructive", title: "Could not complete follow-up", description: error instanceof Error ? error.message : undefined });
    }
  };

  const overdueFollowUps = company.followUps.filter((f) => f.status !== "DONE" && f.status !== "CANCELLED" && isOverdue(f.due_date));
  const dueTodayFollowUps = company.followUps.filter((f) => f.status !== "DONE" && f.status !== "CANCELLED" && !isOverdue(f.due_date) && isDueToday(f.due_date));
  const upcomingFollowUps = company.followUps.filter((f) => f.status !== "DONE" && f.status !== "CANCELLED" && !isOverdue(f.due_date) && !isDueToday(f.due_date));
  const completedFollowUps = company.followUps.filter((f) => f.status === "DONE");

  const latestVisit = company.visits[0];
  const scoreFactors = latestVisit ? [
    { label: "Decision maker met", active: latestVisit.decision_maker_met, points: 20 },
    { label: "Budget confirmed", active: latestVisit.budget_confirmed, points: 20 },
    { label: "Follow-up requested", active: latestVisit.follow_up_requested, points: 10 },
    { label: "GPS verified", active: latestVisit.gps_verified, points: 5 },
  ] : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/marketing/companies" className="hover:text-foreground">Companies</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground">{company.name}</span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <ScoreRing score={company.lead_score} />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold">{company.name}</h2>
              <Badge className={stageMeta.color}>{stageMeta.label}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{company.industry ?? "No industry set"}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" /> Edit
          </Button>
          <Button onClick={() => setVisitOpen(true)}>Log Visit</Button>
        </div>
      </div>

      {scoreFactors.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Lead score breakdown (from most recent visit)</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {scoreFactors.map((factor) => (
              <div key={factor.label} className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{factor.label}</span>
                  <span>{factor.active ? factor.points : 0}/{factor.points}</span>
                </div>
                <Progress value={factor.active ? 100 : 0} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="visits">Visit History</TabsTrigger>
          <TabsTrigger value="followups">Follow-ups</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 pt-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Contact</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="flex items-center gap-2"><Briefcase className="h-4 w-4 text-muted-foreground" /> {company.contact_name ?? "—"} {company.contact_position ? `· ${company.contact_position}` : ""}</p>
                <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> {company.contact_phone ?? "—"}</p>
                <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /> {company.contact_email ?? "—"}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Business Info</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="flex items-center gap-2"><Building2 className="h-4 w-4 text-muted-foreground" /> {company.business_size ? titleCase(company.business_size) : "—"} {company.employee_count ? `· ${company.employee_count} employees` : ""}</p>
                <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /> {company.address ?? "—"} {company.region ? `(${company.region.name})` : ""}</p>
                <p>Est. monthly value: <span className="font-semibold">{formatTZS(company.estimated_value)}</span></p>
              </CardContent>
            </Card>
          </div>

          {company.latitude && company.longitude && (
            <Card>
              <CardContent className="p-0">
                <img
                  src={`https://staticmap.openstreetmap.de/staticmap.php?center=${company.latitude},${company.longitude}&zoom=15&size=600x200&markers=${company.latitude},${company.longitude}`}
                  alt="Company location map"
                  className="h-48 w-full rounded-md object-cover"
                />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Competitor Intel</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p><span className="font-medium">Current caterer:</span> {company.current_caterer ?? "Unknown"}</p>
              {company.current_caterer_notes && <p className="text-muted-foreground">{company.current_caterer_notes}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Notes</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Textarea rows={2} placeholder="Add a note..." value={noteContent} onChange={(e) => setNoteContent(e.target.value)} />
                <Button size="sm" onClick={addNote} disabled={savingNote || !noteContent.trim()}>
                  {savingNote ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                </Button>
              </div>
              {company.notes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No notes yet.</p>
              ) : (
                <ul className="space-y-2">
                  {company.notes.map((note) => (
                    <li key={note.id} className="rounded-md border p-2 text-sm">
                      {note.is_pinned && <Pin className="mr-1 inline h-3 w-3 text-primary" />}
                      {note.content}
                      <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(note.created_at)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="visits" className="space-y-3 pt-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setVisitOpen(true)}>Log Visit</Button>
          </div>
          {company.visits.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No visits logged yet.</p>
          ) : (
            company.visits.map((visit) => {
              const gpsTag = gpsVerificationTag(visit.gps_accuracy_tag);
              return (
                <Card key={visit.id}>
                  <CardContent className="space-y-2 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">{visit.check_in_time ? formatDateTime(visit.check_in_time) : "Unknown date"}</p>
                      <div className="flex gap-1.5">
                        {visit.purpose && <Badge variant="secondary">{titleCase(visit.purpose)}</Badge>}
                        {visit.outcome && <Badge variant="outline">{titleCase(visit.outcome)}</Badge>}
                        <Badge className={gpsTag.color}>{gpsTag.label}</Badge>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Interest: {visit.interest_level ? titleCase(visit.interest_level) : "—"} · Score: {visit.lead_score ?? "—"}
                    </p>
                    {visit.notes && <p className="text-sm">{visit.notes}</p>}
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="followups" className="space-y-4 pt-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setFollowUpOpen(true)}>+ Schedule Follow-up</Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FollowUpGroup title="Overdue" icon={AlertCircle} color="text-destructive" items={overdueFollowUps} onMarkDone={markDone} />
            <FollowUpGroup title="Due Today" icon={Clock} color="text-warning" items={dueTodayFollowUps} onMarkDone={markDone} />
            <FollowUpGroup title="Upcoming" icon={Clock} color="text-muted-foreground" items={upcomingFollowUps} onMarkDone={markDone} />
            <FollowUpGroup title="Completed" icon={CheckCircle2} color="text-success" items={completedFollowUps} onMarkDone={markDone} />
          </div>
        </TabsContent>

        <TabsContent value="documents" className="space-y-3 pt-4">
          <div className="flex justify-end">
            <Button size="sm" variant="outline" disabled title="Coming in Phase 3">Upload Document</Button>
          </div>
          {company.documents.length === 0 && company.visitDocuments.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No documents uploaded yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[...company.documents, ...company.visitDocuments].map((doc) => (
                <a key={doc.id} href={doc.url} target="_blank" rel="noreferrer" className="flex flex-col items-center gap-2 rounded-md border p-3 text-center hover:bg-accent">
                  <DocumentIcon type={doc.type} />
                  <span className="truncate text-xs">{doc.name}</span>
                </a>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <CompanyForm open={editOpen} onOpenChange={setEditOpen} company={company} />
      <VisitForm open={visitOpen} onOpenChange={setVisitOpen} companyId={company.id} companyName={company.name} />
      <FollowUpForm open={followUpOpen} onOpenChange={setFollowUpOpen} companyId={company.id} companyName={company.name} />
    </div>
  );
}

function FollowUpGroup({
  title, icon: Icon, color, items, onMarkDone,
}: {
  title: string;
  icon: typeof Clock;
  color: string;
  items: FollowUp[];
  onMarkDone: (id: string) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className={`flex items-center gap-2 text-sm ${color}`}>
          <Icon className="h-4 w-4" /> {title} <Badge variant="secondary">{items.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">None</p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
              <div>
                <p className="font-medium">{titleCase(item.type)}</p>
                <p className="text-xs text-muted-foreground">{formatDate(item.due_date)} · {item.marketer?.full_name ?? "Unassigned"}</p>
              </div>
              {item.status !== "DONE" && (
                <Button size="sm" variant="ghost" onClick={() => onMarkDone(item.id)}>Mark Done</Button>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
