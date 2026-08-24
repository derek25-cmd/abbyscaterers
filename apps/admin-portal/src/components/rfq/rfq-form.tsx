'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { format, eachDayOfInterval, parseISO, isValid } from 'date-fns';
import { RfqSchema, type RfqFormData } from '@abbyscaterers/validation';
import { REGIONS, MEAL_TYPES } from '@abbyscaterers/types';
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
  const [uniformPax, setUniformPax] = useState<number>(1);
  const [uniformMealType, setUniformMealType] = useState<string>(MEAL_TYPES[0]);

  // Mirrors the plain <Select> populated from a full client list that
  // apps/catering-system/src/components/proforma-invoices/proforma-invoice-form.tsx
  // uses for its own "BILLED TO (CLIENT)" field — the client list is small
  // enough that a search/combobox isn't needed there, so it isn't here
  // either. Needs the portal_read_clients RLS policy (20260901050000).
  const { data: clients } = useQuery({
    queryKey: ['clients-for-rfq'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, companyName')
        .order('companyName', { ascending: true });
      if (error) throw error;
      return data as { id: string; companyName: string }[];
    },
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RfqFormData>({
    resolver: zodResolver(RfqSchema),
    defaultValues: {
      samePaxAllDates: true,
      paxPerDay: [],
      sameMealTypeAllDates: true,
      mealTypePerDay: [],
      vatType: 'inclusive',
    },
  });

  const serviceStartDate = watch('serviceStartDate');
  const serviceEndDate = watch('serviceEndDate');
  const samePaxAllDates = watch('samePaxAllDates');
  const paxPerDay = watch('paxPerDay') || [];
  const sameMealTypeAllDates = watch('sameMealTypeAllDates');
  const mealTypePerDay = watch('mealTypePerDay') || [];

  // Recompute the day list whenever the service period changes, preserving
  // already-entered pax values for dates still in range and seeding new
  // ones from the uniform value (or 1) — deliberately not reacting to
  // paxPerDay/uniformPax/samePaxAllDates themselves, or editing one day's
  // value would retrigger this and clobber the others.
  useEffect(() => {
    if (!serviceStartDate || !serviceEndDate) return;
    const start = parseISO(serviceStartDate);
    const end = parseISO(serviceEndDate);
    if (!isValid(start) || !isValid(end) || end < start) return;

    const days = eachDayOfInterval({ start, end }).map((d) => format(d, 'yyyy-MM-dd'));
    const existing = new Map(paxPerDay.map((p) => [p.date, p.pax]));
    const next = days.map((date) => ({
      date,
      pax: existing.get(date) ?? uniformPax,
    }));
    setValue('paxPerDay', next, { shouldValidate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceStartDate, serviceEndDate]);

  // Same recompute, independently, for meal type per day.
  useEffect(() => {
    if (!serviceStartDate || !serviceEndDate) return;
    const start = parseISO(serviceStartDate);
    const end = parseISO(serviceEndDate);
    if (!isValid(start) || !isValid(end) || end < start) return;

    const days = eachDayOfInterval({ start, end }).map((d) => format(d, 'yyyy-MM-dd'));
    const existing = new Map(mealTypePerDay.map((m) => [m.date, m.mealType]));
    const next = days.map((date) => ({
      date,
      mealType: existing.get(date) ?? uniformMealType,
    }));
    setValue('mealTypePerDay', next, { shouldValidate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceStartDate, serviceEndDate]);

  // When "same pax for all dates" is checked, keep every day in sync with
  // the single uniform input as it changes.
  useEffect(() => {
    if (!samePaxAllDates || paxPerDay.length === 0) return;
    setValue(
      'paxPerDay',
      paxPerDay.map((p) => ({ ...p, pax: uniformPax })),
      { shouldValidate: false }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [samePaxAllDates, uniformPax]);

  // Same sync, independently, for meal type.
  useEffect(() => {
    if (!sameMealTypeAllDates || mealTypePerDay.length === 0) return;
    setValue(
      'mealTypePerDay',
      mealTypePerDay.map((m) => ({ ...m, mealType: uniformMealType })),
      { shouldValidate: false }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sameMealTypeAllDates, uniformMealType]);

  const onSubmit = async (values: RfqFormData) => {
    setSubmitError(null);
    try {
      const { data: nextId, error: idError } = await supabase.rpc('claim_ids', {
        counter_name: 'rfq_id',
        count: 1,
      });
      if (idError) throw idError;

      const client = clients?.find((c) => c.id === values.clientId);

      const { error: insertError } = await supabase.from('rfqs').insert({
        id: formatRfqId(nextId as number),
        client_id: values.clientId,
        title: `${client?.companyName ?? values.clientId} — ${values.serviceStartDate} to ${values.serviceEndDate}`,
        status: 'draft',
        service_start_date: values.serviceStartDate,
        service_end_date: values.serviceEndDate,
        proforma_required_by: values.proformaRequiredBy || null,
        same_pax_all_dates: values.samePaxAllDates,
        pax_per_day: values.paxPerDay,
        same_meal_type_all_dates: values.sameMealTypeAllDates,
        meal_type_per_day: values.mealTypePerDay,
        rate_per_plate: values.ratePerPlate,
        vat_type: values.vatType,
        location: values.location,
        region: values.region,
        requested_by_id: user?.id ?? null,
      });
      if (insertError) throw insertError;

      router.push(`/rfqs/${formatRfqId(nextId as number)}`);
      router.refresh();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create RFQ');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-6">
      <div>
        <label className="text-sm font-medium">Name of Client</label>
        <select
          {...register('clientId')}
          defaultValue=""
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="" disabled>
            Select client
          </option>
          {(clients ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.companyName}
            </option>
          ))}
        </select>
        {errors.clientId && <p className="text-xs text-destructive mt-1">{errors.clientId.message}</p>}
      </div>

      <div>
        <label className="text-sm font-medium mb-1 block">Service Period</label>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-foreground">Start date</label>
            <input
              type="date"
              {...register('serviceStartDate')}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">End date</label>
            <input
              type="date"
              {...register('serviceEndDate')}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>
        {errors.serviceStartDate && (
          <p className="text-xs text-destructive mt-1">{errors.serviceStartDate.message}</p>
        )}
        {errors.serviceEndDate && (
          <p className="text-xs text-destructive mt-1">{errors.serviceEndDate.message}</p>
        )}
      </div>

      <div>
        <label className="text-sm font-medium">Date the Proforma is Required By</label>
        <input
          type="date"
          {...register('proformaRequiredBy')}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="samePax"
            checked={samePaxAllDates}
            onChange={(e) => setValue('samePaxAllDates', e.target.checked)}
          />
          <label htmlFor="samePax" className="text-sm font-medium">
            Same pax for all dates
          </label>
        </div>

        {samePaxAllDates ? (
          <div>
            <label className="text-xs text-muted-foreground">No. of pax</label>
            <input
              type="number"
              min={1}
              value={uniformPax}
              onChange={(e) => setUniformPax(Number(e.target.value) || 1)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        ) : (
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">No. of pax per day</label>
            {paxPerDay.length === 0 && (
              <p className="text-xs text-muted-foreground">Set the service period above first.</p>
            )}
            {paxPerDay.map((entry, i) => (
              <div key={entry.date} className="flex items-center gap-3">
                <span className="w-28 text-xs text-muted-foreground">{entry.date}</span>
                <input
                  type="number"
                  min={1}
                  value={entry.pax}
                  onChange={(e) => {
                    const next = [...paxPerDay];
                    next[i] = { ...next[i], pax: Number(e.target.value) || 1 };
                    setValue('paxPerDay', next, { shouldValidate: false });
                  }}
                  className="w-28 rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            ))}
          </div>
        )}
        {errors.paxPerDay && (
          <p className="text-xs text-destructive mt-1">
            {(errors.paxPerDay as { message?: string }).message ?? 'Pax entries are invalid.'}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="sameMealType"
            checked={sameMealTypeAllDates}
            onChange={(e) => setValue('sameMealTypeAllDates', e.target.checked)}
          />
          <label htmlFor="sameMealType" className="text-sm font-medium">
            Same meal type for all dates
          </label>
        </div>

        {sameMealTypeAllDates ? (
          <div>
            <label className="text-xs text-muted-foreground">Type of meal</label>
            <select
              value={uniformMealType}
              onChange={(e) => setUniformMealType(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {MEAL_TYPES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Type of meal per day</label>
            {mealTypePerDay.length === 0 && (
              <p className="text-xs text-muted-foreground">Set the service period above first.</p>
            )}
            {mealTypePerDay.map((entry, i) => (
              <div key={entry.date} className="flex items-center gap-3">
                <span className="w-28 text-xs text-muted-foreground">{entry.date}</span>
                <select
                  value={entry.mealType}
                  onChange={(e) => {
                    const next = [...mealTypePerDay];
                    next[i] = { ...next[i], mealType: e.target.value };
                    setValue('mealTypePerDay', next, { shouldValidate: false });
                  }}
                  className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {MEAL_TYPES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}
        {errors.mealTypePerDay && (
          <p className="text-xs text-destructive mt-1">
            {(errors.mealTypePerDay as { message?: string }).message ?? 'Meal type entries are invalid.'}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Rate per Plate (TZS)</label>
          <input
            type="number"
            min={0}
            step="0.01"
            {...register('ratePerPlate', { valueAsNumber: true })}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          {errors.ratePerPlate && (
            <p className="text-xs text-destructive mt-1">{errors.ratePerPlate.message}</p>
          )}
        </div>
        <div>
          <label className="text-sm font-medium">VAT</label>
          <select
            {...register('vatType')}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="inclusive">Inclusive</option>
            <option value="exclusive">Exclusive</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Location of Order</label>
          <input
            {...register('location')}
            placeholder="e.g. Serena Hotel, Dar es Salaam"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          {errors.location && <p className="text-xs text-destructive mt-1">{errors.location.message}</p>}
        </div>
        <div>
          <label className="text-sm font-medium">Region</label>
          <select
            {...register('region')}
            defaultValue=""
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="" disabled>
              Select region
            </option>
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          {errors.region && <p className="text-xs text-destructive mt-1">{errors.region.message}</p>}
        </div>
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
