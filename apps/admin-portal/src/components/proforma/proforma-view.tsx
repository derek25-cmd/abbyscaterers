'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/nextjs';
import { Printer } from 'lucide-react';
import { useSupabaseClient } from '@/lib/supabase-client';

interface ProformaItem {
  id: string;
  eventType: string;
  mealType: string;
  pax: number;
  unitPrice: number;
  total: number;
  date?: string;
  particularDescription?: string;
}

interface ProformaRecord {
  id: string;
  invoiceDate: string;
  clientId: string | null;
  clients: { companyName: string } | null;
  location: string;
  region: string | null;
  startDate: string;
  endDate: string;
  vatType: 'inclusive' | 'exclusive';
  serviceCharge: number;
  transportCosts: number;
  serviceDesc: string | null;
  items: ProformaItem[];
  isInvoiced: boolean | null;
  isVoided: boolean | null;
  voidedReason: string | null;
}

interface CommentRow {
  id: string;
  author_type: 'portal' | 'staff';
  body: string;
  created_at: string;
}

/**
 * A read/print view — NOT a re-implementation of catering-system's PDF
 * export (that's client-side jsPDF/html2canvas tightly coupled to its own
 * template components; porting or duplicating it here is a real
 * architecture decision that hasn't been made — see the plan notes on
 * document-engine reuse). "Export" here is the browser's own Print →
 * Save as PDF, driven by the @media print rules below, not a byte-
 * identical match to the existing system's branded template.
 */
export function ProformaView({ proformaId }: { proformaId: string }) {
  const supabase = useSupabaseClient();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const proformaQuery = useQuery({
    queryKey: ['proforma-view', proformaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proforma_invoices')
        .select(
          'id, "invoiceDate", "clientId", clients(companyName), location, region, "startDate", "endDate", "vatType", "serviceCharge", "transportCosts", "serviceDesc", items, "isInvoiced", "isVoided", "voidedReason"'
        )
        .eq('id', proformaId)
        .single();
      if (error) throw error;
      return data as unknown as ProformaRecord;
    },
  });

  const commentsQuery = useQuery({
    queryKey: ['proforma-comments', proformaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proforma_comments')
        .select('id, author_type, body, created_at')
        .eq('proforma_id', proformaId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as CommentRow[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`proforma-${proformaId}-comments`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'proforma_comments', filter: `proforma_id=eq.${proformaId}` },
        () => queryClient.invalidateQueries({ queryKey: ['proforma-comments', proformaId] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, queryClient, proformaId]);

  const submitComment = async () => {
    if (!comment.trim()) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('proforma_comments').insert({
        proforma_id: proformaId,
        author_type: 'portal',
        portal_author_id: user?.id ?? null,
        body: comment.trim(),
      });
      if (error) throw error;
      setComment('');
      queryClient.invalidateQueries({ queryKey: ['proforma-comments', proformaId] });
    } finally {
      setSubmitting(false);
    }
  };

  if (proformaQuery.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (proformaQuery.error) {
    return <p className="text-sm text-destructive">Failed to load proforma: {(proformaQuery.error as Error).message}</p>;
  }
  const p = proformaQuery.data!;
  const itemsTotal = (p.items ?? []).reduce((sum, item) => sum + (item.total ?? 0), 0);
  const grandTotal = itemsTotal + (p.serviceCharge ?? 0) + (p.transportCosts ?? 0);

  return (
    <div className="space-y-6">
      <style jsx global>{`
        @media print {
          nav, aside, header, .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="flex items-center justify-between no-print">
        <div>
          <h1 className="text-2xl font-semibold">Proforma {p.id}</h1>
          {p.isVoided && (
            <span className="inline-block mt-1 rounded-full bg-destructive/10 text-destructive px-2 py-0.5 text-xs">
              Uninvoiced{p.voidedReason ? ` — ${p.voidedReason}` : ''}
            </span>
          )}
          {p.isInvoiced && !p.isVoided && (
            <span className="inline-block mt-1 rounded-full bg-secondary px-2 py-0.5 text-xs">Invoiced</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted"
        >
          <Printer className="h-4 w-4" /> Print / Export PDF
        </button>
      </div>

      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Client</p>
            <p className="font-medium">{p.clients?.companyName ?? p.clientId ?? '—'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Date</p>
            <p className="font-medium">{p.invoiceDate}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Service period</p>
            <p className="font-medium">{p.startDate} – {p.endDate}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Location</p>
            <p className="font-medium">{p.location ?? '—'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Region</p>
            <p className="font-medium">{p.region ?? '—'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">VAT</p>
            <p className="font-medium capitalize">{p.vatType}</p>
          </div>
        </div>

        {p.serviceDesc && (
          <p className="text-sm border-t border-border pt-3">{p.serviceDesc}</p>
        )}

        <table className="w-full text-sm border-t border-border pt-2">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="py-2">Date</th>
              <th className="py-2">Meal</th>
              <th className="py-2 text-right">Pax</th>
              <th className="py-2 text-right">Unit price</th>
              <th className="py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {(p.items ?? []).map((item) => (
              <tr key={item.id} className="border-t border-border">
                <td className="py-2">{item.date ?? '—'}</td>
                <td className="py-2">{item.mealType || item.eventType}</td>
                <td className="py-2 text-right">{item.pax}</td>
                <td className="py-2 text-right">TZS {item.unitPrice.toLocaleString()}</td>
                <td className="py-2 text-right">TZS {item.total.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="border-t border-border pt-3 flex flex-col items-end text-sm gap-1">
          <div className="flex justify-between w-56">
            <span className="text-muted-foreground">Items subtotal</span>
            <span>TZS {itemsTotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between w-56">
            <span className="text-muted-foreground">Service charge</span>
            <span>TZS {(p.serviceCharge ?? 0).toLocaleString()}</span>
          </div>
          <div className="flex justify-between w-56">
            <span className="text-muted-foreground">Transport</span>
            <span>TZS {(p.transportCosts ?? 0).toLocaleString()}</span>
          </div>
          <div className="flex justify-between w-56 font-medium border-t border-border pt-1">
            <span>Total</span>
            <span>TZS {grandTotal.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 space-y-4 no-print">
        <h2 className="font-medium">Comments</h2>
        {commentsQuery.data && commentsQuery.data.length > 0 ? (
          <ul className="space-y-2">
            {commentsQuery.data.map((c) => (
              <li key={c.id} className="text-sm rounded-md bg-muted/40 p-2">
                <span className="text-xs text-muted-foreground">
                  {c.author_type === 'portal' ? 'Admin' : 'Staff'} · {new Date(c.created_at).toLocaleString()}
                </span>
                <p>{c.body}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No comments yet.</p>
        )}
        <div className="flex gap-2">
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add a comment…"
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={submitComment}
            disabled={submitting || !comment.trim()}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? 'Posting…' : 'Post'}
          </button>
        </div>
      </div>
    </div>
  );
}
