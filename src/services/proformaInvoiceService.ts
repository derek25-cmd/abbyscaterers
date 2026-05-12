
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
        const { signedAtDate, signedAtLocation, ...validInvoiceData } = invoiceData;
        const newInvoiceData = { ...validInvoiceData, createdAt: now, updatedAt: now };
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
        const { id: newId, signedAtDate, signedAtLocation, ...updatePayload } = updates;
        const oldId = id;
        const idChanged = newId && newId !== oldId;

        // Perform the update. If id changed, it will target by oldId and set the new ID.
        const actualPayload = idChanged ? { ...updatePayload, id: newId } : updatePayload;

        const { data, error } = await supabase
            .from('proforma_invoices')
            .update({ ...actualPayload, updatedAt: new Date().toISOString() })
            .eq('id', oldId)
            .select()
            .single();

        if (error) {
            console.error('Error updating proforma invoice:', JSON.stringify(error, null, 2));
            return null;
        }

        if (idChanged && data) {
            // Cascade update to related tables
            const finalId = data.id;
            
            // 1. Update Orders
            await supabase.from('orders').update({ proformaId: finalId }).eq('proformaId', oldId);
            
            // 2. Update Bookings
            await supabase.from('bookings').update({ proforma_invoice_id: finalId }).eq('proforma_invoice_id', oldId);
            
            // 3. Update Final Invoices
            await supabase.from('invoices').update({ proformaId: finalId }).eq('proformaId', oldId);
        } else if (data) {
            // Sync content changes to the final invoice, excluding fields that belong
            // exclusively to the invoice and must never be overwritten by the proforma.
            const { data: finalInvoice } = await supabase.from('invoices').select('id').eq('proformaId', id).single();
            if (finalInvoice) {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { id: _id, invoiceDate: _invoiceDate, signedAtDate: _signedAtDate, signedAtLocation: _signedAtLocation, ...finalInvoiceUpdatePayload } = updates;
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

export const getLatestProformaNumber = async (): Promise<number> => {
    try {
        const { data, error } = await supabase
            .from('proforma_invoices')
            .select('id')
            .order('createdAt', { ascending: false })
            .limit(500);
        
        if (error || !data || data.length === 0) {
            return 1;
        }
        
        let maxNum = 0;
        for (const row of data) {
            // First try matching PI-0012837
            let match = row.id.match(/PI-(\d{5,})$/);
            // If they are purely numbers like 0012837
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
        console.error('Error in getLatestProformaNumber:', err);
        return 1;
    }
}
