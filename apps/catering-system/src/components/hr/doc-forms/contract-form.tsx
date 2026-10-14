'use client';

import { useEffect, useState } from 'react';
import type { DocFormProps } from '@/components/hr/doc-forms/general-letter-form';
import { Note, useFormBits } from '@/components/hr/doc-forms/form-field';
import { CONTRACT_TYPE_LABEL } from '@/lib/hr-docs/types/shared';
import { formatLongDate } from '@/lib/hr-docs/render';
import { listActiveContracts } from '@/services/hrRecordsService';
import type { EmploymentContract } from '@/types';

/** Employment contract: the terms. Issuing it creates the employee's active contract. */
export function ContractForm(props: DocFormProps) {
  const { value, onChange, person } = props;
  const { text, date, number, area, choice, str } = useFormBits(props);
  const e = person?.employee;
  const [active, setActive] = useState<EmploymentContract | null>(null);

  useEffect(() => {
    if (!e) return;
    listActiveContracts(e.id).then((rows) => setActive(rows[0] ?? null)).catch(() => setActive(null));
    // Start from the employee record, once, without overwriting edits.
    const next = { ...value };
    if (!value.position && e.role) next.position = e.role;
    if ((value.salary === '' || value.salary === undefined) && e.monthlySalary) next.salary = e.monthlySalary;
    if (JSON.stringify(next) !== JSON.stringify(value)) onChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [e?.id]);

  const permanent = str('contractType') === 'permanent';

  return (
    <div className="space-y-4">
      {active && (
        <Note tone="warn">
          {e?.firstName} already has an active {CONTRACT_TYPE_LABEL[active.contract_type].toLowerCase()} contract
          {active.end_date ? ` ending ${formatLongDate(active.end_date)}` : ''}. A new contract cannot be issued while it is active:
          prepare an <strong>extension</strong> instead, or wait until it ends.
        </Note>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {choice('contractType', 'Contract type', CONTRACT_TYPE_LABEL)}
        {text('position', 'Position')}
        {date('startDate', 'Start date')}
        {permanent
          ? <p className="self-end pb-2 text-sm text-muted-foreground">A permanent contract has no end date.</p>
          : date('endDate', 'End date', { min: str('startDate') || undefined })}
        {number('salary', 'Salary (TZS per month)', { step: '1000' })}
        {number('probationMonths', 'Probation (months)', { optional: true })}
        {number('noticeDays', 'Notice period (days)', { optional: true })}
        {text('workingHours', 'Working hours', { optional: true, placeholder: 'e.g. Monday to Saturday, 8:00 to 17:00' })}
      </div>
      {area('otherTerms', 'Other terms', { optional: true, hint: 'Leave a blank line between paragraphs.' })}
      <Note>Issuing this letter records it as {e?.firstName ?? 'the employee'}&apos;s active contract. Reminders are sent 60, 30 and 7 days before it ends.</Note>
    </div>
  );
}
