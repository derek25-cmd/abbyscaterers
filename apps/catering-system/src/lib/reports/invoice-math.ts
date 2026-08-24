import type { Invoice, ProformaInvoice } from '@/types';

/** Same VAT math as src/app/(finances)/finances/reports/page.tsx's calcInvoiceTotals,
 * shared here so every module that touches invoice revenue agrees on one formula. */
export function calcInvoiceTotals(inv: Invoice | ProformaInvoice) {
  const subtotal = inv.items.reduce((s, i) => s + (i.total || 0), 0);
  const forDays = inv.multiplyByDays ? subtotal * (inv.numberOfDays || 1) : subtotal;
  const beforeVAT = forDays + (inv.serviceCharge || 0) + (inv.transportCosts || 0);
  if (inv.vatType === 'exclusive') {
    const vat = beforeVAT * 0.18;
    return { netAmount: beforeVAT, vatAmount: vat, grandTotal: beforeVAT + vat };
  }
  const grand = beforeVAT;
  const net = grand / 1.18;
  return { netAmount: net, vatAmount: grand - net, grandTotal: grand };
}
