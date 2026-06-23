"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronRight, Pencil, MapPin, Phone, Mail, Briefcase, Building2, FileText, Image as ImageIcon,
  Mic, Pin, Plus, Loader2, CheckCircle2, Clock, AlertCircle, Sparkles, Download, Users, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase-client";
import { useAuth } from "@/hooks/useAuth";
import {
  useCompany, useCompleteFollowUp, useCompanyDocuments, useSignedUrl, useGenerateVisitSummary, useLeadAnalysis,
  useMyMarketingProfile, useAddCollaborator, useRemoveCollaborator,
} from "@/features/marketing/hooks/useMarketingQuery";
import { isManager } from "@/features/marketing/utils/auth";
import { CompanyForm } from "@/features/marketing/components/forms/CompanyForm";
import { VisitForm } from "@/features/marketing/components/forms/VisitForm";
import { FollowUpForm } from "@/features/marketing/components/forms/FollowUpForm";
import { FileUpload } from "@/features/marketing/components/ui/FileUpload";
import { getStageMeta } from "@/features/marketing/utils/pipeline";
import { getTierFromScore } from "@/features/marketing/utils/lead-score";
import { formatDate, formatDateTime, formatTZS, gpsVerificationTag, isDueToday, isOverdue, titleCase } from "@/features/marketing/utils/format";
import { useQueryClient } from "@tanstack/react-query";
import type { AILeadAnalysis, DocumentRow, FollowUp } from "@/features/marketing/types";

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
  const lower = type.toLowerCase();
  if (lower.includes("voice") || lower.includes("audio")) return <Mic className="h-5 w-5" />;
  if (lower.includes("photo") || lower.includes("selfie") || lower.includes("image")) return <ImageIcon className="h-5 w-5" />;
  return <FileText className="h-5 w-5" />;
}

function DocumentCard({ doc }: { doc: DocumentRow }) {
  const { data: url, isLoading } = useSignedUrl(doc.bucket, doc.path);
  return (
    <a
      href={url ?? undefined}
      target="_blank"
      rel="noreferrer"
      className={`flex flex-col items-center gap-2 rounded-md border p-3 text-center hover:bg-accent ${!url ? "pointer-events-none opacity-60" : ""}`}
    >
      <DocumentIcon type={doc.type} />
      <span className="truncate text-xs">{doc.name}</span>
      {isLoading ? <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" /> : <Download className="h-3 w-3 text-muted-foreground" />}
    </a>
  );
}

export default function CompanyDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: company, isLoading } = useCompany(params.id);
  const { data: myProfile } = useMyMarketingProfile();
  const { data: documents } = useCompanyDocuments(params.id);
  const completeFollowUp = useCompleteFollowUp();

  const [editOpen, setEditOpen] = useState(false);
  const [visitOpen, setVisitOpen] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [visitSummaries, setVisitSummaries] = useState<Record<string, string>>({});
  const [leadAnalysis, setLeadAnalysis] = useState<AILeadAnalysis | null>(null);
  const [analysisUnavailable, setAnalysisUnavailable] = useState(false);

  const generateSummary = useGenerateVisitSummary();
  const leadAnalysisMutation = useLeadAnalysis();
  const addCollaborator = useAddCollaborator();
  const removeCollaborator = useRemoveCollaborator();

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

  const addCollaboratorTo = async (marketerCode: string) => {
    try {
      const result = await addCollaborator.mutateAsync({ companyId: company.id, marketerCode });
      const addedName = (result as { data?: { marketer?: { full_name?: string } } })?.data?.marketer?.full_name;
      toast({ title: addedName ? `${addedName} added as a collaborator` : "Collaborator added" });
    } catch (error) {
      toast({ variant: "destructive", title: "Could not add collaborator", description: error instanceof Error ? error.message : undefined });
    }
  };

  const removeCollaboratorFrom = async (marketerId: string) => {
    try {
      await removeCollaborator.mutateAsync({ companyId: company.id, marketerId });
      toast({ title: "Collaborator removed" });
    } catch (error) {
      toast({ variant: "destructive", title: "Could not remove collaborator", description: error instanceof Error ? error.message : undefined });
    }
  };

  const summariseVisit = async (visitId: string) => {
    try {
      const summary = await generateSummary.mutateAsync(visitId);
      setVisitSummaries((prev) => ({ ...prev, [visitId]: summary }));
    } catch (error) {
      toast({ variant: "destructive", title: "AI summary unavailable", description: error instanceof Error ? error.message : "Please try again later." });
    }
  };

  const analyseLead = async () => {
    setAnalysisUnavailable(false);
    try {
      const result = await leadAnalysisMutation.mutateAsync(company.id);
      setLeadAnalysis(result);
    } catch {
      setAnalysisUnavailable(true);
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
          {myProfile && isManager(myProfile.role) && company.pipeline_stage === "WON" && !company.client_id && (
            <Button variant="secondary" onClick={() => router.push(`/clients/new?fromCompany=${company.id}`)}>
              Approve as Client
            </Button>
          )}
        </div>
      </div>

      {company.onboarding_requested && !company.client_id && (
        <p className="text-sm text-warning">
          ⚑ The marketer has flagged this company as ready to be onboarded into the client database
          {company.onboarding_requested_at ? ` (${formatDate(company.onboarding_requested_at)})` : ""}.
          {myProfile && isManager(myProfile.role) && company.pipeline_stage === "WON" ? " Use \"Approve as Client\" above to start commissions." : ""}
        </p>
      )}

      {company.pipeline_stage === "WON" && company.client_id && (
        <p className="text-sm text-success">
          ✓ Linked to client <Link href={`/clients/${company.client_id}`} className="font-medium hover:underline">{company.client_id}</Link>
          {company.landed_at ? ` since ${formatDate(company.landed_at)}` : ""} — commission tracking is active for{" "}
          {company.assigned_marketer_id ? "the assigned marketer" : "no marketer (none assigned)"}.
        </p>
      )}

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

          <CollaboratorsCard
            company={company}
            myProfile={myProfile}
            onAdd={addCollaboratorTo}
            onRemove={removeCollaboratorFrom}
            adding={addCollaborator.isPending}
            removing={removeCollaborator.isPending}
          />

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
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-1.5 text-sm"><Sparkles className="h-4 w-4 text-primary" /> AI Lead Analysis</CardTitle>
              <Button size="sm" variant="outline" disabled={leadAnalysisMutation.isPending} onClick={analyseLead}>
                {leadAnalysisMutation.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
                {leadAnalysis ? "Re-analyse" : "Analyse"}
              </Button>
            </CardHeader>
            <CardContent>
              {analysisUnavailable ? (
                <p className="text-sm text-muted-foreground">AI analysis is currently unavailable.</p>
              ) : leadAnalysis ? (
                <div className="space-y-2 text-sm">
                  <Badge
                    className={
                      leadAnalysis.recommendation === "PURSUE" ? "bg-success/15 text-success"
                        : leadAnalysis.recommendation === "PAUSE" ? "bg-warning/15 text-warning"
                        : "bg-destructive/15 text-destructive"
                    }
                  >
                    {leadAnalysis.recommendation}
                  </Badge>
                  <p>{leadAnalysis.reasoning}</p>
                  <p className="font-medium">Next: {leadAnalysis.nextAction}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Get an AI-generated recommendation on whether to pursue this lead.</p>
              )}
            </CardContent>
          </Card>

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
              const aiSummary = visitSummaries[visit.id];
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
                    {aiSummary ? (
                      <p className="text-sm">
                        <Sparkles className="mr-1 inline h-3 w-3 text-primary" />
                        {aiSummary}
                      </p>
                    ) : visit.notes ? (
                      <p className="text-sm">{visit.notes}</p>
                    ) : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={generateSummary.isPending}
                      onClick={() => summariseVisit(visit.id)}
                    >
                      {generateSummary.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
                      {aiSummary ? "Re-summarise" : "Summarise ✨"}
                    </Button>
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

        <TabsContent value="documents" className="space-y-4 pt-4">
          <FileUpload
            bucket="company-documents"
            entityType="company"
            entityId={company.id}
            documentType="DOCUMENT"
            uploadedBy={user?.id ?? company.id}
            accept="image/jpeg,image/png,image/webp,application/pdf"
            label="Upload a document"
            onUploadComplete={() => queryClient.invalidateQueries({ queryKey: ["marketing", "company-documents", company.id] })}
          />
          {!documents || documents.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No documents uploaded yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {documents.map((doc) => <DocumentCard key={doc.id} doc={doc} />)}
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

function CollaboratorsCard({
  company, myProfile, onAdd, onRemove, adding, removing,
}: {
  company: import("@/features/marketing/types").CompanyDetail;
  myProfile: { id: string; role: import("@/features/marketing/types").MarketingUserRole } | null | undefined;
  onAdd: (marketerCode: string) => void;
  onRemove: (marketerId: string) => void;
  adding: boolean;
  removing: boolean;
}) {
  const [code, setCode] = useState("");
  const canManage = Boolean(myProfile && (isManager(myProfile.role) || myProfile.id === company.assigned_marketer_id));

  return (
    <Card className="sm:col-span-2">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-1.5 text-sm"><Users className="h-4 w-4" /> Collaborators</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          {company.marketer?.full_name ?? "Unassigned"} ({company.marketer?.marketer_code ?? "—"}) landed this company.
          {company.collaborators.length > 0 && " Commission is split equally among everyone listed here."}
        </p>
        {company.collaborators.length === 0 ? (
          <p className="text-sm text-muted-foreground">No collaborators added — full commission goes to the assigned marketer.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {company.collaborators.map((c) => (
              <li key={c.id}>
                <Badge variant="secondary" className="gap-1.5 pr-1">
                  {c.marketer?.full_name ?? "Unknown"} {c.marketer?.marketer_code ? <span className="text-muted-foreground">· {c.marketer.marketer_code}</span> : null}
                  {canManage && (
                    <button onClick={() => onRemove(c.marketer_id)} disabled={removing} className="rounded-full hover:bg-background/50">
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </Badge>
              </li>
            ))}
          </ul>
        )}
        {canManage && (
          <div className="flex gap-2">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Collaborator ID (e.g. MKT-0001)"
              className="h-9 flex-1"
            />
            <Button
              size="sm"
              disabled={!code.trim() || adding}
              onClick={() => { onAdd(code.trim()); setCode(""); }}
            >
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
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
