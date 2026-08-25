'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { format, formatDistanceToNow, startOfMonth, endOfMonth, subMonths, addDays } from 'date-fns';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import { useSupabaseClient } from '@/lib/supabase-client';
import { useIsMobile } from '@/hooks/use-mobile';
import { computeInvoiceGrandTotal, type InvoiceTotalFields } from '@/lib/invoice-math';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { SkeletonCards, SkeletonTableRows } from '@/components/pwa/skeleton-list';

interface InvoiceRow extends InvoiceTotalFields {
  id: string;
  invoiceDate: string;
  status: 'outstanding' | 'paid' | 'partially paid';
}

interface OrderRow {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
}

interface ActivityItem {
  id: string;
  kind: 'rfq' | 'invoice_request' | 'costing_request';
  label: string;
  timestamp: string;
  href: string;
}

const fmtMoney = (n: number) => `TZS ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

const RFQ_STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  in_review: 'In Review',
  proforma_created: 'Proforma Created',
  approved: 'Approved',
  closed: 'Closed',
  cancelled: 'Cancelled',
};

const PROFORMA_STATUS_LABEL: Record<string, string> = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' };
const INVOICE_STATUS_LABEL: Record<string, string> = { outstanding: 'Outstanding', paid: 'Paid', 'partially paid': 'Partially Paid' };

const countChartConfig: ChartConfig = { count: { label: 'Count', color: 'hsl(var(--primary))' } };
const revenueChartConfig: ChartConfig = { revenue: { label: 'Revenue (TZS)', color: 'hsl(var(--primary))' } };

export function DashboardContent() {
  const supabase = useSupabaseClient();
  const router = useRouter();
  const isMobile = useIsMobile();
  const [refreshing, setRefreshing] = useState(false);

  const rfqsQuery = useQuery({
    queryKey: ['dashboard-rfqs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rfqs')
        .select('id, status, created_at')
        .in('status', ['submitted', 'in_review'])
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as { id: string; status: string; created_at: string }[];
    },
  });

  // All-status RFQ counts, separate from the pending-only query above, just
  // for the status-breakdown chart.
  const rfqAllStatusQuery = useQuery({
    queryKey: ['dashboard-rfqs-all-status'],
    queryFn: async () => {
      const { data, error } = await supabase.from('rfqs').select('status');
      if (error) throw error;
      return data as { status: string }[];
    },
  });

  const proformasQuery = useQuery({
    queryKey: ['dashboard-proformas'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('proforma_invoices')
        .select('id', { count: 'exact', head: true })
        .eq('reviewStatus', 'pending');
      if (error) throw error;
      return count ?? 0;
    },
  });

  const proformaAllStatusQuery = useQuery({
    queryKey: ['dashboard-proformas-all-status'],
    queryFn: async () => {
      const { data, error } = await supabase.from('proforma_invoices').select('"reviewStatus"');
      if (error) throw error;
      return data as { reviewStatus: string }[];
    },
  });

  const invoicesQuery = useQuery({
    queryKey: ['dashboard-invoices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, "invoiceDate", status, items, "serviceCharge", "transportCosts", "numberOfDays", "multiplyByDays", "vatType"');
      if (error) throw error;
      return data as unknown as InvoiceRow[];
    },
  });

  // Same admin-configured rate Tax Settings and invoice-detail.tsx use —
  // computeInvoiceGrandTotal defaults to 18% otherwise, which goes stale
  // the moment the admin changes the rate.
  const vatRateQuery = useQuery({
    queryKey: ['dashboard-vat-rate'],
    queryFn: async () => {
      const { data, error } = await supabase.from('invoice_tax_rates').select('tax_type, rate').eq('tax_type', 'vat').maybeSingle();
      if (error) throw error;
      return data?.rate ?? 18;
    },
  });
  const vatRate = vatRateQuery.data ?? 18;

  const ordersQuery = useQuery({
    queryKey: ['dashboard-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('id, name, start_date, end_date, status')
        .neq('status', 'cancelled');
      if (error) throw error;
      return data as OrderRow[];
    },
  });

  const rfqHistoryQuery = useQuery({
    queryKey: ['dashboard-rfq-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rfq_status_history')
        .select('id, rfq_id, from_status, to_status, note, created_at')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as { id: string; rfq_id: string; from_status: string | null; to_status: string; note: string | null; created_at: string }[];
    },
  });

  const invoiceRequestsQuery = useQuery({
    queryKey: ['dashboard-invoice-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('portal_invoice_requests')
        .select('id, proforma_id, status, requested_at')
        .order('requested_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as { id: string; proforma_id: string; status: string; requested_at: string }[];
    },
  });

  const costingRequestsQuery = useQuery({
    queryKey: ['dashboard-costing-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('portal_costing_requests')
        .select('id, rfq_id, status, requested_at')
        .order('requested_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as { id: string; rfq_id: string; status: string; requested_at: string }[];
    },
  });

  const allQueries = [
    rfqsQuery,
    rfqAllStatusQuery,
    proformasQuery,
    proformaAllStatusQuery,
    invoicesQuery,
    vatRateQuery,
    ordersQuery,
    rfqHistoryQuery,
    invoiceRequestsQuery,
    costingRequestsQuery,
  ];

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all(allQueries.map((q) => q.refetch()));
    } finally {
      setRefreshing(false);
    }
  };

  const outstanding = useMemo(() => {
    const rows = (invoicesQuery.data ?? []).filter((i) => i.status === 'outstanding');
    return { count: rows.length, total: rows.reduce((sum, i) => sum + computeInvoiceGrandTotal(i, vatRate), 0) };
  }, [invoicesQuery.data, vatRate]);

  const revenue = useMemo(() => {
    const now = new Date();
    const thisStart = startOfMonth(now);
    const thisEnd = endOfMonth(now);
    const lastMonth = subMonths(now, 1);
    const lastStart = startOfMonth(lastMonth);
    const lastEnd = endOfMonth(lastMonth);
    let thisMonth = 0;
    let prevMonth = 0;
    for (const inv of invoicesQuery.data ?? []) {
      const d = new Date(inv.invoiceDate);
      const total = computeInvoiceGrandTotal(inv, vatRate);
      if (d >= thisStart && d <= thisEnd) thisMonth += total;
      else if (d >= lastStart && d <= lastEnd) prevMonth += total;
    }
    return { thisMonth, prevMonth };
  }, [invoicesQuery.data, vatRate]);

  // Last 6 months of invoiced revenue, monthly buckets — same shape as
  // reports/revenue-trend/page.tsx's bucketing, inlined for this one extra
  // consumer rather than extracted into a shared lib.
  const revenueTrendData = useMemo(() => {
    const months = Array.from({ length: 6 }).map((_, i) => startOfMonth(subMonths(new Date(), 5 - i)));
    const buckets = months.map((m) => ({ key: format(m, 'yyyy-MM'), label: format(m, 'MMM'), revenue: 0 }));
    const byKey = new Map(buckets.map((b) => [b.key, b]));
    for (const inv of invoicesQuery.data ?? []) {
      const key = format(new Date(inv.invoiceDate), 'yyyy-MM');
      const bucket = byKey.get(key);
      if (bucket) bucket.revenue += computeInvoiceGrandTotal(inv, vatRate);
    }
    return buckets;
  }, [invoicesQuery.data, vatRate]);

  const rfqStatusData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rfqAllStatusQuery.data ?? []) counts.set(r.status, (counts.get(r.status) ?? 0) + 1);
    return Array.from(counts.entries()).map(([status, count]) => ({ status: RFQ_STATUS_LABEL[status] ?? status, count }));
  }, [rfqAllStatusQuery.data]);

  const proformaStatusData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of proformaAllStatusQuery.data ?? []) counts.set(p.reviewStatus, (counts.get(p.reviewStatus) ?? 0) + 1);
    return Array.from(counts.entries()).map(([status, count]) => ({ status: PROFORMA_STATUS_LABEL[status] ?? status, count }));
  }, [proformaAllStatusQuery.data]);

  const invoiceStatusData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const inv of invoicesQuery.data ?? []) counts.set(inv.status, (counts.get(inv.status) ?? 0) + 1);
    return Array.from(counts.entries()).map(([status, count]) => ({ status: INVOICE_STATUS_LABEL[status] ?? status, count }));
  }, [invoicesQuery.data]);

  const upcomingEvents = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const in7 = format(addDays(new Date(), 7), 'yyyy-MM-dd');
    return (ordersQuery.data ?? [])
      .filter((o) => o.start_date && o.end_date && o.start_date <= in7 && o.end_date >= today)
      .sort((a, b) => (a.start_date ?? '').localeCompare(b.start_date ?? ''));
  }, [ordersQuery.data]);

  const oldestRfqAge = rfqsQuery.data?.[0]
    ? formatDistanceToNow(new Date(rfqsQuery.data[0].created_at), { addSuffix: false })
    : null;

  const activity: ActivityItem[] = useMemo(() => {
    const items: ActivityItem[] = [];
    for (const h of rfqHistoryQuery.data ?? []) {
      items.push({
        id: `rfq-${h.id}`,
        kind: 'rfq',
        label: `RFQ ${h.rfq_id}: ${h.from_status ?? '—'} → ${h.to_status}${h.note ? ` — ${h.note}` : ''}`,
        timestamp: h.created_at,
        href: `/rfqs/${h.rfq_id}`,
      });
    }
    for (const r of invoiceRequestsQuery.data ?? []) {
      items.push({
        id: `invreq-${r.id}`,
        kind: 'invoice_request',
        label: `Invoice request for proforma ${r.proforma_id}: ${r.status}`,
        timestamp: r.requested_at,
        href: `/proformas/${r.proforma_id}`,
      });
    }
    for (const c of costingRequestsQuery.data ?? []) {
      items.push({
        id: `costreq-${c.id}`,
        kind: 'costing_request',
        label: `Costing request for RFQ ${c.rfq_id}: ${c.status}`,
        timestamp: c.requested_at,
        href: `/rfqs/${c.rfq_id}`,
      });
    }
    return items.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 20);
  }, [rfqHistoryQuery.data, invoiceRequestsQuery.data, costingRequestsQuery.data]);

  const kpis = [
    {
      label: 'Pending RFQs',
      value: rfqsQuery.data ? String(rfqsQuery.data.length) : '—',
      sub: oldestRfqAge ? `Oldest: ${oldestRfqAge}` : undefined,
      href: '/rfqs',
    },
    {
      label: 'Pending Proforma Approvals',
      value: proformasQuery.data !== undefined ? String(proformasQuery.data) : '—',
      href: undefined,
    },
    {
      label: 'Outstanding Invoices',
      value: invoicesQuery.data ? String(outstanding.count) : '—',
      sub: invoicesQuery.data ? fmtMoney(outstanding.total) : undefined,
      href: '/invoices',
    },
    {
      label: 'Revenue this month',
      value: invoicesQuery.data ? fmtMoney(revenue.thisMonth) : '—',
      sub: invoicesQuery.data ? `Last month: ${fmtMoney(revenue.prevMonth)}` : undefined,
      href: '/invoices',
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="icon" onClick={() => router.back()} aria-label="Back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const content = (
            <Card className="h-full transition-shadow hover:shadow-elegant">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
                <p className="text-2xl font-semibold mt-1">{kpi.value}</p>
                {kpi.sub && <p className="text-xs text-muted-foreground mt-1">{kpi.sub}</p>}
              </CardContent>
            </Card>
          );
          return kpi.href ? (
            <Link key={kpi.label} href={kpi.href}>
              {content}
            </Link>
          ) : (
            <div key={kpi.label}>{content}</div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenue Trend (last 6 months)</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={revenueChartConfig}>
              <LineChart data={revenueTrendData} margin={{ left: 12, right: 12 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} width={40} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line type="monotone" dataKey="revenue" stroke="var(--color-revenue)" strokeWidth={2} dot={false} />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">RFQ Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={countChartConfig}>
              <BarChart data={rfqStatusData} layout="vertical" margin={{ left: 12, right: 12 }}>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis dataKey="status" type="category" tickLine={false} axisLine={false} width={100} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Proforma Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={countChartConfig}>
              <BarChart data={proformaStatusData} layout="vertical" margin={{ left: 12, right: 12 }}>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis dataKey="status" type="category" tickLine={false} axisLine={false} width={100} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invoice Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={countChartConfig}>
              <BarChart data={invoiceStatusData} layout="vertical" margin={{ left: 12, right: 12 }}>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis dataKey="status" type="category" tickLine={false} axisLine={false} width={100} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upcoming Events (next 7 days)</CardTitle>
          </CardHeader>
          <CardContent>
            {ordersQuery.isLoading ? (
              isMobile ? <SkeletonCards count={3} /> : (
                <Table><TableBody><SkeletonTableRows count={3} columns={3} /></TableBody></Table>
              )
            ) : upcomingEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events in the next 7 days.</p>
            ) : isMobile ? (
              <div className="space-y-2">
                {upcomingEvents.map((o) => (
                  <Card key={o.id}>
                    <CardContent className="p-3">
                      <p className="text-sm font-medium text-foreground">{o.name}</p>
                      <p className="text-xs text-muted-foreground">{o.start_date} – {o.end_date}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {upcomingEvents.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-medium">{o.name}</TableCell>
                      <TableCell className="text-muted-foreground">{o.start_date} – {o.end_date}</TableCell>
                      <TableCell className="text-muted-foreground capitalize">{o.status ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {activity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent activity.</p>
            ) : isMobile ? (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {activity.map((a) => (
                  <Card key={a.id}>
                    <CardContent className="p-3">
                      <Link href={a.href} className="text-sm hover:underline">
                        {a.label}
                      </Link>
                      <p className="text-xs text-muted-foreground mt-0.5">{new Date(a.timestamp).toLocaleString()}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activity.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="whitespace-nowrap text-muted-foreground">{new Date(a.timestamp).toLocaleString()}</TableCell>
                        <TableCell className="capitalize">{a.kind.replace(/_/g, ' ')}</TableCell>
                        <TableCell>
                          <Link href={a.href} className="hover:underline">
                            {a.label}
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
