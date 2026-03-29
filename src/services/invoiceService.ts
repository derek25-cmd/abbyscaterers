
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
    try {
        const now = new Date().toISOString();
        const newInvoiceData = { ...invoiceData, createdAt: now, updatedAt: now };

        const { data, error } = await supabase.from('invoices').insert([newInvoiceData]).select().single();
        if (error) {
            console.error('Error adding invoice:', JSON.stringify(error, null, 2));
            return null;
        }
        
        // Mark proforma as invoiced
        if (invoiceData.proformaId) {
            const { error: proformaError } = await supabase
                .from('proforma_invoices')
                .update({ isInvoiced: true })
                .eq('id', invoiceData.proformaId);
            if(proformaError){
                console.error("Error marking proforma as invoiced:", JSON.stringify(proformaError, null, 2));
            }
        }

        return data as Invoice;
    } catch (err) {
        console.error('Unexpected error adding invoice:', err);
        return null;
    }
};

export const updateInvoice = async (id: string, updates: Partial<FinalInvoiceFormData>): Promise<Invoice | null> => {
    try {
        const { id: invoiceId, ...updatePayload } = updates;
        const { data, error } = await supabase.from('invoices').update({ ...updatePayload, updatedAt: new Date().toISOString() }).eq('id', id).select().single();
        if (error) {
            console.error('Error updating invoice:', JSON.stringify(error, null, 2));
            return null;
        }
        return data as Invoice;
    } catch (err) {
        console.error('Unexpected error updating invoice:', err);
        return null;
    }
};

export const deleteInvoice = async (id: string): Promise<boolean> => {
    // First, get the invoice to check for a proformaId
    const { data: invoice, error: fetchError } = await supabase.from('invoices').select('proformaId').eq('id', id).single();

    if(fetchError){
        console.error('Error fetching invoice before deletion:', fetchError);
        return false;
    }

    // If a proformaId exists, update the proforma to be open again
    if (invoice && invoice.proformaId) {
        const { error: proformaError } = await supabase
            .from('proforma_invoices')
            .update({ isInvoiced: false, updatedAt: new Date().toISOString() })
            .eq('id', invoice.proformaId);

        if (proformaError) {
            console.error('Error reverting proforma status:', proformaError);
            // We still proceed to delete the invoice, but log the error
        }
    }

    // Now, delete the final invoice
    const { error: deleteError } = await supabase.from('invoices').delete().eq('id', id);
    if (deleteError) {
        console.error('Error deleting invoice:', deleteError);
        // If deletion fails, we should ideally roll back the proforma status change,
        // but for simplicity, we will just log the error.
    }
    return !deleteError;
};
