import type { ComponentType } from 'react';
import type { HrDocTypeCode } from '@/types';
import { GeneralLetterForm, type DocFormProps } from '@/components/hr/doc-forms/general-letter-form';

/**
 * The form for each document type's own fields. Pairs with the engine-side
 * definition in lib/hr-docs/registry.ts: a new letter type adds one component
 * here and one entry there.
 */
export const DOC_FORMS: Partial<Record<HrDocTypeCode, ComponentType<DocFormProps>>> = {
  general_letter: GeneralLetterForm,
};

export type { DocFormProps };
