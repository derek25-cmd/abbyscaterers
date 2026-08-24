'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase-client';

export interface AppSettings {
    loginImageUrl?: string;
    headerUrl?: string;
    footerUrl?: string;
    signatureUrl?: string;
    proformaStampUrl?: string;
    invoiceStampUrl?: string;
    nextOrderNumber?: number;
    nextProformaNumber?: string;
    nextInvoiceNumber?: string;
    pdfScale?: number;
}

const defaultSettings: AppSettings = {
    loginImageUrl: "https://picsum.photos/seed/catering/1200/1800",
    headerUrl: "",
    footerUrl: "",
    signatureUrl: "",
    proformaStampUrl: "",
    invoiceStampUrl: "",
    nextOrderNumber: 1,
    nextProformaNumber: "00001",
    nextInvoiceNumber: "00001",
    pdfScale: 2.0,
}

// Row shape is snake_case (public.app_settings,
// supabase/migrations/20260901160000_app_settings.sql); AppSettings stays
// camelCase since every existing consumer (proforma/invoice templates, the
// Settings page) already depends on that shape.
interface AppSettingsRow {
    login_image_url: string | null;
    header_url: string | null;
    footer_url: string | null;
    signature_url: string | null;
    proforma_stamp_url: string | null;
    invoice_stamp_url: string | null;
    next_order_number: number | null;
    next_proforma_number: string | null;
    next_invoice_number: string | null;
    pdf_scale: number | null;
}

function rowToSettings(row: AppSettingsRow): AppSettings {
    return {
        loginImageUrl: row.login_image_url ?? defaultSettings.loginImageUrl,
        headerUrl: row.header_url ?? '',
        footerUrl: row.footer_url ?? '',
        signatureUrl: row.signature_url ?? '',
        proformaStampUrl: row.proforma_stamp_url ?? '',
        invoiceStampUrl: row.invoice_stamp_url ?? '',
        nextOrderNumber: row.next_order_number ?? defaultSettings.nextOrderNumber,
        nextProformaNumber: row.next_proforma_number ?? defaultSettings.nextProformaNumber,
        nextInvoiceNumber: row.next_invoice_number ?? defaultSettings.nextInvoiceNumber,
        pdfScale: row.pdf_scale ?? defaultSettings.pdfScale,
    };
}

function settingsToRow(settings: Partial<AppSettings>): Partial<AppSettingsRow> {
    const row: Partial<AppSettingsRow> = {};
    if (settings.loginImageUrl !== undefined) row.login_image_url = settings.loginImageUrl;
    if (settings.headerUrl !== undefined) row.header_url = settings.headerUrl;
    if (settings.footerUrl !== undefined) row.footer_url = settings.footerUrl;
    if (settings.signatureUrl !== undefined) row.signature_url = settings.signatureUrl;
    if (settings.proformaStampUrl !== undefined) row.proforma_stamp_url = settings.proformaStampUrl;
    if (settings.invoiceStampUrl !== undefined) row.invoice_stamp_url = settings.invoiceStampUrl;
    if (settings.nextOrderNumber !== undefined) row.next_order_number = settings.nextOrderNumber;
    if (settings.nextProformaNumber !== undefined) row.next_proforma_number = settings.nextProformaNumber;
    if (settings.nextInvoiceNumber !== undefined) row.next_invoice_number = settings.nextInvoiceNumber;
    if (settings.pdfScale !== undefined) row.pdf_scale = settings.pdfScale;
    return row;
}

export function useSettingsStorage() {
    const [settings, setSettings] = useState<AppSettings>(defaultSettings);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        supabase
            .from('app_settings')
            .select(
                'login_image_url, header_url, footer_url, signature_url, proforma_stamp_url, invoice_stamp_url, next_order_number, next_proforma_number, next_invoice_number, pdf_scale'
            )
            .eq('id', true)
            .maybeSingle()
            .then(({ data, error }) => {
                if (cancelled) return;
                if (error) {
                    console.error('Failed to load app settings', error);
                } else if (data) {
                    setSettings(rowToSettings(data as AppSettingsRow));
                }
                setIsLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const updateSettings = useCallback((newSettings: Partial<AppSettings>) => {
        setSettings((prev) => ({ ...prev, ...newSettings }));
        supabase
            .from('app_settings')
            .update(settingsToRow(newSettings))
            .eq('id', true)
            .then(({ error }) => {
                if (error) console.error('Failed to save app settings', error);
            });
    }, []);

    return { settings, isLoading, updateSettings };
}
