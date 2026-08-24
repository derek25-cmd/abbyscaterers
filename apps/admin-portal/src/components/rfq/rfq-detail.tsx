'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { RfqStatusHistoryEntry, PaxPerDayEntry, MealTypePerDayEntry } from '@abbyscaterers/types';
import { useSupabaseClient } from '@/lib/supabase-client';
import { LinkProformaForm } from './link-proforma-form';
import { RequestInvoiceButton, type InvoiceRequestSummary } from './request-invoice-button';

interface LinkedProforma {
  id: string;
  linkedAt: string;
  clientId: string | null;
  invoiceDate: string;
  itemsSubtotal: number;
}

// select('*') returns the real (snake_case, unquoted) column names, not
// the camelCase Rfq type from @abbyscaterers/types — casting straight to
// Rfq silently broke every multi-word field (clientNameFreetext,
// targetEventDate, etc. were always undefined). This mirrors what the
// columns are actually called.
interface RfqRecord {
  id: string;
  title: string;
  description: string | null;
  status: string;
  client_id: string | null;
  client_name_freetext: string | null;
  clients: { companyName: string } | null;
  service_start_date: string | null;
  service_end_date: string | null;
  target_event_date: string | null;
  proforma_required_by: string | null;
  same_pax_all_dates: boolean;
  pax_per_day: PaxPerDayEntry[] | null;
  same_meal_type_all_dates: boolean;
  meal_type_per_day: MealTypePerDayEntry[] | null;
  rate_per_plate: number | null;
  vat_type: 'inclusive' | 'exclusive' | null;
  location: string | null;
  region: string | null;
  branch: string | null;
}

export function RfqDetail({ rfqId }: { rfqId: string }) {
  const supabase = useSupabaseClient();
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const rfqQuery = useQuery({
    queryKey: ['rfq', rfqId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rfqs')
        .select('*, clients(companyName)')
        .eq('id', rfqId)
        .single();
      if (error) throw error;
      return data as RfqRecord;
    },
  });

  const historyQuery = useQuery({
    queryKey: ['rfq-history', rfqId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rfq_status_history')
        .select('*')
        .eq('rfq_id', rfqId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as RfqStatusHistoryEntry[];
    },
  });

  const linksQuery = useQuery({
    queryKey: ['rfq-links', rfqId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rfq_proforma_links')
        .select('id, linked_at, proforma_invoices(id, "clientId", "invoiceDate", items)')
        .eq('rfq_id', rfqId)
        .order('linked_at', { ascending: false });
      if (error) throw error;
      // proforma_invoices is embedded via the FK — flatten it into a simple, display-only shape.
      // itemsSubtotal is a raw sum of stored line-item totals for at-a-glance context only —
      // NOT a recomputation of VAT/tax; the authoritative figures live in the proforma itself.
      return (data ?? []).map((row: any) => ({
        id: row.proforma_invoices.id,
        linkedAt: row.linked_at,
        clientId: row.proforma_invoices.clientId,
        invoiceDate: row.proforma_invoices.invoiceDate,
        itemsSubtotal: (row.proforma_invoices.items ?? []).reduce(
          (sum: number, item: { total?: number }) => sum + (item.total ?? 0),
          0
        ),
      })) as LinkedProforma[];
    },
  });

  const invoiceRequestsQuery = useQuery({
    queryKey: ['rfq-invoice-requests', rfqId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('portal_invoice_requests')
        .select('proforma_id, status, invoice_id, rejection_reason, requested_at')
        .eq('rfq_id', rfqId)
        .order('requested_at', { ascending: false });
      if (error) throw error;
      // Keep only the most recent request per proforma — a rejected
      // request can be followed by a fresh one, and the newest is what
      // matters for what the button should show.
      const latestByProforma = new Map<string, InvoiceRequestSummary>();
      for (const row of data ?? []) {
        if (!latestByProforma.has(row.proforma_id)) {
          latestByProforma.set(row.proforma_id, {
            status: row.status,
            invoiceId: row.invoice_id,
            rejectionReason: row.rejection_reason,
          });
        }
      }
      return latestByProforma;
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`rfq-${rfqId}-changes`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rfqs', filter: `id=eq.${rfqId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['rfq', rfqId] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rfq_status_history', filter: `rfq_id=eq.${rfqId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['rfq-history', rfqId] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rfq_proforma_links', filter: `rfq_id=eq.${rfqId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['rfq-links', rfqId] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'portal_invoice_requests', filter: `rfq_id=eq.${rfqId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['rfq-invoice-requests', rfqId] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, queryClient, rfqId]);

  if (rfqQuery.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (rfqQuery.error) {
    return <p className="text-sm text-destructive">Failed to load RFQ: {(rfqQuery.error as Error).message}</p>;
  }
  const rfq = rfqQuery.data!;

  const submitToCateringSystem = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const { error } = await supabase.rpc('submit_rfq', { p_rfq_id: rfqId });
      if (error) throw error;
      // No manual refetch: the Realtime subscription below picks up both
      // the status flip and the new rfq_status_history row.
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit RFQ');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{rfq.title}</h1>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{rfq.status}</span>
          {rfq.status === 'draft' && (
            <button
              type="button"
              onClick={submitToCateringSystem}
              disabled={submitting}
              className="rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? 'Submitting…' : 'Submit to Catering System'}
            </button>
          )}
        </div>
        <p className="text-sm text-muted-foreground font-mono">{rfq.id}</p>
        {submitError && <p className="text-sm text-destructive mt-1">{submitError}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-card p-4 space-y-2">
          <h2 className="font-medium">Details</h2>
          <dl className="text-sm space-y-1">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Client</dt>
              <dd>{rfq.clients?.companyName ?? rfq.client_name_freetext ?? rfq.client_id ?? '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Service period</dt>
              <dd>
                {rfq.service_start_date && rfq.service_end_date
                  ? `${rfq.service_start_date} – ${rfq.service_end_date}`
                  : rfq.target_event_date ?? '—'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Proforma required by</dt>
              <dd>{rfq.proforma_required_by ?? '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Pax</dt>
              <dd>
                {rfq.pax_per_day && rfq.pax_per_day.length > 0
                  ? rfq.same_pax_all_dates
                    ? `${rfq.pax_per_day[0].pax} / day (all dates)`
                    : `${rfq.pax_per_day.reduce((s, p) => s + p.pax, 0)} total, varies by day`
                  : '—'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Meal type</dt>
              <dd>
                {rfq.meal_type_per_day && rfq.meal_type_per_day.length > 0
                  ? rfq.same_meal_type_all_dates
                    ? rfq.meal_type_per_day[0].mealType
                    : 'Varies by day'
                  : '—'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Rate per plate</dt>
              <dd>{rfq.rate_per_plate != null ? `TZS ${rfq.rate_per_plate.toLocaleString()}` : '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">VAT</dt>
              <dd className="capitalize">{rfq.vat_type ?? '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Location</dt>
              <dd>{rfq.location ?? '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Region</dt>
              <dd>{rfq.region ?? '—'}</dd>
            </div>
          </dl>
          {rfq.description && <p className="text-sm pt-2 border-t border-border">{rfq.description}</p>}
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="font-medium mb-2">Status history</h2>
          {historyQuery.data && historyQuery.data.length > 0 ? (
            <ul className="text-sm space-y-1">
              {historyQuery.data.map((h) => (
                <li key={h.id} className="text-muted-foreground">
                  {h.fromStatus ?? '—'} → <span className="text-foreground">{h.toStatus}</span>
                  {h.note ? ` — ${h.note}` : ''}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No status changes yet.</p>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 space-y-4">
        <h2 className="font-medium">Linked proformas</h2>
        {linksQuery.data && linksQuery.data.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-muted-foreground">
              <tr>
                <th className="py-2 font-medium">Proforma ID</th>
                <th className="py-2 font-medium">Client</th>
                <th className="py-2 font-medium">Invoice date</th>
                <th className="py-2 font-medium">Items subtotal</th>
                <th className="py-2 font-medium">Linked</th>
                <th className="py-2 font-medium">Invoice</th>
              </tr>
            </thead>
            <tbody>
              {linksQuery.data.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0">
                  <td className="py-2 font-mono text-xs">
                    <Link href={`/proformas/${p.id}`} className="text-primary hover:underline">
                      {p.id}
                    </Link>
                  </td>
                  <td className="py-2">{p.clientId ?? '—'}</td>
                  <td className="py-2">{p.invoiceDate}</td>
                  <td className="py-2">TZS {p.itemsSubtotal.toLocaleString()}</td>
                  <td className="py-2 text-muted-foreground">{new Date(p.linkedAt).toLocaleDateString()}</td>
                  <td className="py-2">
                    <RequestInvoiceButton
                      rfqId={rfqId}
                      proformaId={p.id}
                      latestRequest={invoiceRequestsQuery.data?.get(p.id) ?? null}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-muted-foreground">No proforma linked yet.</p>
        )}

        <LinkProformaForm rfqId={rfqId} />
      </div>
    </div>
  );
}
