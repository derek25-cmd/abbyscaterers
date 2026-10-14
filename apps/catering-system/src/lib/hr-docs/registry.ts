import type { ZodTypeAny } from 'zod';
import type { Employee, HrDocTypeCode } from '@/types';
import { generalLetter } from '@/lib/hr-docs/types/general_letter';

/**
 * Everything the engine needs to know about ONE kind of letter, apart from how
 * its form looks (that lives with the screens, in components/hr/doc-forms).
 *
 * Adding a letter type in Phase 4 means adding a file under ./types, one line in
 * REGISTRY below, and a form component: no change to the engine, the database
 * or the PDF builder.
 */
export interface DocTypeDefinition {
  docType: HrDocTypeCode;
  /** Checks the type-specific values stored in the document's `data`. */
  schema: ZodTypeAny;
  /** Starting values for a new document of this type. */
  defaults: () => Record<string, unknown>;
  /** Suggested subject line, shown pre-filled in the wizard. */
  defaultSubject: string;
  /** Example values, so the template editor can preview a realistic letter. */
  sampleData: Record<string, unknown>;
  /** Lines of the addressee block; the author may override them in `data`. */
  addressee: (employee: Partial<Employee> | null, data: Record<string, unknown>) => string[];
}

/** Types that can be created today; the rest show as "coming soon". */
export const REGISTRY: Partial<Record<HrDocTypeCode, DocTypeDefinition>> = {
  general_letter: generalLetter,
};

export const isDocTypeEnabled = (docType: HrDocTypeCode): boolean => docType in REGISTRY;

export function getDocTypeDefinition(docType: HrDocTypeCode): DocTypeDefinition {
  const def = REGISTRY[docType];
  if (!def) throw new Error('This type of document is not available yet.');
  return def;
}

/** Display order for the wizard and filters. */
export const DOC_TYPE_ORDER: HrDocTypeCode[] = [
  'general_letter', 'offer', 'contract', 'extension', 'termination', 'warning', 'recognition', 'certificate_of_service',
];

export const DOC_TYPE_LABELS: Record<HrDocTypeCode, string> = {
  general_letter: 'General letter',
  offer: 'Offer letter',
  contract: 'Employment contract',
  extension: 'Contract extension',
  termination: 'Termination letter',
  warning: 'Warning letter',
  recognition: 'Letter of recognition',
  certificate_of_service: 'Certificate of service',
};
