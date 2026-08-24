'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Sparkles, FileDown, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ModuleReportData, AiInsights, ReportKpi } from '@/lib/reports/types';

function fmtKpi(k: ReportKpi): string {
  if (k.format === 'currency') return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS', maximumFractionDigits: 0 }).format(k.value).replace('TZS', 'TZS ');
  if (k.format === 'percent') return `${k.value.toFixed(1)}%`;
  return k.value.toLocaleString();
}

function comparisonDelta(a: ReportKpi, b: ReportKpi | undefined): number | undefined {
  if (!b || b.value === 0) return undefined;
  return ((a.value - b.value) / Math.abs(b.value)) * 100;
}

interface ComparisonViewProps {
  moduleLabel: string;
  periodALabel: string;
  periodBLabel: string;
  dataA: ModuleReportData;
  dataB: ModuleReportData;
  insights: AiInsights | null;
  insightsLoading: boolean;
  insightsError: string | null;
  onGenerateInsights: () => void;
  onExportPdf: () => void;
}

/** Side-by-side view of the same module's KPIs across two different
 * reporting periods — kpisA/kpisB come from the same aggregator function,
 * so they line up index-wise (same labels, same order). */
export function ComparisonView({ moduleLabel, periodALabel, periodBLabel, dataA, dataB, insights, insightsLoading, insightsError, onGenerateInsights, onExportPdf }: ComparisonViewProps) {
  const currencyChartData = dataA.kpis
    .map((a, i) => ({ a, b: dataB.kpis[i] }))
    .filter(({ a, b }) => a.format === 'currency' && b)
    .map(({ a, b }) => ({ name: a.label, [periodALabel]: a.value, [periodBLabel]: b!.value }));

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
        <div>
          <h2 className="text-lg font-bold">{moduleLabel} — Comparison</h2>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{periodALabel}</span> vs <span className="font-medium text-foreground">{periodBLabel}</span>
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onExportPdf}>
          <FileDown className="mr-2 h-4 w-4" /> Export PDF
        </Button>
      </div>

      <Card>
        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Metric</TableHead>
                <TableHead className="text-right">{periodALabel}</TableHead>
                <TableHead className="text-right">{periodBLabel}</TableHead>
                <TableHead className="text-right">Δ%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dataA.kpis.map((a, i) => {
                const b = dataB.kpis[i];
                const delta = comparisonDelta(a, b);
                return (
                  <TableRow key={a.label}>
                    <TableCell className="font-medium">{a.label}</TableCell>
                    <TableCell className="text-right">{fmtKpi(a)}</TableCell>
                    <TableCell className="text-right">{b ? fmtKpi(b) : '—'}</TableCell>
                    <TableCell className="text-right">
                      {typeof delta === 'number' ? (
                        <Badge variant="outline" className={cn('text-xs', delta >= 0 ? 'border-emerald-500 text-emerald-600' : 'border-rose-500 text-rose-600')}>
                          {delta >= 0 ? '+' : ''}{delta.toFixed(1)}%
                        </Badge>
                      ) : '—'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {currencyChartData.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Financial Metrics — Side by Side</CardTitle></CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={currencyChartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                <XAxis type="number" stroke="#888" fontSize={10} tickFormatter={(v: number) => `${(v / 1_000_000).toFixed(1)}M`} />
                <YAxis type="category" dataKey="name" stroke="#888" fontSize={10} width={140} tickFormatter={(v: string) => (v.length > 18 ? v.slice(0, 18) + '…' : v)} />
                <Tooltip />
                <Legend />
                <Bar dataKey={periodALabel} fill="#3b82f6" radius={[0, 4, 4, 0]} />
                <Bar dataKey={periodBLabel} fill="#f59e0b" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card className="border-primary/30">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> AI Comparison Insights</CardTitle>
          <Button variant="ghost" size="sm" onClick={onGenerateInsights} disabled={insightsLoading}>
            {insightsLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            <span className="ml-2">{insights ? 'Regenerate' : 'Generate'}</span>
          </Button>
        </CardHeader>
        <CardContent>
          {insightsLoading && <p className="text-sm text-muted-foreground">Comparing these periods with Claude…</p>}
          {!insightsLoading && insightsError && <p className="text-sm text-rose-600">{insightsError}</p>}
          {!insightsLoading && !insightsError && !insights && <p className="text-sm text-muted-foreground">Click &quot;Generate&quot; for an AI-written comparison of these two periods.</p>}
          {!insightsLoading && insights && (
            <div className="space-y-3">
              <p className="text-sm">{insights.narrative}</p>
              {insights.bullets.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Key Changes</p>
                  <ul className="list-disc list-inside text-sm space-y-0.5">{insights.bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>
                </div>
              )}
              {insights.recommendations.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Recommendations</p>
                  <ul className="list-disc list-inside text-sm space-y-0.5">{insights.recommendations.map((r, i) => <li key={i}>{r}</li>)}</ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
