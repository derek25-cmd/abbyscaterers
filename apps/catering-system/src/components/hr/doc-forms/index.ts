import type { ComponentType } from 'react';
import type { HrDocTypeCode } from '@/types';
import { GeneralLetterForm, type DocFormProps } from '@/components/hr/doc-forms/general-letter-form';
import { OfferForm } from '@/components/hr/doc-forms/offer-form';
import { ContractForm } from '@/components/hr/doc-forms/contract-form';
import { ExtensionForm } from '@/components/hr/doc-forms/extension-form';
import { TerminationForm } from '@/components/hr/doc-forms/termination-form';
import { WarningForm } from '@/components/hr/doc-forms/warning-form';
import { RecognitionForm } from '@/components/hr/doc-forms/recognition-form';
import { CertificateForm } from '@/components/hr/doc-forms/certificate-form';

/**
 * The form for each document type's own fields. Pairs with the engine-side
 * definition in lib/hr-docs/registry.ts: a new letter type adds one component
 * here and one entry there.
 */
export const DOC_FORMS: Partial<Record<HrDocTypeCode, ComponentType<DocFormProps>>> = {
  general_letter: GeneralLetterForm,
  offer: OfferForm,
  contract: ContractForm,
  extension: ExtensionForm,
  termination: TerminationForm,
  warning: WarningForm,
  recognition: RecognitionForm,
  certificate_of_service: CertificateForm,
};

export type { DocFormProps };
