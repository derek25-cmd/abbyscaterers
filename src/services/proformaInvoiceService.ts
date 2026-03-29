
import { supabase } from '@/lib/supabase-client';
import type { ProformaInvoice } from '@/types';
import type { ProformaInvoiceFormData } from '@/lib/schemas';

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
    try {
        const now = new Date().toISOString();
        const newInvoiceData = { ...invoiceData, createdAt: now, updatedAt: now };
        const { data, error } = await supabase.from('proforma_invoices').insert([newInvoiceData]).select().single();
        if (error) {
            console.error('Error adding proforma invoice:', JSON.stringify(error, null, 2));
            return null;
        }
        return data as ProformaInvoice;
    } catch (err) {
        console.error('Unexpected error adding proforma invoice:', err);
        return null;
    }
};

export const updateProformaInvoice = async (id: string, updates: Partial<ProformaInvoiceFormData>): Promise<ProformaInvoice | null> => {
    try {
        const { id: proformaId, ...updatePayload } = updates;
        const { data, error } = await supabase.from('proforma_invoices').update({ ...updatePayload, updatedAt: new Date().toISOString() }).eq('id', id).select().single();
        if (error) {
            console.error('Error updating proforma invoice:', JSON.stringify(error, null, 2));
            return null;
        } else if (data) {
            // Cascade update to final invoice if it exists
            const { data: finalInvoice } = await supabase.from('invoices').select('id').eq('proformaId', id).single();
            if(finalInvoice) {
                const { id: ignoredId, ...finalInvoiceUpdatePayload } = updates;
                await supabase.from('invoices').update({ ...finalInvoiceUpdatePayload, updatedAt: new Date().toISOString() }).eq('id', finalInvoice.id);
            }
        }
        return data as ProformaInvoice | null;
    } catch (err) {
        console.error('Unexpected error updating proforma invoice:', err);
        return null;
    }
};

export const deleteProformaInvoice = async (id: string): Promise<boolean> => {
    try {
        // Unlink associated orders first
        const { error: unlinkError } = await supabase
            .from('orders')
            .update({ proforma_id: null })
            .eq('proforma_id', id);

        if (unlinkError) {
            console.error('Error unlinking orders from proforma:', unlinkError);
            // We continue even if unlinking fails as the foreign key might not be strict,
            // or the user still wants to delete the proforma.
        }

        const { error } = await supabase.from('proforma_invoices').delete().eq('id', id);
        if (error) {
            console.error('Error deleting proforma invoice:', error);
        }
        return !error;
    } catch (err) {
        console.error('Unexpected error deleting proforma invoice:', err);
        return false;
    }
};
