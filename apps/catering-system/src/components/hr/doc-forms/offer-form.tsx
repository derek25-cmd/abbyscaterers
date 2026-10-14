'use client';

import { useEffect } from 'react';
import type { DocFormProps } from '@/components/hr/doc-forms/general-letter-form';
import { Note, useFormBits } from '@/components/hr/doc-forms/form-field';

/** Offer letter: the terms offered to a candidate. Pre-filled from the candidate's record. */
export function OfferForm(props: DocFormProps) {
  const { value, onChange, person } = props;
  const { text, date, number, area } = useFormBits(props);
  const c = person?.candidate;

  // Start from what was agreed with the candidate, once, without overwriting edits.
  useEffect(() => {
    if (!c) return;
    const next = { ...value };
    if (!value.position && c.position) next.position = c.position;
    if (!value.department && c.department) next.department = c.department;
    if ((value.salary === '' || value.salary === undefined) && c.proposed_salary) next.salary = c.proposed_salary;
    if (!value.startDate && c.proposed_start_date) next.startDate = c.proposed_start_date;
    if (JSON.stringify(next) !== JSON.stringify(value)) onChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c?.id]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {text('position', 'Position offered')}
        {text('department', 'Department', { optional: true })}
        {number('salary', 'Salary (TZS per month)', { step: '1000' })}
        {date('startDate', 'Start date')}
        {number('probationMonths', 'Probation (months)', { optional: true, hint: '0 or empty for no probation.' })}
        {text('reportingTo', 'Reports to', { optional: true })}
        {date('acceptanceDeadline', 'Reply by', { hint: 'After this date the offer expires automatically.' })}
      </div>
      {area('otherTerms', 'Other terms', { optional: true, hint: 'Leave a blank line between paragraphs.' })}
      <Note>
        Issuing this letter marks {c?.full_name ?? 'the candidate'} as <strong>offer sent</strong>. Record their answer on the
        Candidates page; once they accept you can turn them into an employee with these details filled in.
      </Note>
    </div>
  );
}
