import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function calculateGrandTotal(invoice: any): number {
    if (!invoice || !invoice.items) return 0;
    const subtotal = invoice.items.reduce((sum: number, item: any) => sum + (item.total || 0), 0);
    const totalForDays = invoice.multiplyByDays ? subtotal * (invoice.numberOfDays || 1) : subtotal;
    const totalBeforeVat = totalForDays + (invoice.serviceCharge || 0) + (invoice.transportCosts || 0);
    const vat = invoice.vatType === 'exclusive' ? totalBeforeVat * 0.18 : 0;
    return totalBeforeVat + vat;
}
