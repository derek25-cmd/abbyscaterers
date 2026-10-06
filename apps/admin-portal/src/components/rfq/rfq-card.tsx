'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

export interface RfqCardData {
  id: string;
  title: string;
  status: string;
  client_name_freetext: string | null;
  client_id: string | null;
  clients: { companyName: string } | null;
  service_start_date: string | null;
  service_end_date: string | null;
  target_event_date: string | null;
  region: string | null;
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'outline',
  submitted: 'secondary',
  in_review: 'secondary',
  proforma_created: 'default',
  approved: 'default',
  closed: 'outline',
  cancelled: 'destructive',
};

export function RfqCard({ rfq }: { rfq: RfqCardData }) {
  const client = rfq.clients?.companyName ?? rfq.client_name_freetext ?? rfq.client_id ?? '—';
  const servicePeriod =
    rfq.service_start_date && rfq.service_end_date
      ? `${rfq.service_start_date} – ${rfq.service_end_date}`
      : rfq.target_event_date ?? '—';

  return (
    <Link href={`/rfqs/${rfq.id}`}>
      <Card className="hover:bg-muted/40">
        <CardContent className="p-4 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-xs text-muted-foreground">{rfq.id}</span>
            <Badge variant={STATUS_VARIANT[rfq.status] ?? 'outline'}>{rfq.status}</Badge>
          </div>
          <p className="text-base font-semibold text-foreground">{client}</p>
          <p className="text-sm text-muted-foreground">{rfq.title}</p>
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
            <span>{servicePeriod}</span>
            {rfq.region && <span>{rfq.region}</span>}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
