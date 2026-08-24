/**
 * Shared TZS currency formatter. Not a full replacement for the ~56 ad-hoc
 * `Intl.NumberFormat` call sites already in the codebase (out of scope for
 * this change) — new payroll code uses this instead of adding a 57th.
 */
export function formatTZS(amount: number): string {
  return new Intl.NumberFormat('en-TZ', {
    style: 'currency',
    currency: 'TZS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
