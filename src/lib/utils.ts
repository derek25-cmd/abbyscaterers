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

export function incrementIdString(id: string): string {
    const match = id.match(/\d+$/);
    if (!match) return id + "1";
    const numStr = match[0];
    const nextNum = (parseInt(numStr, 10) + 1).toString();
    // Preserve leading zeros by padding with the same length as the original matched digits
    return id.substring(0, id.length - numStr.length) + nextNum.padStart(numStr.length, '0');
}
