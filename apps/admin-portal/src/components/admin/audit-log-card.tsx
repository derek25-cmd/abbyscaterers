'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

export interface AuditLogCardData {
  id: string;
  actor_id: string | null;
  actor_type: 'portal' | 'staff' | 'system';
  action: string;
  table_name: string | null;
  record_id: string | null;
  note: string | null;
  created_at: string;
}

const ACTOR_TYPE_CLASS: Record<string, string> = {
  portal: 'bg-primary/10 text-primary',
  staff: 'bg-secondary',
  system: 'bg-muted text-muted-foreground',
};

export function AuditLogCard({ entry }: { entry: AuditLogCardData }) {
  return (
    <Card>
      <CardContent className="p-4 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <Badge variant="outline" className={ACTOR_TYPE_CLASS[entry.actor_type]}>
            {entry.actor_type}
          </Badge>
          <span className="text-xs text-muted-foreground">{new Date(entry.created_at).toLocaleString()}</span>
        </div>
        <p className="font-mono text-sm text-foreground">{entry.action}</p>
        <p className="text-xs text-muted-foreground">
          {entry.actor_id ?? '—'}
          {entry.table_name && ` · ${entry.table_name}${entry.record_id ? `:${entry.record_id}` : ''}`}
        </p>
        {entry.note && <p className="text-xs text-muted-foreground pt-1">{entry.note}</p>}
      </CardContent>
    </Card>
  );
}
