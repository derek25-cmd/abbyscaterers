'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useStaffRole } from '@/hooks/use-staff-role';
import {
  EVENT_ISSUE_TYPES,
  describeSuggestion,
  getEventFixSuggestions,
  getEventIssues,
  type EventFixSuggestion,
  type EventIssue,
} from '@/services/dataQualityService';

const ALL = 'all';
const NO_DATE = 'no-date';
const PAGE_SIZE = 200;

const monthOf = (r: EventIssue) => (r.event_date ? r.event_date.slice(0, 7) : NO_DATE);

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function DataQualityPageComponent() {
  const { canManageSettings, isLoading: roleLoading } = useStaffRole();
  const { toast } = useToast();
  const [rows, setRows] = useState<EventIssue[]>([]);
  const [suggestions, setSuggestions] = useState<Record<string, EventFixSuggestion>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [issueFilter, setIssueFilter] = useState<string>(ALL);
  const [monthFilter, setMonthFilter] = useState<string>(ALL);
  const [shown, setShown] = useState(PAGE_SIZE);

  useEffect(() => {
    if (roleLoading || !canManageSettings) return;
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const issues = await getEventIssues();
        if (!active) return;
        setRows(issues);
        const s = await getEventFixSuggestions(issues);
        if (active) setSuggestions(s);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Could not load the event checks.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [roleLoading, canManageSettings]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const t of EVENT_ISSUE_TYPES) c[t] = 0;
    for (const r of rows) for (const i of r.issues) c[i] = (c[i] || 0) + 1;
    return c;
  }, [rows]);

  const months = useMemo(
    () => Array.from(new Set(rows.map(monthOf))).sort((a, b) => (a === NO_DATE ? -1 : b === NO_DATE ? 1 : b.localeCompare(a))),
    [rows]
  );

  const filtered = useMemo(
    () => rows.filter(r =>
      (issueFilter === ALL || r.issues.includes(issueFilter)) &&
      (monthFilter === ALL || monthOf(r) === monthFilter)),
    [rows, issueFilter, monthFilter]
  );

  useEffect(() => { setShown(PAGE_SIZE); }, [issueFilter, monthFilter]);

  const exportCsv = () => {
    // IDs, dates, issues and suggested values only: no client names or contacts.
    const header = ['event_id', 'order_id', 'client_id', 'order_status', 'event_date', 'issues', 'suggested_pax', 'suggested_unit_price', 'suggested_from', 'suggested_fix'];
    const lines = [header.join(',')];
    for (const r of filtered) {
      const s = r.event_id ? suggestions[r.event_id] : undefined;
      lines.push([
        r.event_id, r.order_id, r.client_id, r.order_status, r.event_date, r.issues.join('; '),
        s?.pax, s?.unitPrice, s?.source ? `${s.source.kind} ${s.source.id}` : '', describeSuggestion(s),
      ].map(csvCell).join(','));
    }
    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `event_issues_${issueFilter === ALL ? 'all' : issueFilter.replace(/\W+/g, '_')}_${monthFilter}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: 'Export Successful', description: `${filtered.length} event(s) exported to CSV.` });
  };

  if (roleLoading) {
    return <main className="p-8"><Loader2 className="h-6 w-6 animate-spin" /></main>;
  }

  if (!canManageSettings) {
    return (
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <Card>
          <CardHeader>
            <CardTitle>Access restricted</CardTitle>
            <CardDescription>Only admins can view the data quality checks.</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-headline text-2xl font-bold">Data Quality — Events</h1>
          <p className="text-sm text-muted-foreground">
            Events that need fixing before they are used for reports and the ML datasets. Test and cancelled orders are left out.
          </p>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={loading || filtered.length === 0}>
          <Download className="mr-2 h-4 w-4" /> Export CSV
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {EVENT_ISSUE_TYPES.map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setIssueFilter(issueFilter === t ? ALL : t)}
            className="focus:outline-none"
          >
            <Badge variant={issueFilter === t ? 'default' : 'outline'} className="text-sm">
              {t}: {loading ? '…' : counts[t] ?? 0}
            </Badge>
          </button>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-end gap-4 space-y-0">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Issue</p>
            <Select value={issueFilter} onValueChange={setIssueFilter}>
              <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All issues</SelectItem>
                {EVENT_ISSUE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Month</p>
            <Select value={monthFilter} onValueChange={setMonthFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All months</SelectItem>
                {months.map(m => <SelectItem key={m} value={m}>{m === NO_DATE ? 'No date' : m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <p className="text-sm text-muted-foreground ml-auto">{loading ? 'Loading…' : `${filtered.length} event(s)`}</p>
        </CardHeader>
        <CardContent>
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : loading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No events with this issue.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Issues</TableHead>
                    <TableHead>Suggested fix</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.slice(0, shown).map(r => (
                    <TableRow key={`${r.order_id}-${r.event_id}`}>
                      <TableCell className="font-mono text-xs">{r.event_id || '—'}</TableCell>
                      <TableCell>
                        <Link href={`/orders/${encodeURIComponent(r.order_id)}/edit`} className="font-mono text-xs text-primary underline-offset-2 hover:underline">
                          {r.order_id}
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs">{r.event_date || 'no date'}</TableCell>
                      <TableCell className="text-xs">{r.order_status || '—'}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {r.issues.map(i => <Badge key={i} variant="secondary" className="text-[11px]">{i}</Badge>)}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[320px]">
                        {describeSuggestion(r.event_id ? suggestions[r.event_id] : undefined) || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filtered.length > shown && (
                <div className="flex justify-center pt-4">
                  <Button variant="outline" onClick={() => setShown(s => s + PAGE_SIZE)}>
                    Show more ({filtered.length - shown} left)
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
