
import { supabase } from '@/lib/supabase-client';
import type { Invoice } from '@/types';
import type { FinalInvoiceFormData } from '@/lib/schemas';

export const getInvoices = async (): Promise<Invoice[]> => {
    const { data, error } = await supabase.from('invoices').select('*');
    if (error) {
        console.error('Error fetching invoices:', error);
        return [];
    }
    return data as Invoice[];
};

export const getInvoiceById = async (id: string): Promise<Invoice | null> => {
    const { data, error } = await supabase.from('invoices').select('*').eq('id', id).single();
     if (error) {
        console.error('Error fetching invoice:', error);
        return null;
    }
    return data as Invoice;
}

export const addInvoice = async (invoiceData: FinalInvoiceFormData): Promise<Invoice | null> => {
    const now = new Date().toISOString();
    const newInvoiceData = { ...invoiceData, createdAt: now, updatedAt: now };

    const { data, error } = await supabase.from('invoices').insert([newInvoiceData]).select();
    if (error) {
        console.error('Error adding invoice:', error);
        return null;
    }
    
    // Mark proforma as invoiced
    if (invoiceData.proformaId) {
        const { error: proformaError } = await supabase
            .from('proforma_invoices')
            .update({ isInvoiced: true })
            .eq('id', invoiceData.proformaId);
        if(proformaError){
            console.error("Error marking proforma as invoiced:", proformaError);
        }
    }

    return data?.[0] as Invoice;
};

export const updateInvoice = async (id: string, updates: Partial<FinalInvoiceFormData>): Promise<boolean> => {
    const { error } = await supabase.from('invoices').update({ ...updates, updatedAt: new Date().toISOString() }).eq('id', id);
    if (error) {
        console.error('Error updating invoice:', error);
    }
    return !error;
};

export const deleteInvoice = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('invoices').delete().eq('id', id);
    if (error) {
        console.error('Error deleting invoice:', error);
    }
    return !error;
};
