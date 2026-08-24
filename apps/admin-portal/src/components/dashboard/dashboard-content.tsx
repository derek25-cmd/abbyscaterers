'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, formatDistanceToNow, startOfMonth, endOfMonth, subMonths, addDays } from 'date-fns';
import { useSupabaseClient } from '@/lib/supabase-client';
import { computeInvoiceGrandTotal, type InvoiceTotalFields } from '@/lib/invoice-math';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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

export function DashboardContent() {
  const supabase = useSupabaseClient();

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

  const outstanding = useMemo(() => {
    const rows = (invoicesQuery.data ?? []).filter((i) => i.status === 'outstanding');
    return { count: rows.length, total: rows.reduce((sum, i) => sum + computeInvoiceGrandTotal(i), 0) };
  }, [invoicesQuery.data]);

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
      const total = computeInvoiceGrandTotal(inv);
      if (d >= thisStart && d <= thisEnd) thisMonth += total;
      else if (d >= lastStart && d <= lastEnd) prevMonth += total;
    }
    return { thisMonth, prevMonth };
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
      <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>

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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upcoming Events (next 7 days)</CardTitle>
          </CardHeader>
          <CardContent>
            {ordersQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : upcomingEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events in the next 7 days.</p>
            ) : (
              <ul className="text-sm space-y-2">
                {upcomingEvents.map((o) => (
                  <li key={o.id} className="flex justify-between">
                    <span>{o.name}</span>
                    <span className="text-muted-foreground">
                      {o.start_date} – {o.end_date}
                    </span>
                  </li>
                ))}
              </ul>
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
            ) : (
              <ul className="text-sm space-y-2 max-h-80 overflow-y-auto">
                {activity.map((a) => (
                  <li key={a.id}>
                    <Link href={a.href} className="hover:underline">
                      {a.label}
                    </Link>
                    <span className="block text-xs text-muted-foreground">
                      {new Date(a.timestamp).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
