'use client';

import { useEffect, useRef } from 'react';
import type { DocFormProps } from '@/components/hr/doc-forms/general-letter-form';
import { Field, Note, useFormBits } from '@/components/hr/doc-forms/form-field';
import { Input } from '@/components/ui/input';
import { WARNING_LEVEL_LABEL } from '@/lib/hr-docs/types/shared';
import { defaultWarningExpiry } from '@/lib/hr-docs/types/warning';
import { todayInDar } from '@/services/hrDocumentService';

const OFFENCES = ['Lateness', 'Absence without permission', 'Misconduct', 'Poor performance', 'Food safety or hygiene', 'Health and safety', 'Insubordination', 'Theft or dishonesty'];

/** Warning letter. Issuing it creates a confidential disciplinary record; it needs a different approver. */
export function WarningForm(props: DocFormProps) {
  const { errors = {}, disabled } = props;
  const { date, area, choice, str, set } = useFormBits(props);
  // The expiry follows the incident date (+12 months) until HR changes it by hand.
  const autoExpiry = useRef(true);

  useEffect(() => {
    if (autoExpiry.current && str('incidentDate')) set('expiresOn', defaultWarningExpiry(str('incidentDate')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [str('incidentDate')]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {choice('level', 'Level', WARNING_LEVEL_LABEL)}
        <Field id="f-offenceCategory" label="Offence" error={errors.offenceCategory}>
          <Input id="f-offenceCategory" list="offence-list" disabled={disabled} value={str('offenceCategory')} onChange={(e) => set('offenceCategory', e.target.value)} placeholder="Type or choose" />
          <datalist id="offence-list">{OFFENCES.map((o) => <option key={o} value={o} />)}</datalist>
        </Field>
        {date('incidentDate', 'Date of the incident', { max: todayInDar() })}
        <Field id="f-expiresOn" label="Stays on file until" hint="12 months after the incident unless you change it." error={errors.expiresOn}>
          <Input id="f-expiresOn" type="date" disabled={disabled} value={str('expiresOn')} min={str('incidentDate') || undefined}
            onChange={(e) => { autoExpiry.current = false; set('expiresOn', e.target.value); }} />
        </Field>
      </div>
      {area('description', 'What happened', { rows: 4 })}
      {area('actionRequired', 'What must change', { optional: true, rows: 3 })}
      <Note>
        A warning is confidential: only the HR Manager, General Manager and Admin can see it. It must be approved by someone other
        than you. After the date above it stops counting as active, but stays on file.
      </Note>
    </div>
  );
}
