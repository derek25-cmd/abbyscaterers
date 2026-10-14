import { z } from 'zod';
import type { DocTypeDefinition } from '@/lib/hr-docs/registry';
import { OMIT, formatMoney } from '@/lib/hr-docs/render';
import { defaultAddresseeLines } from './general_letter';
import {
  RECOGNITION_CATEGORY_LABEL, REWARD_TYPE_LABEL, addresseeOverride, isActiveEmployee, optionalNumber,
  recognitionCategories, rewardTypes,
} from './shared';

/** Recognition / reward (report 2.6). A cash reward waits in "pending cash rewards" for payroll. */
export const RecognitionSchema = z
  .object({
    category: z.enum(recognitionCategories, { required_error: 'Choose the category' }),
    reason: z.string().trim().min(1, 'Say what is being recognised'),
    rewardType: z.enum(rewardTypes, { required_error: 'Choose the reward' }),
    amount: optionalNumber('The amount'),
    addressee: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.rewardType === 'cash' && !(typeof v.amount === 'number' && v.amount > 0)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['amount'], message: 'Enter the cash amount' });
    }
  });

export const recognitionLetter: DocTypeDefinition = {
  docType: 'recognition',
  schema: RecognitionSchema,
  appliesTo: isActiveEmployee,
  defaults: () => ({ category: 'performance', reason: '', rewardType: 'none', amount: '' }),
  defaultSubject: 'Letter of recognition',
  sampleData: {
    category: 'customer_praise', reason: 'A client wrote to thank you for the service at their wedding on 3 October.',
    rewardType: 'cash', amount: 100000,
  },
  addressee: (employee, data) => addresseeOverride(data) ?? defaultAddresseeLines(employee),
  buildContext: (data) => {
    const category = data.category as keyof typeof RECOGNITION_CATEGORY_LABEL;
    const reward = data.rewardType as keyof typeof REWARD_TYPE_LABEL;
    const amount = formatMoney(data.amount);
    return {
      reward: {
        category: RECOGNITION_CATEGORY_LABEL[category] ?? data.category,
        type: REWARD_TYPE_LABEL[reward] ?? data.rewardType,
        // A cash reward must state its amount; other rewards print it only if one was entered.
        amount: reward === 'cash' ? amount : (amount ?? OMIT),
        reason: data.reason,
      },
    };
  },
  placeholders: [
    { path: 'reward.category', description: 'What is recognised', example: 'Customer praise' },
    { path: 'reward.reason', description: 'Why (use {{{reward.reason}}} on its own line)', example: 'A client wrote to thank you.' },
    { path: 'reward.type', description: 'The reward', example: 'Cash reward' },
    { path: 'reward.amount', description: 'Amount (always for cash; blank otherwise unless entered)', example: 'TZS 100,000' },
  ],
};
