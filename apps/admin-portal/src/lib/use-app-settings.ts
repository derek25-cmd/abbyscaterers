'use client';

import { useQuery } from '@tanstack/react-query';
import { useSupabaseClient } from '@/lib/supabase-client';

export interface AppSettings {
  headerUrl: string | null;
  footerUrl: string | null;
  signatureUrl: string | null;
  proformaStampUrl: string | null;
  invoiceStampUrl: string | null;
  pdfScale: number;
}

interface AppSettingsRow {
  header_url: string | null;
  footer_url: string | null;
  signature_url: string | null;
  proforma_stamp_url: string | null;
  invoice_stamp_url: string | null;
  pdf_scale: number | null;
}

// Reads the same public.app_settings row catering-system's Settings page
// writes (supabase/migrations/20260901160000_app_settings.sql) — one
// shared source of branding assets for both apps' PDF exports.
export function useAppSettings() {
  const supabase = useSupabaseClient();

  return useQuery({
    queryKey: ['app-settings'],
    queryFn: async (): Promise<AppSettings> => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('header_url, footer_url, signature_url, proforma_stamp_url, invoice_stamp_url, pdf_scale')
        .eq('id', true)
        .maybeSingle();
      if (error) throw error;
      const row = data as AppSettingsRow | null;
      return {
        headerUrl: row?.header_url ?? null,
        footerUrl: row?.footer_url ?? null,
        signatureUrl: row?.signature_url ?? null,
        proformaStampUrl: row?.proforma_stamp_url ?? null,
        invoiceStampUrl: row?.invoice_stamp_url ?? null,
        pdfScale: row?.pdf_scale ?? 2.0,
      };
    },
  });
}
