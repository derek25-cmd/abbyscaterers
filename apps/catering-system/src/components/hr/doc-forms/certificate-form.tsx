'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { DocFormProps } from '@/components/hr/doc-forms/general-letter-form';
import { Note } from '@/components/hr/doc-forms/form-field';
import { formatLongDate } from '@/lib/hr-docs/render';
import { deriveService, type ServiceSummary } from '@/lib/hr-docs/types/certificate_of_service';
import { listContracts } from '@/services/hrRecordsService';

/**
 * Certificate of service: nothing to type. The dates and positions come from the
 * records, shown here so HR can check them before sending.
 */
export function CertificateForm({ value, onChange, person, disabled }: DocFormProps) {
  const e = person?.employee;
  const [summary, setSummary] = useState<ServiceSummary | null>(null);

  useEffect(() => {
    if (!e) return;
    listContracts(e.id).then((k) => setSummary(deriveService(e, k))).catch(() => setSummary(deriveService(e, [])));
  }, [e]);

  if (!e) return null;
  if (!summary) return <Loader2 className="h-5 w-5 animate-spin" />;

  return (
    <div className="space-y-4">
      <dl className="grid gap-2 rounded-md border p-3 text-sm sm:grid-cols-[160px_1fr]">
        <dt className="text-muted-foreground">Service from</dt><dd>{formatLongDate(summary.startDate) || <em className="text-red-700">No start date on record</em>}</dd>
        <dt className="text-muted-foreground">Service until</dt><dd>{formatLongDate(summary.endDate)}</dd>
        <dt className="text-muted-foreground">Positions held</dt><dd>{summary.positions || <em className="text-red-700">No position on record</em>}</dd>
        <dt className="text-muted-foreground">Reason for leaving</dt><dd>{e.employmentEndReason || '—'}</dd>
      </dl>
      <div className="flex items-center justify-between rounded-md border p-3">
        <div>
          <Label htmlFor="f-includeReason">Include the reason for leaving</Label>
          <p className="text-xs text-muted-foreground">Off by default. A certificate of service usually states only the dates and positions.</p>
        </div>
        <Switch id="f-includeReason" disabled={disabled} checked={!!value.includeReason} onCheckedChange={(c) => onChange({ ...value, includeReason: c })} />
      </div>
      <Note>If anything above is wrong, correct the employee record or the contract history first; the certificate is built from them.</Note>
    </div>
  );
}
