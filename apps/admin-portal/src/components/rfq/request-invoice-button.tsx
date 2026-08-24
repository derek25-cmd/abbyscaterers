'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/nextjs';
import { useSupabaseClient } from '@/lib/supabase-client';

export interface InvoiceRequestSummary {
  status: 'pending' | 'fulfilled' | 'rejected';
  invoiceId: string | null;
  rejectionReason: string | null;
}

interface RequestInvoiceButtonProps {
  // Omitted when requesting directly from a client's proforma list rather
  // than from a specific RFQ's linked-proformas table.
  rfqId?: string;
  proformaId: string;
  latestRequest: InvoiceRequestSummary | null;
  onRequested?: () => void;
}

/**
 * Submits a REQUEST for staff to fulfill in apps/catering-system's
 * Requests page — mirrors the RFQ pattern (admin requests, staff
 * processes). This deliberately does NOT call create_invoice_from_proforma
 * itself; that stays entirely on the staff/existing-system side.
 */
export function RequestInvoiceButton({ rfqId, proformaId, latestRequest, onRequested }: RequestInvoiceButtonProps) {
  const supabase = useSupabaseClient();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestInvoice = async () => {
    setBusy(true);
    setError(null);
    try {
      const { error } = await supabase.from('portal_invoice_requests').insert({
        rfq_id: rfqId ?? null,
        proforma_id: proformaId,
        requested_by_id: user?.id ?? null,
      });
      if (error) throw error;
      if (rfqId) queryClient.invalidateQueries({ queryKey: ['rfq-invoice-requests', rfqId] });
      onRequested?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request invoice');
    } finally {
      setBusy(false);
    }
  };

  if (latestRequest?.status === 'fulfilled') {
    return <span className="text-xs text-muted-foreground">Invoiced ({latestRequest.invoiceId})</span>;
  }
  if (latestRequest?.status === 'pending') {
    return <span className="text-xs text-muted-foreground">Requested — awaiting staff</span>;
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={requestInvoice}
        disabled={busy}
        className="rounded-md border border-input px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-50"
      >
        {busy ? 'Requesting…' : 'Request invoice'}
      </button>
      {latestRequest?.status === 'rejected' && (
        <p className="text-xs text-destructive">
          Previous request rejected{latestRequest.rejectionReason ? `: ${latestRequest.rejectionReason}` : ''}
        </p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
