import { z } from 'zod';
import type { DocTypeDefinition } from '@/lib/hr-docs/registry';
import { OMIT, formatLongDate, formatMonthYear } from '@/lib/hr-docs/render';
import type { Employee, EmploymentContract } from '@/types';
import { defaultAddresseeLines } from './general_letter';
import { addresseeOverride, hasLeft } from './shared';

/**
 * Certificate of service (report 2.7). Nothing is typed: the dates and positions
 * come from the employee record and the contract history, so the certificate
 * cannot disagree with the records.
 */
export const CertificateSchema = z.object({
  includeReason: z.boolean().default(false),
  addressee: z.string().optional(),
});

export interface ServiceSummary {
  startDate: string | null;
  endDate: string | null;
  /** "Cook (Mar 2023 – Jun 2024), Head Chef (Jun 2024 – Oct 2026)" */
  positions: string;
}

/**
 * start = earliest contract start, else the employee's start date;
 * end = the employee's end date;
 * positions = distinct contract positions in date order, each with the months it
 * was held, else the job title on the employee record.
 */
export function deriveService(employee: Partial<Employee>, contracts: Pick<EmploymentContract, 'start_date' | 'end_date' | 'position' | 'status'>[]): ServiceSummary {
  const live = contracts.filter((c) => c.status !== 'void').sort((a, b) => a.start_date.localeCompare(b.start_date));
  const startDate = live[0]?.start_date ?? employee.employmentStartDate ?? null;
  const endDate = employee.employmentEndDate ?? null;

  const spans = new Map<string, { from: string; to: string | null }>();
  for (const c of live) {
    const position = (c.position ?? '').trim();
    if (!position) continue;
    const to = c.end_date ?? endDate;
    const span = spans.get(position);
    if (!span) spans.set(position, { from: c.start_date, to });
    else if (to && (!span.to || to > span.to)) span.to = to;
  }
  if (spans.size === 0 && employee.role) spans.set(employee.role, { from: startDate ?? '', to: endDate });

  const positions = [...spans.entries()]
    .map(([position, { from, to }]) => {
      const range = [formatMonthYear(from), formatMonthYear(to)].filter(Boolean).join(' – ');
      return range ? `${position} (${range})` : position;
    })
    .join(', ');
  return { startDate, endDate, positions };
}

export const certificateOfService: DocTypeDefinition = {
  docType: 'certificate_of_service',
  schema: CertificateSchema,
  appliesTo: hasLeft,
  needs: ['allContracts'],
  defaults: () => ({ includeReason: false }),
  defaultSubject: 'Certificate of service',
  sampleData: { includeReason: false },
  addressee: (employee, data) => addresseeOverride(data) ?? defaultAddresseeLines(employee),
  buildContext: (data, related, employee) => {
    const s = deriveService(employee ?? {}, related.contracts ?? []);
    const reason = (employee?.employmentEndReason ?? '').trim();
    return {
      service: {
        startDate: formatLongDate(s.startDate),
        endDate: formatLongDate(s.endDate),
        positions: s.positions || undefined,
        // Printed only when HR ticks "include reason for leaving".
        reason: data.includeReason ? (reason || undefined) : OMIT,
      },
    };
  },
  placeholders: [
    { path: 'service.startDate', description: 'First day of service', example: '1 March 2023' },
    { path: 'service.endDate', description: 'Last day of service', example: '31 October 2026' },
    { path: 'service.positions', description: 'Positions held, with dates', example: 'Cook (Mar 2023 – Jun 2024), Head Chef (Jun 2024 – Oct 2026)' },
    { path: 'service.reason', description: 'Reason for leaving (only when ticked; use {{{service.reason}}} on its own line)', example: 'End of contract: contract not renewed.' },
  ],
};
