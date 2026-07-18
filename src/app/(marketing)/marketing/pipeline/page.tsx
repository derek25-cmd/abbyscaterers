"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, MoveRight, PartyPopper } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useCompanies, useRegions, useMarketersList, useUpdateStage } from "@/features/marketing/hooks/useMarketingQuery";
import { FUNNEL_STAGES, getStageMeta, VALID_TRANSITIONS } from "@/features/marketing/utils/pipeline";
import { getTierFromScore } from "@/features/marketing/utils/lead-score";
import { formatDate, formatTZS, initials } from "@/features/marketing/utils/format";
import type { Company, PipelineStage, QuotationPrompt, WonAlert } from "@/features/marketing/types";

export default function PipelinePage() {
  const { toast } = useToast();
  const router = useRouter();
  const [view, setView] = useState<"kanban" | "table">("kanban");
  const [assignedMarketerId, setAssignedMarketerId] = useState<string | undefined>();
  const [regionId, setRegionId] = useState<string | undefined>();
  const [industry, setIndustry] = useState("");
  const [quotationPrompt, setQuotationPrompt] = useState<QuotationPrompt | null>(null);
  const [wonAlert, setWonAlert] = useState<WonAlert | null>(null);

  const { data: regions } = useRegions();
  const { data: marketers } = useMarketersList();
  // Pulls up to the API's max page size — sufficient for a single company's active pipeline.
  const { data, isLoading } = useCompanies({ assignedMarketerId, regionId, industry: industry || undefined, limit: 100 });
  const updateStage = useUpdateStage();

  const companies = data?.data ?? [];
  const activeCompanies = companies.filter((c) => c.pipeline_stage !== "LOST");
  const lostCompanies = companies.filter((c) => c.pipeline_stage === "LOST");
  const totalValue = activeCompanies.reduce((sum, c) => sum + (Number(c.estimated_value) || 0), 0);

  const byStage = useMemo(() => {
    const map = new Map<PipelineStage, Company[]>();
    for (const stage of FUNNEL_STAGES) map.set(stage, []);
    for (const company of activeCompanies) {
      map.get(company.pipeline_stage)?.push(company);
    }
    for (const list of map.values()) list.sort((a, b) => b.lead_score - a.lead_score);
    return map;
  }, [activeCompanies]);

  const handleMoveStage = async (companyId: string, stage: PipelineStage) => {
    try {
      const result = await updateStage.mutateAsync({ id: companyId, stage });
      if (result.quotationPrompt) {
        setQuotationPrompt(result.quotationPrompt);
      } else if (result.wonAlert) {
        setWonAlert(result.wonAlert);
        toast({ title: "🎉 New client won!", description: `${result.wonAlert.companyName} is now a client.`, duration: 10_000 });
      } else {
        toast({ title: "Stage updated" });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Invalid stage transition", description: error instanceof Error ? error.message : undefined });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Pipeline</h2>
          <p className="text-sm text-muted-foreground">{activeCompanies.length} active prospects · {formatTZS(totalValue, { compact: true })} total value</p>
        </div>
        <Tabs value={view} onValueChange={(v) => setView(v as "kanban" | "table")}>
          <TabsList>
            <TabsTrigger value="kanban">Kanban</TabsTrigger>
            <TabsTrigger value="table">Table</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={assignedMarketerId ?? "all"} onValueChange={(v) => setAssignedMarketerId(v === "all" ? undefined : v)}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All marketers" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All marketers</SelectItem>
            {marketers?.map((m) => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={regionId ?? "all"} onValueChange={(v) => setRegionId(v === "all" ? undefined : v)}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All regions" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All regions</SelectItem>
            {regions?.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input className="w-48" placeholder="Filter by industry" value={industry} onChange={(e) => setIndustry(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-64" />)}
        </div>
      ) : view === "kanban" ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {FUNNEL_STAGES.map((stage) => {
            const meta = getStageMeta(stage);
            const stageCompanies = byStage.get(stage) ?? [];
            const stageValue = stageCompanies.reduce((sum, c) => sum + (Number(c.estimated_value) || 0), 0);
            return (
              <div key={stage} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Badge className={meta.color}>{meta.label}</Badge>
                  <span className="text-xs text-muted-foreground">{stageCompanies.length}</span>
                </div>
                <p className="text-xs text-muted-foreground">{formatTZS(stageValue, { compact: true })}</p>
                <div className="space-y-2">
                  {stageCompanies.map((company) => {
                    const tier = getTierFromScore(company.lead_score);
                    const transitions = VALID_TRANSITIONS[stage];
                    return (
                      <Card key={company.id}>
                        <CardContent className="space-y-2 p-3">
                          <Link href={`/marketing/companies/${company.id}`} className="font-medium hover:underline">{company.name}</Link>
                          <p className="text-xs text-muted-foreground">{company.industry ?? "—"} {company.employee_count ? `· ${company.employee_count} staff` : ""}</p>
                          <div className="flex items-center justify-between">
                            <Badge variant="outline" className={tier.color}>{company.lead_score}</Badge>
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="text-[10px]">
                                {(company as any).marketer?.full_name ? initials((company as any).marketer.full_name) : "—"}
                              </AvatarFallback>
                            </Avatar>
                          </div>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{formatTZS(company.estimated_value, { compact: true })}</span>
                            <span>{company.last_visited_at ? formatDate(company.last_visited_at, "relative") : "Never visited"}</span>
                          </div>
                          {transitions.length > 0 && (
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="w-full">
                                  Move stage <ChevronDown className="ml-1 h-3 w-3" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-48 p-1">
                                {transitions.map((next) => (
                                  <Button
                                    key={next}
                                    variant="ghost"
                                    size="sm"
                                    className="w-full justify-start"
                                    onClick={() => handleMoveStage(company.id, next)}
                                  >
                                    <MoveRight className="mr-2 h-3.5 w-3.5" /> {getStageMeta(next).label}
                                  </Button>
                                ))}
                              </PopoverContent>
                            </Popover>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Marketer</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Last Visited</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {FUNNEL_STAGES.flatMap((stage) => byStage.get(stage) ?? []).map((company) => {
                const meta = getStageMeta(company.pipeline_stage);
                const tier = getTierFromScore(company.lead_score);
                return (
                  <TableRow key={company.id}>
                    <TableCell><Link href={`/marketing/companies/${company.id}`} className="font-medium hover:underline">{company.name}</Link></TableCell>
                    <TableCell><Badge className={meta.color}>{meta.label}</Badge></TableCell>
                    <TableCell className={tier.color}>{company.lead_score}</TableCell>
                    <TableCell>{(company as any).marketer?.full_name ?? "Unassigned"}</TableCell>
                    <TableCell>{formatTZS(company.estimated_value, { compact: true })}</TableCell>
                    <TableCell>{company.last_visited_at ? formatDate(company.last_visited_at, "relative") : "Never"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Accordion type="single" collapsible>
        <AccordionItem value="lost">
          <AccordionTrigger>Lost ({lostCompanies.length})</AccordionTrigger>
          <AccordionContent>
            {lostCompanies.length === 0 ? (
              <p className="text-sm text-muted-foreground">No lost prospects.</p>
            ) : (
              <div className="space-y-2">
                {lostCompanies.map((company) => (
                  <div key={company.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                    <Link href={`/marketing/companies/${company.id}`} className="font-medium hover:underline">{company.name}</Link>
                    <span className="text-xs text-muted-foreground">{company.current_caterer_notes ?? "No reason recorded"}</span>
                  </div>
                ))}
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <Dialog open={Boolean(quotationPrompt)} onOpenChange={(open) => !open && setQuotationPrompt(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a Quotation?</DialogTitle>
            <DialogDescription>
              {quotationPrompt?.companyName} has requested a quotation
              {quotationPrompt?.estimatedValue ? ` — estimated value ${formatTZS(quotationPrompt.estimatedValue, { compact: true })}` : ""}.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This app tracks quotations as Proforma Invoices in a separate client list, so their details aren&apos;t
            linked automatically. Open a new proforma invoice and enter {quotationPrompt?.companyName}&apos;s details
            below to continue.
          </p>
          {quotationPrompt && (
            <div className="rounded-md border p-3 text-sm">
              {quotationPrompt.contactName && <p>Contact: {quotationPrompt.contactName}</p>}
              {quotationPrompt.contactEmail && <p>Email: {quotationPrompt.contactEmail}</p>}
              {quotationPrompt.services.length > 0 && <p>Services discussed: {quotationPrompt.services.join(", ")}</p>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuotationPrompt(null)}>Later</Button>
            <Button onClick={() => { router.push(quotationPrompt!.createQuotationUrl); setQuotationPrompt(null); }}>
              Create Quotation →
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(wonAlert)} onOpenChange={(open) => !open && setWonAlert(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><PartyPopper className="h-5 w-5 text-primary" /> New Client Won!</DialogTitle>
            <DialogDescription>
              {wonAlert?.companyName} is now a client.
              {wonAlert?.estimatedMonthlyValue ? ` Estimated monthly value: ${formatTZS(wonAlert.estimatedMonthlyValue)}.` : ""}
              {" "}Set up their first booking?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWonAlert(null)}>Stay in Pipeline</Button>
            <Button onClick={() => { router.push(wonAlert!.viewBookingsUrl); setWonAlert(null); }}>
              Go to Bookings →
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
