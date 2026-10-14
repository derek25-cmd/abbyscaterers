import type { ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { DocFormProps } from '@/components/hr/doc-forms/general-letter-form';

/** Label, control, an optional hint and the field's error, laid out the same way in every letter form. */
export function Field({ id, label, hint, error, optional, children }: {
  id: string; label: string; hint?: ReactNode; error?: string; optional?: boolean; children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}{optional && <span className="font-normal text-muted-foreground"> (optional)</span>}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}

/** Small helpers bound to one form's value/onChange, so each form reads plainly. */
export function useFormBits({ value, onChange, errors = {}, disabled }: DocFormProps) {
  const str = (k: string) => (value[k] === undefined || value[k] === null ? '' : String(value[k]));
  const set = (k: string, v: unknown) => onChange({ ...value, [k]: v });
  const text = (k: string, label: string, opts: { optional?: boolean; hint?: ReactNode; placeholder?: string } = {}) => (
    <Field id={`f-${k}`} label={label} optional={opts.optional} hint={opts.hint} error={errors[k]}>
      <Input id={`f-${k}`} disabled={disabled} value={str(k)} placeholder={opts.placeholder} onChange={(e) => set(k, e.target.value)} />
    </Field>
  );
  const date = (k: string, label: string, opts: { min?: string; max?: string; hint?: ReactNode; optional?: boolean } = {}) => (
    <Field id={`f-${k}`} label={label} optional={opts.optional} hint={opts.hint} error={errors[k]}>
      <Input id={`f-${k}`} type="date" disabled={disabled} value={str(k)} min={opts.min} max={opts.max} onChange={(e) => set(k, e.target.value)} />
    </Field>
  );
  const number = (k: string, label: string, opts: { optional?: boolean; hint?: ReactNode; step?: string } = {}) => (
    <Field id={`f-${k}`} label={label} optional={opts.optional} hint={opts.hint} error={errors[k]}>
      <Input id={`f-${k}`} type="number" inputMode="decimal" min={0} step={opts.step ?? '1'} disabled={disabled} value={str(k)}
        onChange={(e) => set(k, e.target.value === '' ? '' : Number(e.target.value))} />
    </Field>
  );
  const area = (k: string, label: string, opts: { optional?: boolean; hint?: ReactNode; rows?: number; placeholder?: string } = {}) => (
    <Field id={`f-${k}`} label={label} optional={opts.optional} hint={opts.hint} error={errors[k]}>
      <Textarea id={`f-${k}`} rows={opts.rows ?? 4} disabled={disabled} value={str(k)} placeholder={opts.placeholder} onChange={(e) => set(k, e.target.value)} />
    </Field>
  );
  const choice = (k: string, label: string, options: Record<string, string>, opts: { hint?: ReactNode } = {}) => (
    <Field id={`f-${k}`} label={label} hint={opts.hint} error={errors[k]}>
      <Select value={str(k)} onValueChange={(v) => set(k, v)} disabled={disabled}>
        <SelectTrigger id={`f-${k}`}><SelectValue placeholder="Choose" /></SelectTrigger>
        <SelectContent>{Object.entries(options).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
      </Select>
    </Field>
  );
  return { str, set, text, date, number, area, choice };
}

/** A grey note box, for explaining what issuing the letter will do. */
export function Note({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warn' }) {
  return (
    <div className={`rounded-md border p-3 text-sm ${tone === 'warn' ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-blue-200 bg-blue-50 text-blue-900'}`}>
      {children}
    </div>
  );
}
