import { supabase } from '@/lib/supabase-client';
import { TaxRateSchema, type TaxRateFormData } from '@/lib/schemas';
import { validate } from '@/lib/service-validation';
import type { TaxRates } from '@/lib/payrollEngine';

interface TaxRateRow {
  id: string;
  effective_from: string;
  effective_to: string | null;
  paye_bands: TaxRates['payeBands'];
  nssf_employee_rate: number;
  nssf_employer_rate: number;
  sdl_rate: number;
  wcf_rate: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const mapRowToTaxRates = (row: TaxRateRow): TaxRates => ({
  id: row.id,
  payeBands: row.paye_bands,
  nssfEmployeeRate: Number(row.nssf_employee_rate),
  nssfEmployerRate: Number(row.nssf_employer_rate),
  sdlRate: Number(row.sdl_rate),
  wcfRate: Number(row.wcf_rate),
});

/** The currently-active rate set (effective_to IS NULL, most recent effective_from). */
export const getActiveTaxRates = async (): Promise<TaxRates | null> => {
  const { data, error } = await supabase
    .from('tax_rates')
    .select('*')
    .is('effective_to', null)
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching active tax rates:', error.message);
    return null;
  }
  return data ? mapRowToTaxRates(data as TaxRateRow) : null;
};

export const getAllTaxRates = async (): Promise<(TaxRates & { effectiveFrom: string; effectiveTo: string | null; notes: string | null })[]> => {
  const { data, error } = await supabase
    .from('tax_rates')
    .select('*')
    .order('effective_from', { ascending: false });

  if (error) {
    console.error('Error fetching tax rates:', error.message);
    return [];
  }
  return (data as TaxRateRow[]).map((row) => ({
    ...mapRowToTaxRates(row),
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    notes: row.notes,
  }));
};

/**
 * Adds a new rate version and closes out the currently-active one (sets its
 * effective_to to the day before the new version starts), so there's always
 * at most one active version — historical payslips keep pointing at the
 * closed-out version via payroll.tax_rate_version_id.
 */
export const addTaxRate = async (input: TaxRateFormData): Promise<string> => {
  const validated = validate(TaxRateSchema, input);

  const { data: current } = await supabase
    .from('tax_rates')
    .select('id, effective_from')
    .is('effective_to', null)
    .maybeSingle();

  if (current) {
    const dayBefore = new Date(validated.effectiveFrom);
    dayBefore.setDate(dayBefore.getDate() - 1);
    const { error: closeError } = await supabase
      .from('tax_rates')
      .update({ effective_to: dayBefore.toISOString().slice(0, 10) })
      .eq('id', current.id);
    if (closeError) throw new Error(closeError.message);
  }

  const { data, error } = await supabase
    .from('tax_rates')
    .insert([{
      effective_from: validated.effectiveFrom,
      effective_to: validated.effectiveTo ?? null,
      paye_bands: validated.payeBands,
      nssf_employee_rate: validated.nssfEmployeeRate,
      nssf_employer_rate: validated.nssfEmployerRate,
      sdl_rate: validated.sdlRate,
      wcf_rate: validated.wcfRate,
      notes: validated.notes ?? null,
    }])
    .select('id')
    .single();

  if (error) throw new Error(error.message);
  return data.id;
};

export const updateTaxRate = async (id: string, input: Partial<TaxRateFormData>): Promise<boolean> => {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.effectiveFrom !== undefined) update.effective_from = input.effectiveFrom;
  if (input.effectiveTo !== undefined) update.effective_to = input.effectiveTo;
  if (input.payeBands !== undefined) update.paye_bands = input.payeBands;
  if (input.nssfEmployeeRate !== undefined) update.nssf_employee_rate = input.nssfEmployeeRate;
  if (input.nssfEmployerRate !== undefined) update.nssf_employer_rate = input.nssfEmployerRate;
  if (input.sdlRate !== undefined) update.sdl_rate = input.sdlRate;
  if (input.wcfRate !== undefined) update.wcf_rate = input.wcfRate;
  if (input.notes !== undefined) update.notes = input.notes;

  const { error } = await supabase.from('tax_rates').update(update).eq('id', id);
  if (error) {
    console.error('Error updating tax rate:', error.message);
    return false;
  }
  return true;
};
