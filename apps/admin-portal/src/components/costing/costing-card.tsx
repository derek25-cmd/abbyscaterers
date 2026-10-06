'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

export interface CostingCardData {
  id: string;
  rfq_id: string;
  status: 'pending' | 'fulfilled' | 'rejected';
  total_cost: number | null;
  total_revenue: number | null;
  gross_margin_pct: number | null;
  rejection_reason: string | null;
  requested_at: string;
  rfqs: { title: string } | null;
}

const STATUS_LABEL: Record<string, string> = { pending: 'Pending', fulfilled: 'Fulfilled', rejected: 'Rejected' };
const STATUS_CLASS: Record<string, string> = {
  pending: 'bg-secondary',
  fulfilled: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-destructive/10 text-destructive',
};

export function CostingCard({ request }: { request: CostingCardData }) {
  return (
    <Link href={`/rfqs/${request.rfq_id}`}>
      <Card className="hover:bg-muted/40">
        <CardContent className="p-4 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-xs text-muted-foreground">{request.rfq_id}</span>
            <Badge variant="outline" className={STATUS_CLASS[request.status]}>
              {STATUS_LABEL[request.status]}
            </Badge>
          </div>
          <p className="text-base font-semibold text-foreground">{request.rfqs?.title ?? request.rfq_id}</p>
          {request.status === 'fulfilled' ? (
            <div className="flex flex-wrap gap-x-4 text-sm">
              <span>
                <span className="text-muted-foreground">Cost</span> TZS {(request.total_cost ?? 0).toLocaleString()}
              </span>
              <span>
                <span className="text-muted-foreground">Revenue</span> TZS {(request.total_revenue ?? 0).toLocaleString()}
              </span>
              <span>
                <span className="text-muted-foreground">Margin</span> {request.gross_margin_pct ?? '—'}%
              </span>
            </div>
          ) : request.status === 'rejected' && request.rejection_reason ? (
            <p className="text-xs text-muted-foreground">{request.rejection_reason}</p>
          ) : null}
          <p className="text-xs text-muted-foreground pt-1">{new Date(request.requested_at).toLocaleDateString()}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
