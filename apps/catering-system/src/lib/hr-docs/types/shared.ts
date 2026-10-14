import { z } from 'zod';
import type { Candidate, Employee } from '@/types';

/**
 * Labels and small helpers shared by the letter types. The values on the left
 * are what is stored (and checked by the database); the labels are what prints.
 */

export const CONTRACT_TYPE_LABEL = {
  permanent: 'Permanent', fixed_term: 'Fixed-term', probation: 'Probation', casual: 'Casual',
} as const;

export const TERMINATION_TYPE_LABEL = {
  resignation: 'Resignation', end_of_contract: 'End of contract', misconduct: 'Misconduct',
  poor_performance: 'Poor performance', redundancy: 'Redundancy', mutual_agreement: 'Mutual agreement', other: 'Other',
} as const;

export const WARNING_LEVEL_LABEL = {
  verbal: 'Verbal warning', first_written: 'First written warning', final_written: 'Final written warning',
} as const;

export const RECOGNITION_CATEGORY_LABEL = {
  performance: 'Outstanding performance', long_service: 'Long service', conduct: 'Exemplary conduct',
  customer_praise: 'Customer praise', other: 'Other',
} as const;

export const REWARD_TYPE_LABEL = {
  none: 'No reward', cash: 'Cash reward', voucher: 'Voucher', gift: 'Gift', time_off: 'Time off',
} as const;

export const OFFER_STATUS_LABEL = {
  none: 'No offer', offered: 'Offer sent', accepted: 'Accepted', declined: 'Declined', expired: 'Expired', withdrawn: 'Withdrawn',
} as const;

const keys = <T extends Record<string, string>>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];
export const contractTypes = keys(CONTRACT_TYPE_LABEL);
export const terminationTypes = keys(TERMINATION_TYPE_LABEL);
export const warningLevels = keys(WARNING_LEVEL_LABEL);
export const recognitionCategories = keys(RECOGNITION_CATEGORY_LABEL);
export const rewardTypes = keys(REWARD_TYPE_LABEL);

// ── zod helpers ────────────────────────────────────────────────────────────
const ISO = /^\d{4}-\d{2}-\d{2}$/;
export const dateField = (label: string) => z.string({ required_error: `Choose the ${label}` }).regex(ISO, `Choose the ${label}`);
export const optionalDateField = () => z.union([z.literal(''), z.string().regex(ISO, 'Not a valid date')]).optional();

/** A number from a form field; blank becomes undefined (so "optional" means optional). */
export const optionalNumber = (label: string, min = 0) =>
  z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
    z.number({ invalid_type_error: `${label} must be a number` }).min(min, `${label} cannot be below ${min}`).optional(),
  );
export const requiredNumber = (label: string, min = 0) =>
  z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
    z.number({ required_error: `Enter the ${label}`, invalid_type_error: `${label} must be a number` }).min(min, `The ${label} cannot be below ${min}`),
  );

// ── dates and people ───────────────────────────────────────────────────────
/** "3 Feb 2026". */
export function formatShortDate(value: string | null | undefined): string {
  if (!value) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return value;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** yyyy-mm-dd plus whole months, clamped to the month's last day. */
export function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target.toISOString().slice(0, 10);
}

export const isActiveEmployee = (e: Partial<Employee>) => e.status === 'Active';
export const hasLeft = (e: Partial<Employee>) => e.status === 'Inactive' && !!e.employmentEndDate;

/** Name, then each address line. */
export function candidateAddresseeLines(candidate: Partial<Candidate> | null | undefined): string[] {
  if (!candidate) return [];
  return [candidate.full_name ?? '', ...(candidate.address ?? '').split(/\r?\n/)].map((l) => l.trim()).filter(Boolean);
}

/** The addressee override typed on a letter, one line per line, or null if none. */
export function addresseeOverride(data: Record<string, unknown>): string[] | null {
  const text = typeof data.addressee === 'string' ? data.addressee.trim() : '';
  return text ? text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean) : null;
}

/** "3 months" / "no probation period". */
export const describeProbation = (months: unknown): string => {
  const n = Number(months);
  return Number.isFinite(n) && n > 0 ? `${n} month${n === 1 ? '' : 's'}` : 'no probation period';
};
