import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Returns only the items that will appear on the printed invoice.
 * When an invoice has both order-linked entries (orderId set) and custom
 * unlinked entries (orderId undefined), only the unlinked entries are shown —
 * the user explicitly added them to replace the real entries in the output.
 * In every other case all items are returned unchanged.
 */
export function getDisplayItems<T extends { orderId?: string | null }>(items: T[]): T[] {
    const hasUnlinked = items.some(item => !item.orderId);
    const hasLinked   = items.some(item => !!item.orderId);
    if (hasUnlinked && hasLinked) return items.filter(item => !item.orderId);
    return items;
}

export function calculateGrandTotal(invoice: any): number {
    if (!invoice || !invoice.items) return 0;
    const displayItems = getDisplayItems<any>(invoice.items);
    const subtotal = displayItems.reduce((sum: number, item: any) => sum + (item.total || 0), 0);
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
