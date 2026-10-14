import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Clock, XCircle, Ban } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LEAVE_STATUS_LABEL } from '@/lib/leave';
import type { LeaveRequestStatus } from '@/types';

const STYLE: Record<LeaveRequestStatus, { className: string; icon: typeof Clock }> = {
  pending: { className: 'border-amber-300 bg-amber-50 text-amber-800', icon: Clock },
  approved: { className: 'border-green-300 bg-green-50 text-green-800', icon: CheckCircle2 },
  rejected: { className: 'border-red-300 bg-red-50 text-red-800', icon: XCircle },
  cancelled: { className: 'border-slate-300 bg-slate-50 text-slate-600', icon: Ban },
};

/** Status in plain words, with an icon so it does not rely on colour alone. */
export function LeaveStatusBadge({ status }: { status: LeaveRequestStatus }) {
  const { className, icon: Icon } = STYLE[status];
  return (
    <Badge variant="outline" className={cn('gap-1 whitespace-nowrap font-medium', className)}>
      <Icon className="h-3 w-3" aria-hidden />
      {LEAVE_STATUS_LABEL[status]}
    </Badge>
  );
}
