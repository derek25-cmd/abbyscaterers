"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, FileSpreadsheet, FileText, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useMonthlyReport } from "@/features/marketing/hooks/useMarketingQuery";
import { getStageMeta } from "@/features/marketing/utils/pipeline";
import { formatTZS, formatTrend } from "@/features/marketing/utils/format";
import { exportReportExcel, exportReportPdf } from "@/features/marketing/utils/report-export";

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

  return (
    <div className="space-y-6">
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
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}
