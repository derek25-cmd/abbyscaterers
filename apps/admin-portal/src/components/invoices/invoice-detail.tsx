'use client';

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSupabaseClient } from '@/lib/supabase-client';

interface InvoiceItem {
  id: string;
  eventType: string;
  mealType: string;
  pax: number;
  unitPrice: number;
  total: number;
  date?: string;
  particularDescription?: string;
}

interface InvoiceRecord {
  id: string;
  invoiceDate: string;
  clientId: string | null;
  clients: { companyName: string } | null;
  location: string | null;
  numberOfDays: number | null;
  multiplyByDays: boolean | null;
  serviceCharge: number | null;
  transportCosts: number | null;
  vatType: 'inclusive' | 'exclusive';
  items: InvoiceItem[];
  status: 'outstanding' | 'paid' | 'partially paid';
  amountPaid: number | null;
  paymentDate: string | null;
}

interface TaxRateRow {
  tax_type: 'vat' | 'wht' | 'vat_withholding';
  rate: number;
}

interface ClientTaxSettingRow {
  tax_type: 'vat' | 'wht' | 'vat_withholding';
  applies: boolean;
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

export function InvoiceDetail({ invoiceId }: { invoiceId: string }) {
  const supabase = useSupabaseClient();
  const queryClient = useQueryClient();

  const invoiceQuery = useQuery({
    queryKey: ['invoice-detail', invoiceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select(
          'id, "invoiceDate", "clientId", clients(companyName), location, "numberOfDays", "multiplyByDays", "serviceCharge", "transportCosts", "vatType", items, status, "amountPaid", "paymentDate"'
        )
        .eq('id', invoiceId)
        .single();
      if (error) throw error;
      return data as unknown as InvoiceRecord;
    },
  });

  const ratesQuery = useQuery({
    queryKey: ['invoice-tax-rates'],
    queryFn: async () => {
      const { data, error } = await supabase.from('invoice_tax_rates').select('tax_type, rate');
      if (error) throw error;
      return data as TaxRateRow[];
    },
  });

  const clientId = invoiceQuery.data?.clientId ?? null;
  const clientTaxQuery = useQuery({
    queryKey: ['client-tax-settings', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_invoice_tax_settings')
        .select('tax_type, applies')
        .eq('client_id', clientId as string);
      if (error) throw error;
      return data as ClientTaxSettingRow[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`invoice-${invoiceId}-changes`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'invoices', filter: `id=eq.${invoiceId}` },
        () => queryClient.invalidateQueries({ queryKey: ['invoice-detail', invoiceId] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, queryClient, invoiceId]);

  if (invoiceQuery.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (invoiceQuery.error) {
    return <p className="text-sm text-destructive">Failed to load invoice: {(invoiceQuery.error as Error).message}</p>;
  }
  const inv = invoiceQuery.data!;

  const vatRate = ratesQuery.data?.find((r) => r.tax_type === 'vat')?.rate ?? 18;
  const whtRate = ratesQuery.data?.find((r) => r.tax_type === 'wht')?.rate ?? 5;
  const vatWithholdingRate = ratesQuery.data?.find((r) => r.tax_type === 'vat_withholding')?.rate ?? 33.33;

  const whtApplies = clientTaxQuery.data?.find((r) => r.tax_type === 'wht')?.applies ?? false;
  const vatWithholdingApplies = clientTaxQuery.data?.find((r) => r.tax_type === 'vat_withholding')?.applies ?? false;

  const itemsSubtotal = (inv.items ?? []).reduce((sum, item) => sum + (item.total ?? 0), 0);
  const totalForDays = inv.multiplyByDays ? itemsSubtotal * (inv.numberOfDays || 1) : itemsSubtotal;
  const totalBeforeVat = totalForDays + (inv.serviceCharge ?? 0) + (inv.transportCosts ?? 0);

  // Mirrors apps/catering-system/src/lib/reports/invoice-math.ts, the one
  // place in catering-system that correctly backs VAT out of an
  // inclusive total instead of showing 0 — exclusive adds VAT on top,
  // inclusive decomposes the total into net + VAT.
  let vatAmount: number;
  let grandTotal: number;
  if (inv.vatType === 'exclusive') {
    vatAmount = totalBeforeVat * (vatRate / 100);
    grandTotal = totalBeforeVat + vatAmount;
  } else {
    grandTotal = totalBeforeVat;
    const net = grandTotal / (1 + vatRate / 100);
    vatAmount = grandTotal - net;
  }

  const whtAmount = whtApplies ? grandTotal * (whtRate / 100) : 0;
  const vatWithholdingAmount = vatWithholdingApplies ? vatAmount * (vatWithholdingRate / 100) : 0;
  const netPayable = grandTotal - whtAmount - vatWithholdingAmount;

  const fmt = (n: number) => `TZS ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">Invoice {inv.id}</h1>
            <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${STATUS_CLASS[inv.status] ?? ''}`}>
              {STATUS_LABEL[inv.status] ?? inv.status}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {inv.clients?.companyName ?? inv.clientId ?? '—'} · {inv.invoiceDate}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-card p-4 space-y-2">
          <h2 className="font-medium">Tax Breakdown</h2>
          <dl className="text-sm space-y-1">
            <Row label="Items subtotal" value={fmt(itemsSubtotal)} />
            {inv.multiplyByDays && <Row label={`× ${inv.numberOfDays ?? 1} days`} value={fmt(totalForDays)} />}
            <Row label="Service charge" value={fmt(inv.serviceCharge ?? 0)} />
            <Row label="Transport costs" value={fmt(inv.transportCosts ?? 0)} />
            <Row label="Total before VAT" value={fmt(totalBeforeVat)} strong />
            <Row label={`VAT (${vatRate}%, ${inv.vatType})`} value={fmt(vatAmount)} />
            <Row label="Grand Total" value={fmt(grandTotal)} strong />
            {whtApplies && <Row label={`WHT (${whtRate}% of gross)`} value={`− ${fmt(whtAmount)}`} />}
            {vatWithholdingApplies && (
              <Row label={`VAT Withholding (${vatWithholdingRate}% of VAT)`} value={`− ${fmt(vatWithholdingAmount)}`} />
            )}
            {(whtApplies || vatWithholdingApplies) && <Row label="Net Payable" value={fmt(netPayable)} strong />}
          </dl>
          {!whtApplies && !vatWithholdingApplies && (
            <p className="text-xs text-muted-foreground pt-2 border-t border-border">
              WHT and VAT Withholding aren&apos;t configured for this client — set them in Tax Settings if they
              should apply.
            </p>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card p-4 space-y-2">
          <h2 className="font-medium">Payment</h2>
          <dl className="text-sm space-y-1">
            <Row label="Status" value={STATUS_LABEL[inv.status] ?? inv.status} />
            <Row label="Amount paid" value={fmt(inv.amountPaid ?? 0)} />
            <Row label="Payment date" value={inv.paymentDate ?? '—'} />
            <Row label="Balance due" value={fmt(Math.max(grandTotal - (inv.amountPaid ?? 0), 0))} strong />
          </dl>
          <p className="text-xs text-muted-foreground pt-2 border-t border-border">
            Payments are recorded in the catering system — this view is read-only and updates live.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="font-medium mb-2">Items</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground border-b border-border">
            <tr>
              <th className="py-2">Date</th>
              <th className="py-2">Meal</th>
              <th className="py-2 text-right">Pax</th>
              <th className="py-2 text-right">Unit price</th>
              <th className="py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {(inv.items ?? []).map((item) => (
              <tr key={item.id} className="border-b border-border last:border-0">
                <td className="py-2">{item.date ?? '—'}</td>
                <td className="py-2">{item.mealType || item.eventType}</td>
                <td className="py-2 text-right">{item.pax}</td>
                <td className="py-2 text-right">TZS {item.unitPrice.toLocaleString()}</td>
                <td className="py-2 text-right">TZS {item.total.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? 'font-medium border-t border-border pt-1' : ''}`}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
