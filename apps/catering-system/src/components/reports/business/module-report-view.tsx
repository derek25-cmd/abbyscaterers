'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Sparkles, FileDown, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ModuleReportData, AiInsights, ReportKpi } from '@/lib/reports/types';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

function fmtKpi(k: ReportKpi): string {
  if (k.format === 'currency') return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS', maximumFractionDigits: 0 }).format(k.value).replace('TZS', 'TZS ');
  if (k.format === 'percent') return `${k.value.toFixed(1)}%`;
  return k.value.toLocaleString();
}

interface ModuleReportViewProps {
  data: ModuleReportData;
  periodLabel: string;
  insights: AiInsights | null;
  insightsLoading: boolean;
  insightsError: string | null;
  onGenerateInsights: () => void;
  onExportPdf: () => void;
}

export function ModuleReportView({ data, periodLabel, insights, insightsLoading, insightsError, onGenerateInsights, onExportPdf }: ModuleReportViewProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
        <div>
          <h2 className="text-lg font-bold">{data.moduleLabel}</h2>
          <p className="text-sm text-muted-foreground">{periodLabel}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onExportPdf}>
          <FileDown className="mr-2 h-4 w-4" /> Export PDF
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
        {data.kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">{k.label}</p>
              <p className="text-xl font-bold">{fmtKpi(k)}</p>
              {typeof k.deltaPct === 'number' && (
                <Badge variant="outline" className={cn('mt-1 text-xs', k.deltaPct >= 0 ? 'border-emerald-500 text-emerald-600' : 'border-rose-500 text-rose-600')}>
                  {k.deltaPct >= 0 ? '+' : ''}{k.deltaPct.toFixed(1)}% vs previous period
                </Badge>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {data.charts.length > 0 && (
        <div className="grid md:grid-cols-2 gap-4">
          {data.charts.map((chart) => (
            <Card key={chart.title}>
              <CardHeader><CardTitle className="text-sm">{chart.title}</CardTitle></CardHeader>
              <CardContent className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  {chart.type === 'pie' ? (
                    <PieChart>
                      <Pie data={chart.data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}>
                        {chart.data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  ) : (
                    <BarChart data={chart.data} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                      <XAxis type="number" stroke="#888" fontSize={10} />
                      <YAxis type="category" dataKey="name" stroke="#888" fontSize={10} width={110} tickFormatter={(v: string) => (v.length > 16 ? v.slice(0, 16) + '…' : v)} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {data.tables.map((t) => (
        <Card key={t.title}>
          <CardHeader><CardTitle className="text-sm">{t.title}</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow>{t.columns.map((c) => <TableHead key={c}>{c}</TableHead>)}</TableRow></TableHeader>
              <TableBody>
                {t.rows.length > 0 ? t.rows.map((row, i) => (
                  <TableRow key={i}>{row.map((cell, j) => <TableCell key={j} className={j > 0 ? 'text-right' : ''}>{typeof cell === 'number' ? cell.toLocaleString() : cell}</TableCell>)}</TableRow>
                )) : (
                  <TableRow><TableCell colSpan={t.columns.length} className="text-center text-muted-foreground">No data in this period.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}

      <Card className="border-primary/30">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> AI Insights</CardTitle>
          <Button variant="ghost" size="sm" onClick={onGenerateInsights} disabled={insightsLoading}>
            {insightsLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            <span className="ml-2">{insights ? 'Regenerate' : 'Generate'}</span>
          </Button>
        </CardHeader>
        <CardContent>
          {insightsLoading && <p className="text-sm text-muted-foreground">Analysing this period with Claude…</p>}
          {!insightsLoading && insightsError && <p className="text-sm text-rose-600">{insightsError}</p>}
          {!insightsLoading && !insightsError && !insights && <p className="text-sm text-muted-foreground">Click &quot;Generate&quot; for an AI-written summary and recommendations for this report.</p>}
          {!insightsLoading && insights && (
            <div className="space-y-3">
              <p className="text-sm">{insights.narrative}</p>
              {insights.bullets.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Key Observations</p>
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
