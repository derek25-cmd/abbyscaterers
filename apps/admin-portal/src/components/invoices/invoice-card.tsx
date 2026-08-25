'use client';

import Link from 'next/link';
import { computeInvoiceGrandTotal, type InvoiceTotalFields } from '@/lib/invoice-math';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

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

export function InvoiceCard({ invoice }: { invoice: InvoiceCardData }) {
  return (
    <Link href={`/invoices/${invoice.id}`}>
      <Card className="hover:bg-muted/40">
        <CardContent className="p-4 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-xs text-muted-foreground">{invoice.id}</span>
            <Badge variant="outline" className={STATUS_CLASS[invoice.status] ?? ''}>
              {STATUS_LABEL[invoice.status] ?? invoice.status}
            </Badge>
          </div>
          <p className="text-base font-semibold text-foreground">{invoice.clients?.companyName ?? invoice.clientId ?? '—'}</p>
          <p className="text-lg font-bold text-foreground">TZS {computeInvoiceGrandTotal(invoice).toLocaleString()}</p>
          <p className="text-xs text-muted-foreground pt-1">{invoice.invoiceDate}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
