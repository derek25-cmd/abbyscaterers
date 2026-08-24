"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDown, ArrowUp, FileSpreadsheet, FileText, Minus, RefreshCw, Sparkles, FileQuestion,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useToast } from "@/hooks/use-toast";
import {
  useCac, useCompetitors, useGenerateCompetitorInsight, useGenerateReportNarrative,
  useMonthlyReport, useRecalculatePerformance, useRoi, useSaveExpenses,
} from "@/features/marketing/hooks/useMarketingQuery";
import { getStageMeta } from "@/features/marketing/utils/pipeline";
import { formatTZS, formatTrend } from "@/features/marketing/utils/format";
import { exportReportExcel, exportReportPdf } from "@/features/marketing/utils/report-export";

const DONUT_COLORS = [
  "hsl(var(--primary))", "hsl(var(--success))", "hsl(var(--warning))",
  "hsl(var(--destructive))", "hsl(var(--muted-foreground))", "hsl(var(--secondary-foreground))",
];

function TrendBadge({ current, previous }: { current: number; previous: number }) {
  const trend = formatTrend(current, previous);
  const Icon = trend.direction === "up" ? ArrowUp : trend.direction === "down" ? ArrowDown : Minus;
  const color = trend.direction === "up" ? "text-success" : trend.direction === "down" ? "text-destructive" : "text-muted-foreground";
  return <span className={`inline-flex items-center gap-0.5 text-xs ${color}`}><Icon className="h-3 w-3" />{trend.label}</span>;
}

export default function ReportsPage() {
  const { toast } = useToast();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const { data: report, isLoading } = useMonthlyReport(month, year);
  const monthValue = `${year}-${String(month).padStart(2, "0")}`;
  const monthLabel = new Date(year, month - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });

  const [narrative, setNarrative] = useState("");
  const [narrativeUnavailable, setNarrativeUnavailable] = useState(false);
  const [expensesInput, setExpensesInput] = useState("");
  const [competitorInsight, setCompetitorInsight] = useState("");
  const [insightUnavailable, setInsightUnavailable] = useState(false);

  const { data: cac } = useCac(month, year);
  const { data: roi } = useRoi(month, year);
  const { data: competitors } = useCompetitors();
  const saveExpenses = useSaveExpenses();
  const generateNarrative = useGenerateReportNarrative();
  const generateInsight = useGenerateCompetitorInsight();
  const recalculate = useRecalculatePerformance();

  const narrativeKey = `marketing-report-narrative-${month}-${year}`;

  useEffect(() => {
    setNarrative(localStorage.getItem(narrativeKey) ?? "");
    setNarrativeUnavailable(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [narrativeKey]);

  useEffect(() => {
    setExpensesInput(cac?.totalExpenses != null ? String(cac.totalExpenses) : "");
  }, [cac?.totalExpenses]);

  const revenueByMarketer = useMemo(
    () => (report?.teamPerformance ?? [])
      .map((row) => ({ marketerName: row.marketerName, revenue: row.revenueGenerated }))
      .filter((row) => row.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue),
    [report]
  );

  const revenueByRegion = useMemo(() => {
    const totals = new Map<string, number>();
    for (const row of report?.teamPerformance ?? []) {
      const region = row.region ?? "Unassigned";
      totals.set(region, (totals.get(region) ?? 0) + row.revenueGenerated);
    }
    return Array.from(totals.entries())
      .map(([regionName, revenue]) => ({ regionName, revenue }))
      .filter((r) => r.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue);
  }, [report]);

  const revenueByIndustryTop = useMemo(() => {
    const rows = report?.revenueByIndustry ?? [];
    const top = rows.slice(0, 8);
    const rest = rows.slice(8);
    if (rest.length === 0) return top;
    const other = rest.reduce(
      (acc, r) => ({ companyCount: acc.companyCount + r.companyCount, totalValue: acc.totalValue + r.totalValue }),
      { companyCount: 0, totalValue: 0 }
    );
    return [...top, { industry: "Other", companyCount: other.companyCount, totalValue: other.totalValue, avgDealSize: other.companyCount ? Math.round(other.totalValue / other.companyCount) : 0 }];
  }, [report]);

  const isEmptyMonth = report && report.summary.totalVisits === 0 && report.teamPerformance.length === 0 && report.topCompanies.length === 0;

  const handleExportPdf = () => {
    if (!report) return;
    exportReportPdf(report);
    toast({ title: "PDF exported" });
  };

  const handleExportExcel = async () => {
    if (!report) return;
    await exportReportExcel(report);
    toast({ title: "Excel exported" });
  };

  const handleRecalculate = async () => {
    try {
      await recalculate.mutateAsync();
      toast({ title: "Performance data recalculated" });
    } catch (error) {
      toast({ variant: "destructive", title: "Recalculation failed", description: error instanceof Error ? error.message : undefined });
    }
  };

  const handleGenerateNarrative = async () => {
    if (!report) return;
    setNarrativeUnavailable(false);
    try {
      const topMarketer = report.teamPerformance[0];
      const text = await generateNarrative.mutateAsync({
        month: monthLabel,
        totalVisits: report.summary.totalVisits,
        newClients: report.summary.dealsWon,
        revenueGenerated: report.summary.revenueGenerated,
        topMarketer: topMarketer?.marketerName ?? "N/A",
        topMarketerRevenue: topMarketer?.revenueGenerated ?? 0,
        topRegion: revenueByRegion[0]?.regionName ?? "N/A",
        conversionRate: report.summary.conversionRate,
        cac: cac?.cac ?? null,
        competitorCount: competitors?.length ?? 0,
        vsLastMonth: {
          visits: formatTrend(report.summary.totalVisits, report.summary.previous.totalVisits).percent * (report.summary.totalVisits < report.summary.previous.totalVisits ? -1 : 1),
          revenue: formatTrend(report.summary.revenueGenerated, report.summary.previous.revenueGenerated).percent * (report.summary.revenueGenerated < report.summary.previous.revenueGenerated ? -1 : 1),
        },
      });
      setNarrative(text);
      localStorage.setItem(narrativeKey, text);
    } catch {
      setNarrativeUnavailable(true);
    }
  };

  const handleSaveExpenses = async () => {
    const value = Number(expensesInput);
    if (!Number.isFinite(value) || value < 0) return;
    try {
      await saveExpenses.mutateAsync({ month, year, totalExpenses: value });
      toast({ title: "Expenses saved" });
    } catch (error) {
      toast({ variant: "destructive", title: "Could not save expenses", description: error instanceof Error ? error.message : undefined });
    }
  };

  const handleGenerateInsight = async () => {
    if (!competitors?.length) return;
    setInsightUnavailable(false);
    try {
      const text = await generateInsight.mutateAsync(competitors);
      setCompetitorInsight(text);
    } catch {
      setInsightUnavailable(true);
    }
  };

  return (
    <div className="reports-content space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Reports</h2>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={monthValue}
            onChange={(e) => {
              const [y, m] = e.target.value.split("-").map(Number);
              setYear(y);
              setMonth(m);
            }}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          />
          <Button variant="outline" size="sm" onClick={handleRecalculate} disabled={recalculate.isPending}>
            <RefreshCw className={`mr-2 h-4 w-4 ${recalculate.isPending ? "animate-spin" : ""}`} /> Recalculate
          </Button>
          <Button variant="outline" onClick={handleExportPdf} disabled={!report}>
            <FileText className="mr-2 h-4 w-4" /> Export PDF
          </Button>
          <Button variant="outline" onClick={handleExportExcel} disabled={!report}>
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Export Excel
          </Button>
        </div>
      </div>

      {isLoading || !report ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : isEmptyMonth ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border py-16 text-center">
          <FileQuestion className="h-10 w-10 text-muted-foreground" />
          <p className="text-muted-foreground">No data for this month yet. Data populates as visits and deals are recorded.</p>
        </div>
      ) : (
        <>
          <Card className="border-l-2 border-l-primary">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Report Summary</CardTitle>
              <Button size="sm" variant="outline" disabled={generateNarrative.isPending} onClick={handleGenerateNarrative}>
                {generateNarrative.isPending ? <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
                {narrative ? "Regenerate" : "Generate Report Summary ✨"}
              </Button>
            </CardHeader>
            {(narrative || narrativeUnavailable) && (
              <CardContent>
                {narrativeUnavailable ? (
                  <p className="text-sm text-muted-foreground">AI summary generation is currently unavailable.</p>
                ) : (
                  <p className="text-sm italic text-muted-foreground">{narrative}</p>
                )}
              </CardContent>
            )}
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Executive Summary</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { label: "Total Visits", value: report.summary.totalVisits, prev: report.summary.previous.totalVisits },
                { label: "Verified Visits", value: report.summary.verifiedVisits, prev: report.summary.previous.verifiedVisits },
                { label: "New Leads", value: report.summary.newLeads, prev: report.summary.previous.newLeads },
                { label: "Hot Leads", value: report.summary.hotLeads, prev: undefined },
                { label: "Quotations Requested", value: report.summary.quotationsRequested, prev: report.summary.previous.quotationsRequested },
                { label: "Deals Won", value: report.summary.dealsWon, prev: report.summary.previous.dealsWon },
                { label: "Revenue Generated", value: formatTZS(report.summary.revenueGenerated, { compact: true }), prev: report.summary.previous.revenueGenerated, raw: report.summary.revenueGenerated },
                { label: "Conversion Rate", value: `${report.summary.conversionRate}%`, prev: undefined },
              ].map((metric) => (
                <div key={metric.label} className="space-y-1">
                  <p className="text-xs text-muted-foreground">{metric.label}</p>
                  <p className="text-xl font-semibold">{metric.value}</p>
                  {metric.prev !== undefined && (
                    <TrendBadge current={metric.raw ?? (metric.value as number)} previous={metric.prev} />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Pipeline Movement</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Stage</TableHead><TableHead className="text-right">Companies</TableHead></TableRow></TableHeader>
                <TableBody>
                  {report.pipelineMovement.map((row) => (
                    <TableRow key={row.stage}>
                      <TableCell><Badge className={getStageMeta(row.stage).color}>{getStageMeta(row.stage).label}</Badge></TableCell>
                      <TableCell className="text-right">{row.movedIn}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell><Badge className={getStageMeta("LOST").color}>Lost</Badge></TableCell>
                    <TableCell className="text-right">{report.lostThisMonth}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Team Performance</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Marketer</TableHead>
                    <TableHead className="text-right">Visits</TableHead>
                    <TableHead className="text-right">Verified</TableHead>
                    <TableHead className="text-right">Leads</TableHead>
                    <TableHead className="text-right">Quotations</TableHead>
                    <TableHead className="text-right">Deals</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Avg Score</TableHead>
                    <TableHead className="text-right">Follow-up Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.teamPerformance.map((row) => (
                    <TableRow key={row.marketerId}>
                      <TableCell className="font-medium">{row.marketerName}</TableCell>
                      <TableCell className="text-right">{row.totalVisits}</TableCell>
                      <TableCell className="text-right">{row.verifiedVisits}</TableCell>
                      <TableCell className="text-right">{row.newLeads}</TableCell>
                      <TableCell className="text-right">{row.quotationsRequested}</TableCell>
                      <TableCell className="text-right">{row.dealsWon}</TableCell>
                      <TableCell className="text-right">{formatTZS(row.revenueGenerated, { compact: true })}</TableCell>
                      <TableCell className="text-right">{row.avgLeadScore}</TableCell>
                      <TableCell className="text-right">{row.followUpRate}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right">{report.teamPerformance.reduce((s, r) => s + r.totalVisits, 0)}</TableCell>
                    <TableCell className="text-right">{report.teamPerformance.reduce((s, r) => s + r.verifiedVisits, 0)}</TableCell>
                    <TableCell className="text-right">{report.teamPerformance.reduce((s, r) => s + r.newLeads, 0)}</TableCell>
                    <TableCell className="text-right">{report.teamPerformance.reduce((s, r) => s + r.quotationsRequested, 0)}</TableCell>
                    <TableCell className="text-right">{report.teamPerformance.reduce((s, r) => s + r.dealsWon, 0)}</TableCell>
                    <TableCell className="text-right">{formatTZS(report.teamPerformance.reduce((s, r) => s + r.revenueGenerated, 0), { compact: true })}</TableCell>
                    <TableCell className="text-right">—</TableCell>
                    <TableCell className="text-right">—</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Top Companies</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Industry</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead>Marketer</TableHead>
                    <TableHead className="text-right">Est. Value</TableHead>
                    <TableHead>Last Visit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.topCompanies.map((company) => (
                    <TableRow key={company.id}>
                      <TableCell><Link href={`/marketing/companies/${company.id}`} className="font-medium hover:underline">{company.name}</Link></TableCell>
                      <TableCell>{company.industry ?? "—"}</TableCell>
                      <TableCell><Badge className={getStageMeta(company.pipeline_stage).color}>{getStageMeta(company.pipeline_stage).label}</Badge></TableCell>
                      <TableCell className="text-right">{company.lead_score}</TableCell>
                      <TableCell>{(company as any).marketer?.full_name ?? "Unassigned"}</TableCell>
                      <TableCell className="text-right">{formatTZS(company.estimated_value, { compact: true })}</TableCell>
                      <TableCell>{company.last_visited_at ?? "Never"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Revenue by Marketer</CardTitle></CardHeader>
            <CardContent>
              {revenueByMarketer.length === 0 ? (
                <p className="text-sm text-muted-foreground">No revenue recorded this month.</p>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(160, revenueByMarketer.length * 40)}>
                  <BarChart data={revenueByMarketer} layout="vertical" margin={{ left: 8, right: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => formatTZS(v, { compact: true })} />
                    <YAxis type="category" dataKey="marketerName" width={120} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip
                      formatter={(v: number) => formatTZS(v)}
                      contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
                    />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Revenue by Region</CardTitle></CardHeader>
              <CardContent>
                {revenueByRegion.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No revenue recorded this month.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={revenueByRegion} dataKey="revenue" nameKey="regionName" outerRadius={90} innerRadius={50}>
                        {revenueByRegion.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatTZS(v)} contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))" }} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Revenue by Industry</CardTitle></CardHeader>
              <CardContent>
                {revenueByIndustryTop.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No revenue recorded this month.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Industry</TableHead>
                        <TableHead className="text-right">Companies</TableHead>
                        <TableHead className="text-right">Total Value</TableHead>
                        <TableHead className="text-right">Avg Deal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {revenueByIndustryTop.map((row) => (
                        <TableRow key={row.industry}>
                          <TableCell className="font-medium">{row.industry}</TableCell>
                          <TableCell className="text-right">{row.companyCount}</TableCell>
                          <TableCell className="text-right">{formatTZS(row.totalValue, { compact: true })}</TableCell>
                          <TableCell className="text-right">{formatTZS(row.avgDealSize, { compact: true })}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Customer Acquisition Cost</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="Marketing expenses this month (TZS)"
                    value={expensesInput}
                    onChange={(e) => setExpensesInput(e.target.value)}
                  />
                  <Button size="sm" onClick={handleSaveExpenses} disabled={saveExpenses.isPending}>Calculate</Button>
                </div>
                <p className="text-sm text-muted-foreground">New clients this month: {cac?.newClients ?? 0}</p>
                <div>
                  <p className="text-xs text-muted-foreground">Cost per client</p>
                  <p className="text-2xl font-bold text-primary">{cac?.cac != null ? formatTZS(cac.cac) : "—"}</p>
                </div>
                {cac?.previousMonthCAC != null && cac?.cac != null && (
                  <TrendBadge current={cac.cac} previous={cac.previousMonthCAC} />
                )}
                <p className="text-xs text-muted-foreground">Connect to the Accounting module in a future phase for automatic expense tracking.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Marketing ROI</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Revenue generated</span>
                  <span className="font-medium">{formatTZS(roi?.revenueGenerated ?? 0, { compact: true })}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Marketing expenses</span>
                  <span className="font-medium">{roi?.marketingExpenses != null ? formatTZS(roi.marketingExpenses, { compact: true }) : "Not entered"}</span>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Return on investment</p>
                  <p className={`text-2xl font-bold ${roi?.roiPercent != null && roi.roiPercent < 0 ? "text-destructive" : "text-primary"}`}>
                    {roi?.roiPercent != null ? `${roi.roiPercent > 0 ? "+" : ""}${roi.roiPercent}%` : "—"}
                  </p>
                </div>
                {roi?.paybackMonths != null && (
                  <p className="text-xs text-muted-foreground">Payback period: ~{roi.paybackMonths} months</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Competitor Intelligence</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {!competitors || competitors.length === 0 ? (
                <p className="text-sm text-muted-foreground">No competitor data recorded yet. It populates as visits record &quot;current caterer&quot;.</p>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Competitor</TableHead>
                        <TableHead className="text-right">Clients</TableHead>
                        <TableHead className="text-right">Est. Value at Stake</TableHead>
                        <TableHead className="text-right">Avg Lead Score</TableHead>
                        <TableHead>Industries</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {competitors.map((c) => (
                        <TableRow key={c.name}>
                          <TableCell className="font-medium">{c.name}</TableCell>
                          <TableCell className="text-right">{c.companyCount}</TableCell>
                          <TableCell className="text-right">{formatTZS(c.totalEstimatedValue, { compact: true })}</TableCell>
                          <TableCell className="text-right">{c.avgLeadScore}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{c.industries.join(", ") || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <div className="rounded-md border p-3">
                    {insightUnavailable ? (
                      <p className="text-sm text-muted-foreground">AI competitive analysis is currently unavailable.</p>
                    ) : competitorInsight ? (
                      <p className="text-sm italic text-muted-foreground">{competitorInsight}</p>
                    ) : (
                      <Button size="sm" variant="outline" disabled={generateInsight.isPending} onClick={handleGenerateInsight}>
                        {generateInsight.isPending ? <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
                        Generate competitive analysis ✨
                      </Button>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
