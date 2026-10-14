'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { DocFormProps } from '@/components/hr/doc-forms/general-letter-form';
import { Field, Note, useFormBits } from '@/components/hr/doc-forms/form-field';
import { CONTRACT_TYPE_LABEL } from '@/lib/hr-docs/types/shared';
import { formatLongDate, formatMoney } from '@/lib/hr-docs/render';
import { listActiveContracts } from '@/services/hrRecordsService';
import type { EmploymentContract } from '@/types';

const nextDay = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

/** Contract extension: only the employee's ACTIVE contracts with an end date can be extended. */
export function ExtensionForm(props: DocFormProps) {
  const { person, errors = {} } = props;
  const { date, number, area, str, set } = useFormBits(props);
  const e = person?.employee;
  const [contracts, setContracts] = useState<EmploymentContract[] | null>(null);

  useEffect(() => {
    if (!e) return;
    listActiveContracts(e.id)
      .then((rows) => {
        const extendable = rows.filter((c) => !!c.end_date);
        setContracts(extendable);
        if (extendable.length === 1 && !str('contractId')) set('contractId', extendable[0].id);
      })
      .catch(() => setContracts([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [e?.id]);

  const chosen = contracts?.find((c) => c.id === str('contractId'));

  if (contracts === null) return <Loader2 className="h-5 w-5 animate-spin" />;
  if (contracts.length === 0) {
    return (
      <Note tone="warn">
        {e?.firstName ?? 'This employee'} has no active fixed-term contract to extend. If they have a contract on paper, record it first
        on their profile (Contracts → Record existing contract), then come back.
      </Note>
    );
  }

  return (
    <div className="space-y-4">
      <Field id="f-contractId" label="Contract being extended" error={errors.contractId}>
        <div className="space-y-2" role="radiogroup">
          {contracts.map((c) => (
            <label key={c.id} className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm ${c.id === str('contractId') ? 'border-primary bg-primary/5' : ''}`}>
              <input type="radio" name="contractId" className="mt-1" checked={c.id === str('contractId')} onChange={() => set('contractId', c.id)} />
              <span>
                <span className="font-medium">{CONTRACT_TYPE_LABEL[c.contract_type]} · {c.position ?? 'no position recorded'}</span>
                <span className="block text-muted-foreground">{formatLongDate(c.start_date)} to {formatLongDate(c.end_date)}{c.salary ? ` · ${formatMoney(c.salary)} per month` : ''}</span>
              </span>
            </label>
          ))}
        </div>
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        {date('newEndDate', 'New end date', { min: chosen?.end_date ? nextDay(chosen.end_date) : undefined, hint: chosen?.end_date ? `Must be after ${formatLongDate(chosen.end_date)}.` : undefined })}
        {number('newSalary', 'New salary (TZS per month)', { optional: true, step: '1000', hint: 'Leave empty to keep the current salary.' })}
      </div>
      {area('reason', 'Reason for the extension', { rows: 3 })}
      <Note>
        Issuing this letter marks the current contract as <strong>extended</strong> and starts a new one the day after it ends,
        so the contract history stays a visible chain.
      </Note>
    </div>
  );
}
