// A cancelled order shouldn't count as real business anywhere revenue,
// stock, or performance is aggregated — but it must still be visible (as
// "Cancelled") in the operational views that show/edit a specific order
// record. This is the shared filter reporting/costing/dashboard call sites
// apply; operational views (order list/detail/edit, bookings, proforma and
// invoice forms, HR stock logs) deliberately don't use it.
export function excludeCancelledOrders<T extends { status?: string | null }>(orders: T[]): T[] {
  return orders.filter((o) => o.status !== "cancelled");
}
