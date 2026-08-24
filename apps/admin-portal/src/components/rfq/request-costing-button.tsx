'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/nextjs';
import { useSupabaseClient } from '@/lib/supabase-client';

export interface CostingRequestSummary {
  status: 'pending' | 'fulfilled' | 'rejected';
  totalCost: number | null;
  totalRevenue: number | null;
  grossMarginPct: number | null;
  notes: string | null;
  rejectionReason: string | null;
}

/**
 * Submits a REQUEST for staff to fulfill in apps/catering-system's
 * Requests page (Costing Requests tab) — same request/fulfill shape as
 * RequestInvoiceButton, since there's no backend costing calculation to
 * call directly (see supabase/migrations/20260901180000_costing_requests.sql).
 */
export function RequestCostingButton({ rfqId, latestRequest }: { rfqId: string; latestRequest: CostingRequestSummary | null }) {
  const supabase = useSupabaseClient();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestCosting = async () => {
    setBusy(true);
    setError(null);
    try {
      const { error } = await supabase.from('portal_costing_requests').insert({
        rfq_id: rfqId,
        requested_by_id: user?.id ?? null,
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['rfq-costing-request', rfqId] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request costing');
    } finally {
      setBusy(false);
    }
  };

  if (latestRequest?.status === 'fulfilled') {
    return (
      <div className="text-sm space-y-1">
        <div className="flex gap-4">
          <span>
            <span className="text-muted-foreground">Total cost</span> TZS {(latestRequest.totalCost ?? 0).toLocaleString()}
          </span>
          <span>
            <span className="text-muted-foreground">Revenue</span> TZS {(latestRequest.totalRevenue ?? 0).toLocaleString()}
          </span>
          <span>
            <span className="text-muted-foreground">Margin</span> {latestRequest.grossMarginPct ?? '—'}%
          </span>
        </div>
        {latestRequest.notes && <p className="text-xs text-muted-foreground">{latestRequest.notes}</p>}
      </div>
    );
  }
  if (latestRequest?.status === 'pending') {
    return <span className="text-xs text-muted-foreground">Requested — awaiting staff</span>;
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={requestCosting}
        disabled={busy}
        className="rounded-md border border-input px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-50"
      >
        {busy ? 'Requesting…' : 'Request Costing'}
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
