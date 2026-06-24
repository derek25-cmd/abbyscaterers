"use client";

import { useState } from "react";
import { Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  useAnalyseTarget, useCreateTarget, useDeleteTarget, useMarketersList,
  useMyMarketingProfile, useTargets,
} from "@/features/marketing/hooks/useMarketingQuery";
import { isManager } from "@/features/marketing/utils/auth";
import { computePeriodEndDate, TARGET_METRIC_KEYS, TARGET_PERIOD_LABELS, TARGET_PERIOD_TYPES } from "@/features/marketing/utils/targets";
import { formatDate, titleCase } from "@/features/marketing/utils/format";
import type { MarketingTarget, TargetPeriodType } from "@/features/marketing/types";

const PERIOD_TYPES: TargetPeriodType[] = [...TARGET_PERIOD_TYPES];

const STATUS_BADGE: Record<string, string> = {
  NOT_STARTED: "bg-muted text-muted-foreground",
  IN_PROGRESS: "bg-secondary text-secondary-foreground",
  ACHIEVED: "bg-success/15 text-success",
  PARTIALLY_ACHIEVED: "bg-warning/15 text-warning",
  MISSED: "bg-destructive/15 text-destructive",
};

export default function TargetsPage() {
  const { toast } = useToast();
  const { data: myProfile } = useMyMarketingProfile();
  const manager = Boolean(myProfile && isManager(myProfile.role));
  const { data: targets, isLoading } = useTargets(manager ? {} : { marketerId: myProfile?.id });
  const analyse = useAnalyseTarget();
  const deleteTarget = useDeleteTarget();
  const [createOpen, setCreateOpen] = useState(false);

  const handleAnalyse = async (target: MarketingTarget) => {
    try {
      await analyse.mutateAsync(target.id);
      toast({ title: "Target analysed" });
    } catch (error) {
      toast({ variant: "destructive", title: "Could not analyse target", description: error instanceof Error ? error.message : undefined });
    }
  };

  const handleDelete = async (target: MarketingTarget) => {
    if (!confirm("Delete this target? This also removes its analysis history.")) return;
    try {
      await deleteTarget.mutateAsync(target.id);
      toast({ title: "Target deleted" });
    } catch (error) {
      toast({ variant: "destructive", title: "Could not delete target", description: error instanceof Error ? error.message : undefined });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Targets</h2>
          <p className="text-sm text-muted-foreground">
            {manager ? "Daily, weekly, monthly, quarterly, and annual goals — per marketer or for the whole team." : "Your assigned goals and team-wide targets."}
          </p>
        </div>
        {manager && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-1.5 h-4 w-4" /> New Target</Button>
            </DialogTrigger>
            <CreateTargetDialog onDone={() => setCreateOpen(false)} />
          </Dialog>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}</div>
      ) : !targets || targets.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">No targets set yet.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {targets.map((target) => (
            <TargetCard
              key={target.id}
              target={target}
              manager={manager}
              onAnalyse={() => handleAnalyse(target)}
              onDelete={() => handleDelete(target)}
              analysing={analyse.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TargetCard({
  target, manager, onAnalyse, onDelete, analysing,
}: {
  target: MarketingTarget;
  manager: boolean;
  onAnalyse: () => void;
  onDelete: () => void;
  analysing: boolean;
}) {
  const latest = target.latestAnalysis;
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm">
            {target.scope === "OVERALL" ? "Team-wide" : target.marketer?.full_name ?? "Marketer"}
            <span className="ml-2 text-xs font-normal text-muted-foreground">{TARGET_PERIOD_LABELS[target.period_type]}</span>
          </CardTitle>
          {latest && <Badge className={STATUS_BADGE[latest.status]}>{titleCase(latest.status)}</Badge>}
        </div>
        <p className="text-xs text-muted-foreground">{formatDate(target.start_date, "long")} – {formatDate(target.end_date, "long")}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="space-y-1 text-sm">
          {Object.entries(target.metrics).map(([key, goal]) => {
            const actual = latest?.actuals[key];
            return (
              <li key={key} className="flex items-center justify-between">
                <span className="text-muted-foreground">{titleCase(key)}</span>
                <span className="font-medium">{actual !== undefined ? `${actual} / ${goal}` : `Goal: ${goal}`}</span>
              </li>
            );
          })}
        </ul>

        {latest && (
          <div className="space-y-1 rounded-md border bg-muted/30 p-2.5 text-sm">
            <p className="font-medium">Score: {latest.score}/100</p>
            {latest.narrative && <p className="text-muted-foreground">{latest.narrative}</p>}
            {latest.recommendation && <p className="text-xs italic text-muted-foreground">→ {latest.recommendation}</p>}
          </div>
        )}

        {target.notes && <p className="text-xs text-muted-foreground">Note: {target.notes}</p>}

        <div className="flex items-center justify-between gap-2">
          <Button size="sm" variant="outline" onClick={onAnalyse} disabled={analysing}>
            {analysing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
            Analyse
          </Button>
          {manager && (
            <Button size="sm" variant="ghost" className="text-destructive" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function CreateTargetDialog({ onDone }: { onDone: () => void }) {
  const { toast } = useToast();
  const { data: marketers } = useMarketersList();
  const createTarget = useCreateTarget();

  const [scope, setScope] = useState<"MARKETER" | "OVERALL">("MARKETER");
  const [marketerId, setMarketerId] = useState<string>("");
  const [periodType, setPeriodType] = useState<TargetPeriodType>("MONTHLY");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(computePeriodEndDate("MONTHLY", new Date().toISOString().slice(0, 10)));
  const [metricGoals, setMetricGoals] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");

  const setMetric = (key: string, value: string) => setMetricGoals((prev) => ({ ...prev, [key]: value }));

  const handlePeriodChange = (value: TargetPeriodType) => {
    setPeriodType(value);
    setEndDate(computePeriodEndDate(value, startDate));
  };

  const handleStartDateChange = (value: string) => {
    setStartDate(value);
    setEndDate(computePeriodEndDate(periodType, value));
  };

  const handleSubmit = async () => {
    const metrics: Record<string, number> = {};
    for (const key of TARGET_METRIC_KEYS) {
      const raw = metricGoals[key];
      if (raw && Number(raw) > 0) metrics[key] = Number(raw);
    }
    if (Object.keys(metrics).length === 0) {
      toast({ variant: "destructive", title: "Set at least one metric goal" });
      return;
    }
    if (scope === "MARKETER" && !marketerId) {
      toast({ variant: "destructive", title: "Select a marketer" });
      return;
    }
    if (!endDate) {
      toast({ variant: "destructive", title: "Set an end date" });
      return;
    }

    try {
      await createTarget.mutateAsync({
        scope,
        marketerId: scope === "MARKETER" ? marketerId : undefined,
        periodType,
        startDate,
        endDate,
        metrics,
        notes: notes.trim() || undefined,
      });
      toast({ title: "Target created" });
      onDone();
    } catch (error) {
      toast({ variant: "destructive", title: "Could not create target", description: error instanceof Error ? error.message : undefined });
    }
  };

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>New Target</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Scope</Label>
            <Select value={scope} onValueChange={(v) => setScope(v as "MARKETER" | "OVERALL")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MARKETER">Individual marketer</SelectItem>
                <SelectItem value="OVERALL">Whole team (overall)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Period</Label>
            <Select value={periodType} onValueChange={(v) => handlePeriodChange(v as TargetPeriodType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PERIOD_TYPES.map((p) => <SelectItem key={p} value={p}>{TARGET_PERIOD_LABELS[p]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {scope === "MARKETER" && (
          <div className="space-y-1.5">
            <Label>Marketer</Label>
            <Select value={marketerId} onValueChange={setMarketerId}>
              <SelectTrigger><SelectValue placeholder="Select a marketer" /></SelectTrigger>
              <SelectContent>
                {(marketers ?? []).map((m) => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Start date</Label>
            <Input type="date" value={startDate} onChange={(e) => handleStartDateChange(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>End date</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Metric goals (leave blank to skip)</Label>
          <div className="grid grid-cols-2 gap-2">
            {TARGET_METRIC_KEYS.map((key) => (
              <div key={key} className="space-y-1">
                <span className="text-xs text-muted-foreground">{titleCase(key)}</span>
                <Input
                  type="number"
                  min={0}
                  placeholder="e.g. 50"
                  value={metricGoals[key] ?? ""}
                  onChange={(e) => setMetric(key, e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Notes (optional)</Label>
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={handleSubmit} disabled={createTarget.isPending}>
          {createTarget.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Create Target
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
