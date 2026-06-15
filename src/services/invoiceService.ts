
import { supabase } from '@/lib/supabase-client';
import type { Invoice } from '@/types';
import { FinalInvoiceSchema, type FinalInvoiceFormData } from '@/lib/schemas';
import { validate } from '@/lib/service-validation';

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
    const validated = validate(FinalInvoiceSchema, invoiceData);
    const now = new Date().toISOString();
    const newInvoiceData = { ...validated, createdAt: now, updatedAt: now };

    const { data, error } = await supabase.from('invoices').insert([newInvoiceData]).select().single();
    if (error) throw new Error(error.message);

    // Mark proforma as invoiced (non-critical — log but don't block)
    if (invoiceData.proformaId) {
        const { error: proformaError } = await supabase
            .from('proforma_invoices')
            .update({ isInvoiced: true })
            .eq('id', invoiceData.proformaId);
        if (proformaError) console.error("Error marking proforma as invoiced:", proformaError.message);
    }

    return data as Invoice;
};

export const updateInvoice = async (id: string, updates: Partial<FinalInvoiceFormData>): Promise<Invoice | null> => {
    const { id: newId, ...updatePayload } = updates;
    const oldId = id;
    const idChanged = newId && newId !== oldId;

    const actualPayload = idChanged ? { ...updatePayload, id: newId } : updatePayload;

    const { data, error } = await supabase
        .from('invoices')
        .update({ ...actualPayload, updatedAt: new Date().toISOString() })
        .eq('id', oldId)
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data as Invoice;
};

export const deleteInvoice = async (id: string): Promise<boolean> => {
    const { data: invoice, error: fetchError } = await supabase.from('invoices').select('*').eq('id', id).single();
    if (fetchError) throw new Error(fetchError.message);

    // Revert proforma status (non-critical — log but don't block)
    if (invoice && invoice.proformaId) {
        const { error: proformaError } = await supabase
            .from('proforma_invoices')
            .update({ isInvoiced: false, updatedAt: new Date().toISOString() })
            .eq('id', invoice.proformaId);
        if (proformaError) console.error('Error reverting proforma status:', proformaError.message);
    }

    const { error: deleteError } = await supabase.from('invoices').delete().eq('id', id);
    if (deleteError) throw new Error(deleteError.message);
    return true;
};

export const getLatestInvoiceNumber = async (): Promise<number> => {
    try {
        const { data, error } = await supabase
            .from('invoices')
            .select('id')
            .order('createdAt', { ascending: false })
            .limit(20);
        
        if (error || !data || data.length === 0) {
            return 1;
        }
        
        let maxNum = 0;
        for (const row of data) {
            let match = row.id.match(/INV-(\d{5,})$/);
            if (!match) {
                match = row.id.match(/^(\d{5,})$/);
            }

            if (match && match[1]) {
                const num = parseInt(match[1], 10);
                if (num > maxNum) maxNum = num;
            }
        }

        return maxNum > 0 ? maxNum + 1 : 1;
    } catch (err) {
        console.error('Error in getLatestInvoiceNumber:', err);
        return 1;
    }
}
