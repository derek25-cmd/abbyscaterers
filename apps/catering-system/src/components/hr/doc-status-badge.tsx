import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2, Clock, FileEdit, FileCheck2, Ban } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { HrDocument } from '@/types';

type Look = { label: string; className: string; icon: typeof Clock };

/**
 * The stage of a document in plain words. An approved document that already has
 * a reserved number is one whose issue started but did not finish: it is shown
 * as such so HR can see it and press Issue again.
 */
export function docStatusLook(doc: Pick<HrDocument, 'status' | 'ref_no'>): Look {
  switch (doc.status) {
    case 'draft': return { label: 'Draft', className: 'border-slate-300 bg-slate-50 text-slate-700', icon: FileEdit };
    case 'pending_approval': return { label: 'Waiting for approval', className: 'border-amber-300 bg-amber-50 text-amber-800', icon: Clock };
    case 'approved':
      return doc.ref_no
        ? { label: 'Issue incomplete — retry', className: 'border-orange-400 bg-orange-50 text-orange-900', icon: AlertTriangle }
        : { label: 'Approved — ready to issue', className: 'border-blue-300 bg-blue-50 text-blue-800', icon: CheckCircle2 };
    case 'issued': return { label: 'Issued', className: 'border-green-300 bg-green-50 text-green-800', icon: FileCheck2 };
    case 'void': return { label: 'Void', className: 'border-red-300 bg-red-50 text-red-800', icon: Ban };
  }
}

export function DocStatusBadge({ doc }: { doc: Pick<HrDocument, 'status' | 'ref_no'> }) {
  const { label, className, icon: Icon } = docStatusLook(doc);
  return (
    <Badge variant="outline" className={cn('gap-1 whitespace-nowrap font-medium', className)}>
      <Icon className="h-3 w-3" aria-hidden />
      {label}
    </Badge>
  );
}
