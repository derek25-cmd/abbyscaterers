'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSupabaseClient } from '@/lib/supabase-client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { SwipeableCard } from '@/components/pwa/swipeable-card';
import { vibrate } from '@/lib/haptics';

export interface ProformaCardData {
  id: string;
  invoiceDate: string;
  clientId: string | null;
  clients: { companyName: string } | null;
  items: { total?: number }[] | null;
  reviewStatus: 'pending' | 'approved' | 'rejected';
  isInvoiced: boolean | null;
  isVoided: boolean | null;
}

const STATUS_LABEL: Record<string, string> = { pending: 'Pending Review', approved: 'Approved', rejected: 'Rejected' };
const STATUS_CLASS: Record<string, string> = {
  pending: 'bg-secondary',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-destructive/10 text-destructive',
};

export function ProformaCard({ proforma }: { proforma: ProformaCardData }) {
  const supabase = useSupabaseClient();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const subtotal = (proforma.items ?? []).reduce((sum, item) => sum + (item.total ?? 0), 0);
  const swipeable = proforma.reviewStatus === 'pending' && !proforma.isVoided && !proforma.isInvoiced;

  const approve = async () => {
    if (busy) return;
    setBusy(true);
    vibrate();
    try {
      await supabase.rpc('approve_proforma', { p_proforma_id: proforma.id });
      queryClient.invalidateQueries({ queryKey: ['proformas-list'] });
    } finally {
      setBusy(false);
    }
  };

  // Quick swipe-reject has no reason field — that stays on the detail page
  // for when the admin wants to explain why. This is the fast path.
  const reject = async () => {
    if (busy) return;
    setBusy(true);
    vibrate();
    try {
      await supabase.rpc('reject_proforma', { p_proforma_id: proforma.id, p_reason: null });
      queryClient.invalidateQueries({ queryKey: ['proformas-list'] });
    } finally {
      setBusy(false);
    }
  };

  return (
    <SwipeableCard
      disabled={!swipeable}
      leftAction={swipeable ? { label: 'Approve', colorClass: 'bg-emerald-600', onConfirm: approve } : undefined}
      rightAction={swipeable ? { label: 'Reject', colorClass: 'bg-destructive', onConfirm: reject } : undefined}
    >
      <Link href={`/proformas/${proforma.id}`}>
        <Card className="hover:bg-muted/40">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs text-muted-foreground">{proforma.id}</span>
              <div className="flex flex-wrap gap-1 justify-end">
                <Badge variant="outline" className={STATUS_CLASS[proforma.reviewStatus]}>
                  {STATUS_LABEL[proforma.reviewStatus]}
                </Badge>
                {proforma.isVoided && (
                  <Badge variant="outline" className="bg-destructive/10 text-destructive">
                    Uninvoiced
                  </Badge>
                )}
                {proforma.isInvoiced && !proforma.isVoided && <Badge variant="secondary">Invoiced</Badge>}
              </div>
            </div>
            <p className="text-base font-semibold text-foreground">{proforma.clients?.companyName ?? proforma.clientId ?? '—'}</p>
            <p className="text-lg font-bold text-foreground">TZS {subtotal.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground pt-1">{proforma.invoiceDate}</p>
          </CardContent>
        </Card>
      </Link>
    </SwipeableCard>
  );
}
