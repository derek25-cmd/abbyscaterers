'use client';

import type { DocFormProps } from '@/components/hr/doc-forms/general-letter-form';
import { Note, useFormBits } from '@/components/hr/doc-forms/form-field';
import { RECOGNITION_CATEGORY_LABEL, REWARD_TYPE_LABEL } from '@/lib/hr-docs/types/shared';

/** Recognition / reward. A cash reward is listed for payroll; payroll itself is not changed. */
export function RecognitionForm(props: DocFormProps) {
  const { area, choice, number, str } = useFormBits(props);
  const cash = str('rewardType') === 'cash';
  const reward = str('rewardType');
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {choice('category', 'What is being recognised', RECOGNITION_CATEGORY_LABEL)}
        {choice('rewardType', 'Reward', REWARD_TYPE_LABEL)}
        {(cash || (reward && reward !== 'none')) && number('amount', cash ? 'Cash amount (TZS)' : 'Value (TZS)', { optional: !cash, step: '1000' })}
      </div>
      {area('reason', 'Why', { rows: 4, placeholder: 'What the employee did, in a sentence or two.' })}
      {cash && (
        <Note>
          A cash reward is <strong>not</strong> added to payroll automatically. Once the letter is issued it appears under
          “Pending cash rewards” on the Payroll page, where it is marked paid in the payroll that pays it.
        </Note>
      )}
    </div>
  );
}
