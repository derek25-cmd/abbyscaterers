'use client';

import { useEffect, useState } from 'react';
import type { DocFormProps } from '@/components/hr/doc-forms/general-letter-form';
import { Field, Note, useFormBits } from '@/components/hr/doc-forms/form-field';
import { TERMINATION_TYPE_LABEL, WARNING_LEVEL_LABEL, formatShortDate } from '@/lib/hr-docs/types/shared';
import { isWarningInForce, listWarnings } from '@/services/hrRecordsService';
import type { DisciplinaryRecord } from '@/types';

/**
 * Termination: nothing changes when it is written. The employee stays Active
 * until the letter is approved by someone else and issued.
 */
export function TerminationForm(props: DocFormProps) {
  const { person, value, errors = {} } = props;
  const { date, number, area, choice, str, set } = useFormBits(props);
  const e = person?.employee;
  const employeeId = e?.id;
  const [warnings, setWarnings] = useState<DisciplinaryRecord[]>([]);

  useEffect(() => {
    if (!employeeId) return;
    listWarnings(employeeId).then((all) => setWarnings(all.filter((w) => isWarningInForce(w)))).catch(() => setWarnings([]));
  }, [employeeId]);

  const linked = Array.isArray(value.warningIds) ? (value.warningIds as string[]) : [];
  const toggle = (id: string) => set('warningIds', linked.includes(id) ? linked.filter((x) => x !== id) : [...linked, id]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {choice('terminationType', 'Type of termination', TERMINATION_TYPE_LABEL)}
        {number('noticePeriodDays', 'Notice period (days)', { optional: true })}
        {date('noticeDate', 'Notice date')}
        {date('lastWorkingDay', 'Last working day', { min: str('noticeDate') || undefined })}
      </div>
      {area('reason', 'Reason', { rows: 4 })}

      {warnings.length > 0 && (
        <Field id="f-warnings" label="Warnings to mention" optional error={errors.warningIds} hint="Only warnings still in force are listed.">
          <div className="space-y-1.5 rounded-md border p-2">
            {warnings.map((w) => (
              <label key={w.id} className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" checked={linked.includes(w.id)} onChange={() => toggle(w.id)} />
                {WARNING_LEVEL_LABEL[w.level]}, {formatShortDate(w.incident_date)} ({w.offence_category})
              </label>
            ))}
          </div>
        </Field>
      )}

      {area('finalDuesNote', 'Final dues', { optional: true, rows: 3, placeholder: 'e.g. Your final salary and leave pay will be paid with the October payroll.' })}

      <Note tone="warn">
        Nothing changes until this letter is <strong>approved by someone other than you</strong> and issued. When it is issued,
        {` ${e?.firstName ?? 'the employee'}`} becomes Inactive from the last working day, their active contract is marked terminated,
        and any leave booked after that day is cancelled (approved leave gives its days back).
      </Note>
    </div>
  );
}
