'use client';

import Link from 'next/link';
import { computeInvoiceGrandTotal, type InvoiceTotalFields } from '@/lib/invoice-math';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { useLongPress } from '@/hooks/use-long-press';
import { vibrate } from '@/lib/haptics';

export interface InvoiceCardData extends InvoiceTotalFields {
  id: string;
  invoiceDate: string;
  clientId: string | null;
  clients: { companyName: string } | null;
  status: 'outstanding' | 'paid' | 'partially paid';
}

const STATUS_LABEL: Record<string, string> = {
  outstanding: 'Outstanding',
  paid: 'Paid',
  'partially paid': 'Partially Paid',
};

const STATUS_CLASS: Record<string, string> = {
  outstanding: 'bg-destructive/10 text-destructive',
  paid: 'bg-emerald-100 text-emerald-800',
  'partially paid': 'bg-amber-100 text-amber-800',
};

export function InvoiceCard({
  invoice,
  selectMode = false,
  selected = false,
  onEnterSelectMode,
  onToggleSelected,
}: {
  invoice: InvoiceCardData;
  selectMode?: boolean;
  selected?: boolean;
  onEnterSelectMode?: (id: string) => void;
  onToggleSelected?: (id: string) => void;
}) {
  const longPress = useLongPress(() => {
    vibrate();
    onEnterSelectMode?.(invoice.id);
  });

  const cardBody = (
    <Card className={selected ? 'border-primary bg-primary/5' : 'hover:bg-muted/40'}>
      <CardContent className="p-4 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {selectMode && <Checkbox checked={selected} className="pointer-events-none" />}
            <span className="font-mono text-xs text-muted-foreground">{invoice.id}</span>
          </div>
          <Badge variant="outline" className={STATUS_CLASS[invoice.status] ?? ''}>
            {STATUS_LABEL[invoice.status] ?? invoice.status}
          </Badge>
        </div>
        <p className="text-base font-semibold text-foreground">{invoice.clients?.companyName ?? invoice.clientId ?? '—'}</p>
        <p className="text-lg font-bold text-foreground">TZS {computeInvoiceGrandTotal(invoice).toLocaleString()}</p>
        <p className="text-xs text-muted-foreground pt-1">{invoice.invoiceDate}</p>
      </CardContent>
    </Card>
  );

  if (selectMode) {
    return (
      <button
        type="button"
        onClick={() => onToggleSelected?.(invoice.id)}
        className="block w-full text-left"
        {...longPress}
      >
        {cardBody}
      </button>
    );
  }

  return (
    <Link href={`/invoices/${invoice.id}`} {...longPress}>
      {cardBody}
    </Link>
  );
}
