"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  useDailyReportDraft, useDailyReports, useMyMarketingProfile, useSubmitDailyReport,
} from "@/features/marketing/hooks/useMarketingQuery";
import { isManager } from "@/features/marketing/utils/auth";
import { formatDate, titleCase } from "@/features/marketing/utils/format";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function DailyReportsPage() {
  const { toast } = useToast();
  const { data: myProfile } = useMyMarketingProfile();
  const [narrative, setNarrative] = useState("");
  const { data: draft, isLoading: draftLoading } = useDailyReportDraft(todayISO());
  const submit = useSubmitDailyReport();
  const { data: history } = useDailyReports({ marketerId: myProfile?.id });
  const { data: teamReports } = useDailyReports();

  const handleSubmit = async () => {
    if (narrative.trim().length < 10) return;
    try {
      await submit.mutateAsync({ reportDate: todayISO(), narrative: narrative.trim() });
      toast({ title: "Daily report submitted" });
      setNarrative("");
    } catch (error) {
      toast({ variant: "destructive", title: "Could not submit report", description: error instanceof Error ? error.message : undefined });
    }
  };

  const alreadySubmitted = Boolean(draft?.existingReport);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Daily Reports</h2>
        <p className="text-sm text-muted-foreground">Your day's movements, who you met, and what's a prospect — auto-compiled from visits you logged.</p>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Today — {formatDate(todayISO(), "long")}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {draftLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <>
              <div className="flex gap-4 text-sm">
                <Badge variant="secondary">{draft?.visitsCount ?? 0} visits</Badge>
                <Badge variant="secondary">{draft?.prospectsCount ?? 0} prospects</Badge>
                <Badge variant="secondary">{draft?.quotationsRequestedCount ?? 0} quotations requested</Badge>
              </div>

              {draft && draft.visits.length > 0 && (
                <ul className="space-y-1.5 text-sm">
                  {draft.visits.map((visit) => (
                    <li key={visit.id} className="rounded-md border p-2">
                      <span className="font-medium">{visit.company?.name ?? "Unknown company"}</span>
                      {visit.outcome && <span className="text-muted-foreground"> — {titleCase(visit.outcome)}</span>}
                      {visit.interest_level && <span className="text-muted-foreground"> · {titleCase(visit.interest_level)}</span>}
                    </li>
                  ))}
                </ul>
              )}

              {alreadySubmitted ? (
                <div className="flex items-center gap-2 rounded-md border border-success bg-success/5 p-3 text-sm text-success">
                  <CheckCircle2 className="h-4 w-4" /> Submitted at {formatDate(draft!.existingReport!.submitted_at, "long")}.
                  <p className="text-foreground">{draft!.existingReport!.narrative}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Wrap up your day</label>
                  <Textarea
                    rows={4}
                    placeholder="e.g. Spent the morning in Masaki, ABC Hotel's events manager wants a quotation for a 200-pax wedding..."
                    value={narrative}
                    onChange={(e) => setNarrative(e.target.value)}
                  />
                  <Button onClick={handleSubmit} disabled={submit.isPending || narrative.trim().length < 10}>
                    {submit.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Submit Daily Report
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Your Report History</CardTitle></CardHeader>
        <CardContent>
          <ReportTable reports={history} showMarketer={false} />
        </CardContent>
      </Card>

      {myProfile && isManager(myProfile.role) && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Team Daily Reports</CardTitle></CardHeader>
          <CardContent>
            <ReportTable reports={teamReports} showMarketer />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ReportTable({ reports, showMarketer }: { reports: ReturnType<typeof useDailyReports>["data"]; showMarketer: boolean }) {
  if (!reports || reports.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No reports yet.</p>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          {showMarketer && <TableHead>Marketer</TableHead>}
          <TableHead className="text-right">Visits</TableHead>
          <TableHead className="text-right">Prospects</TableHead>
          <TableHead>Narrative</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {reports.map((report) => (
          <TableRow key={report.id}>
            <TableCell>{formatDate(report.report_date, "long")}</TableCell>
            {showMarketer && <TableCell>{report.marketer?.full_name ?? "—"}</TableCell>}
            <TableCell className="text-right">{report.visits_count}</TableCell>
            <TableCell className="text-right">{report.prospects_count}</TableCell>
            <TableCell className="max-w-md truncate text-sm text-muted-foreground">{report.narrative}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
