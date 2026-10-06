// Same grand-total shape as apps/catering-system/src/lib/utils.ts's
// calculateGrandTotal — shared across the invoice list, Dashboard, and
// Reports Centre now that all three need it. The full tax-rate-aware
// breakdown (VAT/WHT/withholding) lives in invoice-detail.tsx; this is
// just the base grand-total figure used for list/KPI display.
export interface InvoiceTotalFields {
  items: { total?: number }[] | null;
  serviceCharge: number | null;
  transportCosts: number | null;
  numberOfDays: number | null;
  multiplyByDays: boolean | null;
  vatType: 'inclusive' | 'exclusive';
}

// vatRatePct defaults to 18 (the historical hardcoded rate) only for
// callers that don't have access to the admin-configured rate from
// invoice_tax_rates (Tax Settings) — pass the real rate wherever it's
// available so exclusive-VAT totals stay correct if the rate ever changes.
export function computeInvoiceGrandTotal(inv: InvoiceTotalFields, vatRatePct = 18): number {
  const subtotal = (inv.items ?? []).reduce((sum, item) => sum + (item.total ?? 0), 0);
  const totalForDays = inv.multiplyByDays ? subtotal * (inv.numberOfDays || 1) : subtotal;
  const totalBeforeVat = totalForDays + (inv.serviceCharge ?? 0) + (inv.transportCosts ?? 0);
  if (inv.vatType === 'exclusive') return totalBeforeVat * (1 + vatRatePct / 100);
  return totalBeforeVat;
}
