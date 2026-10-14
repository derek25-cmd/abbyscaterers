import type { ZodTypeAny } from 'zod';
import type { Candidate, DisciplinaryRecord, Employee, EmploymentContract, HrDocTypeCode } from '@/types';
import { generalLetter } from '@/lib/hr-docs/types/general_letter';
import { offerLetter } from '@/lib/hr-docs/types/offer';
import { contractLetter } from '@/lib/hr-docs/types/contract';
import { extensionLetter } from '@/lib/hr-docs/types/extension';
import { terminationLetter } from '@/lib/hr-docs/types/termination';
import { warningLetter } from '@/lib/hr-docs/types/warning';
import { recognitionLetter } from '@/lib/hr-docs/types/recognition';
import { certificateOfService } from '@/lib/hr-docs/types/certificate_of_service';

/** Records a letter needs to be written, loaded by the service before rendering. */
export interface LetterRelated {
  candidate?: Candidate | null;
  /** The contract an extension extends. */
  contract?: EmploymentContract | null;
  /** Warnings a termination refers to. */
  warnings?: DisciplinaryRecord[];
  /** Every contract of the employee (certificate of service). */
  contracts?: EmploymentContract[];
}

export type RelatedNeed = 'candidate' | 'contractToExtend' | 'linkedWarnings' | 'allContracts';

export interface PlaceholderInfo { path: string; description: string; example: string }

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
  addressee: (employee: Partial<Employee> | null, data: Record<string, unknown>, related?: LetterRelated) => string[];

  // ── Optional (Phase 4). A type that leaves them out behaves like the general letter. ─
  /** Who the letter is for. Default: an employee. */
  person?: 'employee' | 'candidate';
  /** Which employees this letter makes sense for (e.g. a certificate only once employment ended). */
  appliesTo?: (employee: Partial<Employee>) => boolean;
  /** Records the service loads before rendering. */
  needs?: RelatedNeed[];
  /** The type's own placeholders (contract.*, service.* ...), built from its data and related records. */
  buildContext?: (data: Record<string, unknown>, related: LetterRelated, employee: Partial<Employee> | null) => Record<string, unknown>;
  /** The placeholders this type adds, for the template editor and HR's wording guide. */
  placeholders?: PlaceholderInfo[];
}

/** Types that can be created today; the rest show as "coming soon". */
export const REGISTRY: Partial<Record<HrDocTypeCode, DocTypeDefinition>> = {
  general_letter: generalLetter,
  offer: offerLetter,
  contract: contractLetter,
  extension: extensionLetter,
  termination: terminationLetter,
  warning: warningLetter,
  recognition: recognitionLetter,
  certificate_of_service: certificateOfService,
};

/** Who a type's letter is written for. */
export const personKindOf = (docType: HrDocTypeCode): 'employee' | 'candidate' => REGISTRY[docType]?.person ?? 'employee';

/** Whether a letter type makes sense for this employee right now (Active, or ended for a certificate). */
export function docTypeAppliesTo(docType: HrDocTypeCode, employee: Partial<Employee>): boolean {
  const def = REGISTRY[docType];
  if (!def || personKindOf(docType) !== 'employee') return false;
  return def.appliesTo ? def.appliesTo(employee) : true;
}

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
