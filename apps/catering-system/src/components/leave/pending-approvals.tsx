'use client';

import { useEffect, useState } from 'react';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { CheckCheck, Loader2, Paperclip } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatDays } from '@/lib/leave';
import { getRequests } from '@/services/leaveService';
import type { LeaveRequestView } from '@/types';

interface PendingApprovalsProps {
  refreshKey: number;
  onOpen: (request: LeaveRequestView) => void;
}

const range = (r: LeaveRequestView) =>
  r.start_date === r.end_date
    ? format(parseISO(r.start_date), 'EEE d MMM yyyy')
    : `${format(parseISO(r.start_date), 'd MMM')} → ${format(parseISO(r.end_date), 'd MMM yyyy')}`;

/** The approver's inbox: oldest request first, one card each, one button to review. */
export function PendingApprovals({ refreshKey, onOpen }: PendingApprovalsProps) {
  const [items, setItems] = useState<LeaveRequestView[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setError(null);
    getRequests({ status: 'pending' })
      .then((rows) => { if (active) setItems([...rows].sort((a, b) => a.created_at.localeCompare(b.created_at))); })
      .catch((err) => { if (active) { setItems([]); setError(err instanceof Error ? err.message : 'Could not load the requests.'); } });
    return () => { active = false; };
  }, [refreshKey]);

  if (items === null) return <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (error) return <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-4 text-red-900">{error}</p>;

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-12 text-center">
        <CheckCheck className="h-8 w-8 text-green-600" />
        <p className="font-medium">Nothing is waiting for your approval</p>
        <p className="max-w-sm text-sm text-muted-foreground">New leave requests appear here and in the bell at the top of the page.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((r) => (
        <Card key={r.id} className="transition-shadow hover:shadow-md">
          <CardContent className="flex flex-col gap-3 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{r.employee_name}</p>
                {r.department && <p className="text-xs text-muted-foreground">{r.department}</p>}
              </div>
              <Badge variant="secondary">{r.leave_type_name}</Badge>
            </div>
            <div className="text-sm">
              <p>{range(r)}</p>
              <p className="text-muted-foreground">{formatDays(r.days)}{r.attachment_path && <Paperclip className="ml-2 inline h-3.5 w-3.5" aria-label="Has a supporting document" />}</p>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Sent {formatDistanceToNow(parseISO(r.created_at), { addSuffix: true })}</span>
              <Button size="sm" onClick={() => onOpen(r)}>Review</Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
