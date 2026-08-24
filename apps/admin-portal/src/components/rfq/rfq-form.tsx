'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { RfqSchema, type RfqFormData } from '@abbyscaterers/validation';
import { BRANCHES, REGIONS } from '@abbyscaterers/types';
import { useSupabaseClient } from '@/lib/supabase-client';

// Matches the existing app's ORD-NNNNN / EVT-NNNNN convention (see
// src/services/orderService.ts) — zero-padded to 6 digits since RFQ ids
// don't inherit the ~1500-and-up floor those counters had at seed time.
function formatRfqId(n: number): string {
  return `RFQ-${String(n).padStart(6, '0')}`;
}

export function RfqForm() {
  const supabase = useSupabaseClient();
  const { user } = useUser();
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RfqFormData>({
    resolver: zodResolver(RfqSchema),
    defaultValues: { status: 'draft' },
  });

  const onSubmit = async (values: RfqFormData) => {
    setSubmitError(null);
    try {
      const { data: nextId, error: idError } = await supabase.rpc('claim_ids', {
        counter_name: 'rfq_id',
        count: 1,
      });
      if (idError) throw idError;

      const { error: insertError } = await supabase.from('rfqs').insert({
        id: formatRfqId(nextId as number),
        client_name_freetext: values.clientNameFreetext || null,
        client_id: values.clientId || null,
        title: values.title,
        description: values.description || null,
        status: values.status,
        target_event_date: values.targetEventDate || null,
        region: values.region || null,
        branch: values.branch || null,
        notes: values.notes || null,
        requested_by_id: user?.id ?? null,
      });
      if (insertError) throw insertError;

      router.push('/rfqs');
      router.refresh();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create RFQ');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-xl space-y-4">
      <div>
        <label className="text-sm font-medium">Title</label>
        <input
          {...register('title')}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder="e.g. Corporate dinner — 150 pax"
        />
        {errors.title && <p className="text-xs text-destructive mt-1">{errors.title.message}</p>}
      </div>

      <div>
        <label className="text-sm font-medium">Client (free text for now)</label>
        <input
          {...register('clientNameFreetext')}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder="Company or contact name"
        />
        {errors.clientNameFreetext && (
          <p className="text-xs text-destructive mt-1">{errors.clientNameFreetext.message}</p>
        )}
      </div>

      <div>
        <label className="text-sm font-medium">Description</label>
        <textarea
          {...register('description')}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Target event date</label>
          <input
            type="date"
            {...register('targetEventDate')}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Branch</label>
          <select
            {...register('branch')}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">—</option>
            {BRANCHES.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium">Region</label>
        <select
          {...register('region')}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">—</option>
          {REGIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-sm font-medium">Notes</label>
        <textarea
          {...register('notes')}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          rows={2}
        />
      </div>

      {submitError && <p className="text-sm text-destructive">{submitError}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        {isSubmitting ? 'Creating…' : 'Create RFQ'}
      </button>
    </form>
  );
}
