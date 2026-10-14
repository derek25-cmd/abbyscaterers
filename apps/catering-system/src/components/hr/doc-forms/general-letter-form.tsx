'use client';

import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { Candidate, Employee } from '@/types';

export interface DocFormProps {
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  /** Field errors from the type's schema, keyed by field name. */
  errors?: Record<string, string>;
  disabled?: boolean;
  /** Who the letter is for, so a form can check current records (Phase 4). The general letter ignores it. */
  person?: { employee?: Employee | null; candidate?: Candidate | null };
}

/** The type-specific part of a general letter: who it is addressed to (optional) and what it says. */
export function GeneralLetterForm({ value, onChange, errors = {}, disabled }: DocFormProps) {
  const set = (key: string, v: string) => onChange({ ...value, [key]: v });
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="gl-body">What the letter says</Label>
        <Textarea
          id="gl-body" rows={11} disabled={disabled}
          value={(value.body as string) ?? ''}
          onChange={(e) => set('body', e.target.value)}
          placeholder="Write the letter here. The greeting (Dear …) and the closing are added for you."
          aria-invalid={!!errors.body}
        />
        <p className="text-xs text-muted-foreground">
          Leave a blank line between paragraphs. Put **two stars** around words to make them bold. You can use details such as
          {' {{employee.fullName}} or {{employee.position}}'}, which are filled in from the employee&apos;s record.
        </p>
        {errors.body && <p className="text-sm text-red-700">{errors.body}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="gl-addressee">Addressee <span className="font-normal text-muted-foreground">(optional)</span></Label>
        <Textarea
          id="gl-addressee" rows={3} disabled={disabled}
          value={(value.addressee as string) ?? ''}
          onChange={(e) => set('addressee', e.target.value)}
          placeholder="Leave empty to address the employee. Otherwise one line per line, e.g. The Manager, Bank X, Dar es Salaam"
        />
      </div>
    </div>
  );
}
