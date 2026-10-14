import { supabase } from '@/lib/supabase-client';
import type { CompanyDetails } from '@/lib/hr-docs/render';

// Company details live on the shared app_settings row and are printed on HR
// letters. Reads are open to staff; writes are limited to an Admin by a trigger
// (20261014001100), so a refusal here is a real permission error, not a glitch.

export const getCompanyDetails = async (): Promise<Required<{ [K in keyof CompanyDetails]: string }>> => {
  const { data, error } = await supabase
    .from('app_settings')
    .select('company_name, company_address, company_phone, company_email, company_tin, company_vrn')
    .eq('id', true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return {
    name: data?.company_name ?? '', address: data?.company_address ?? '', phone: data?.company_phone ?? '',
    email: data?.company_email ?? '', tin: data?.company_tin ?? '', vrn: data?.company_vrn ?? '',
  };
};

export const saveCompanyDetails = async (details: CompanyDetails): Promise<void> => {
  if (!details.name?.trim()) throw new Error('The company name cannot be empty: it is printed on every letter.');
  const { data, error } = await supabase
    .from('app_settings')
    .update({
      company_name: details.name.trim(),
      company_address: details.address?.trim() || null,
      company_phone: details.phone?.trim() || null,
      company_email: details.email?.trim() || null,
      company_tin: details.tin?.trim() || null,
      company_vrn: details.vrn?.trim() || null,
    })
    .eq('id', true)
    .select('id');
  if (error) {
    throw new Error(error.code === '42501' ? 'Only an Admin can change the company details.' : error.message);
  }
  if (!data?.length) throw new Error('The company details were not saved. You may not have permission.');
};
