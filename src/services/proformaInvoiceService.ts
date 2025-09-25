
import { supabase } from '@/lib/supabase-client';
import type { ProformaInvoice, FinalInvoiceFormData } from '@/types';
import type { ProformaInvoiceFormData } from '@/lib/schemas';
import { updateInvoice } from './invoiceService';

export const getProformaInvoices = async (): Promise<ProformaInvoice[]> => {
    const { data, error } = await supabase.from('proforma_invoices').select('*');
    if (error) {
        console.error('Error fetching proforma invoices:', error);
        return [];
    }
    return data as ProformaInvoice[];
};

export const getProformaInvoiceById = async (id: string): Promise<ProformaInvoice | null> => {
    const { data, error } = await supabase.from('proforma_invoices').select('*').eq('id', id).single();
    if (error) {
        console.error('Error fetching proforma invoice:', error);
        return null;
    }
    return data as ProformaInvoice;
}

export const addProformaInvoice = async (invoiceData: ProformaInvoiceFormData): Promise<ProformaInvoice | null> => {
    const now = new Date().toISOString();
    const newInvoiceData = { ...invoiceData, createdAt: now, updatedAt: now };
    const { data, error } = await supabase.from('proforma_invoices').insert([newInvoiceData]).select();
    if (error) {
        console.error('Error adding proforma invoice:', error);
        return null;
    }
    return data?.[0] as ProformaInvoice;
};

export const updateProformaInvoice = async (id: string, updates: Partial<ProformaInvoiceFormData>): Promise<boolean> => {
    const { error } = await supabase.from('proforma_invoices').update({ ...updates, updatedAt: new Date().toISOString() }).eq('id', id);
    if (error) {
        console.error('Error updating proforma invoice:', error);
    } else {
        // Cascade update to final invoice if it exists
        const { data: finalInvoice } = await supabase.from('invoices').select('id').eq('proformaId', id).single();
        if(finalInvoice) {
            await supabase.from('invoices').update({ ...updates, updatedAt: new Date().toISOString() }).eq('id', finalInvoice.id);
        }
    }
    return !error;
};

export const deleteProformaInvoice = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('proforma_invoices').delete().eq('id', id);
    if (error) {
        console.error('Error deleting proforma invoice:', error);
    }
    return !error;
};
