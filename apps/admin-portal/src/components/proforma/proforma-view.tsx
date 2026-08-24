'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/nextjs';
import { Download } from 'lucide-react';
import { useSupabaseClient } from '@/lib/supabase-client';
import { useAppSettings } from '@/lib/use-app-settings';
import { exportDocumentToPdf } from '@/lib/pdf-export';
import { ProformaPdfTemplate } from '@/components/pdf/proforma-pdf-template';

interface ProformaItem {
  id: string;
  eventType: string;
  mealType: string;
  pax: number;
  unitPrice: number;
  total: number;
  date?: string;
  particularDescription?: string;
  orderId?: string | null;
}

interface ProformaRecord {
  id: string;
  invoiceDate: string;
  clientId: string | null;
  clients: { companyName: string; address1: string | null; address2: string | null } | null;
  location: string;
  region: string | null;
  startDate: string;
  endDate: string;
  vatType: 'inclusive' | 'exclusive';
  serviceCharge: number;
  transportCosts: number;
  serviceDesc: string | null;
  receiverName: string | null;
  receiverPosition: string | null;
  lpoNumber: string | null;
  multiplyByDays: boolean | null;
  numberOfDays: number | null;
  items: ProformaItem[];
  isInvoiced: boolean | null;
  isVoided: boolean | null;
  voidedReason: string | null;
  reviewStatus: 'pending' | 'approved' | 'rejected';
  reviewedAt: string | null;
  rejectionReason: string | null;
}

interface CommentRow {
  id: string;
  author_type: 'portal' | 'staff';
  body: string;
  created_at: string;
}

/**
 * PDF export renders ProformaPdfTemplate off-screen (same
 * jsPDF/html2canvas pagination technique as catering-system's own
 * proforma-invoice-view-page-component.tsx) and captures it — same
 * header/footer/signature/stamp images (from the shared app_settings
 * table), same TIN/VRN/terms/amount-in-words, so the output is the same
 * document, not a re-derived approximation.
 */
export function ProformaView({ proformaId }: { proformaId: string }) {
  const supabase = useSupabaseClient();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const appSettingsQuery = useAppSettings();
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [showRejectReason, setShowRejectReason] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const proformaQuery = useQuery({
    queryKey: ['proforma-view', proformaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proforma_invoices')
        .select(
          'id, "invoiceDate", "clientId", clients(companyName, address1, address2), location, region, "startDate", "endDate", "vatType", "serviceCharge", "transportCosts", "serviceDesc", "receiverName", "receiverPosition", "lpoNumber", "multiplyByDays", "numberOfDays", items, "isInvoiced", "isVoided", "voidedReason", "reviewStatus", "reviewedAt", "rejectionReason"'
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
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'proforma_invoices', filter: `id=eq.${proformaId}` },
        () => queryClient.invalidateQueries({ queryKey: ['proforma-view', proformaId] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, queryClient, proformaId]);

  const approve = async () => {
    setReviewing(true);
    setReviewError(null);
    try {
      const { error } = await supabase.rpc('approve_proforma', { p_proforma_id: proformaId });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['proforma-view', proformaId] });
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : 'Failed to approve proforma');
    } finally {
      setReviewing(false);
    }
  };

  const confirmReject = async () => {
    setReviewing(true);
    setReviewError(null);
    try {
      const { error } = await supabase.rpc('reject_proforma', {
        p_proforma_id: proformaId,
        p_reason: rejectReason.trim() || null,
      });
      if (error) throw error;
      setShowRejectReason(false);
      setRejectReason('');
      queryClient.invalidateQueries({ queryKey: ['proforma-view', proformaId] });
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : 'Failed to reject proforma');
    } finally {
      setReviewing(false);
    }
  };

  const exportPdf = async (p: ProformaRecord) => {
    setExporting(true);
    setExportError(null);
    try {
      await exportDocumentToPdf({
        cardId: 'proforma-invoice-pdf-content',
        headerId: 'proforma-header',
        contentId: 'proforma-main-content',
        footerId: 'proforma-footer',
        pdfScale: appSettingsQuery.data?.pdfScale ?? 2.0,
        filename: `PI-${p.id} - ${p.clients?.companyName ?? 'Client'} - at ${p.invoiceDate}.pdf`,
      });
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Failed to export PDF');
    } finally {
      setExporting(false);
    }
  };

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Proforma {p.id}</h1>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {p.reviewStatus === 'pending' && (
              <span className="inline-block rounded-full bg-secondary px-2 py-0.5 text-xs">Pending Review</span>
            )}
            {p.reviewStatus === 'approved' && (
              <span className="inline-block rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-xs">
                Approved
              </span>
            )}
            {p.reviewStatus === 'rejected' && (
              <span className="inline-block rounded-full bg-destructive/10 text-destructive px-2 py-0.5 text-xs">
                Rejected{p.rejectionReason ? ` — ${p.rejectionReason}` : ''}
              </span>
            )}
            {p.isVoided && (
              <span className="inline-block rounded-full bg-destructive/10 text-destructive px-2 py-0.5 text-xs">
                Uninvoiced{p.voidedReason ? ` — ${p.voidedReason}` : ''}
              </span>
            )}
            {p.isInvoiced && !p.isVoided && (
              <span className="inline-block rounded-full bg-secondary px-2 py-0.5 text-xs">Invoiced</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {p.reviewStatus === 'pending' && !p.isVoided && !p.isInvoiced && (
            <>
              <button
                type="button"
                onClick={approve}
                disabled={reviewing}
                className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {reviewing ? 'Approving…' : 'Approve'}
              </button>
              <button
                type="button"
                onClick={() => setShowRejectReason((v) => !v)}
                disabled={reviewing}
                className="rounded-md border border-destructive text-destructive px-3 py-1.5 text-sm hover:bg-destructive/10 disabled:opacity-50"
              >
                Reject
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => exportPdf(p)}
            disabled={exporting || appSettingsQuery.isLoading}
            className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
          >
            <Download className="h-4 w-4" /> {exporting ? 'Exporting…' : 'Export PDF'}
          </button>
        </div>
      </div>
      {exportError && <p className="text-sm text-destructive">{exportError}</p>}

      {showRejectReason && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-2 no-print">
          <label className="text-sm font-medium">Reason for rejection (shown to staff)</label>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="e.g. Pax count doesn't match the RFQ, please revise"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={confirmReject}
              disabled={reviewing}
              className="rounded-md bg-destructive px-4 py-2 text-sm text-destructive-foreground hover:opacity-90 disabled:opacity-50"
            >
              {reviewing ? 'Rejecting…' : 'Confirm rejection'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowRejectReason(false);
                setRejectReason('');
              }}
              disabled={reviewing}
              className="rounded-md border border-input px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {reviewError && <p className="text-sm text-destructive no-print">{reviewError}</p>}

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

      {appSettingsQuery.data && (
        <div style={{ position: 'fixed', top: 0, left: '-10000px', zIndex: -1 }} aria-hidden="true">
          <ProformaPdfTemplate
            data={{
              id: p.id,
              invoiceDate: p.invoiceDate,
              receiverName: p.receiverName,
              receiverPosition: p.receiverPosition,
              lpoNumber: p.lpoNumber,
              clientCompanyName: p.clients?.companyName ?? null,
              clientAddress1: p.clients?.address1 ?? null,
              clientAddress2: p.clients?.address2 ?? null,
              serviceDesc: p.serviceDesc,
              serviceCharge: p.serviceCharge ?? 0,
              transportCosts: p.transportCosts ?? 0,
              multiplyByDays: p.multiplyByDays,
              numberOfDays: p.numberOfDays,
              vatType: p.vatType,
              items: p.items ?? [],
            }}
            settings={appSettingsQuery.data}
          />
        </div>
      )}
    </div>
  );
}
