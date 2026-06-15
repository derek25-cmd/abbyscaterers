
import { supabase } from '@/lib/supabase-client';
import type { ProformaInvoice } from '@/types';
import { ProformaInvoiceSchema, type ProformaInvoiceFormData } from '@/lib/schemas';
import { validate } from '@/lib/service-validation';

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
    const validated = validate(ProformaInvoiceSchema, invoiceData);
    const now = new Date().toISOString();
    const { signedAtDate, signedAtLocation, ...validInvoiceData } = validated;
    const newInvoiceData = { ...validInvoiceData, createdAt: now, updatedAt: now };
    const { data, error } = await supabase.from('proforma_invoices').insert([newInvoiceData]).select().single();
    if (error) throw new Error(error.message);
    return data as ProformaInvoice;
};

export const updateProformaInvoice = async (id: string, updates: Partial<ProformaInvoiceFormData>): Promise<ProformaInvoice | null> => {
    const { id: newId, signedAtDate, signedAtLocation, ...updatePayload } = updates;
    const oldId = id;
    const idChanged = newId && newId !== oldId;

    const actualPayload = idChanged ? { ...updatePayload, id: newId } : updatePayload;

    const { data, error } = await supabase
        .from('proforma_invoices')
        .update({ ...actualPayload, updatedAt: new Date().toISOString() })
        .eq('id', oldId)
        .select()
        .single();

    if (error) throw new Error(error.message);

    if (idChanged && data) {
        const finalId = data.id;
        await supabase.from('orders').update({ proformaId: finalId }).eq('proformaId', oldId);
        await supabase.from('bookings').update({ proforma_invoice_id: finalId }).eq('proforma_invoice_id', oldId);
        await supabase.from('invoices').update({ proformaId: finalId }).eq('proformaId', oldId);
    } else if (data) {
        const { data: finalInvoice } = await supabase.from('invoices').select('id').eq('proformaId', id).single();
        if (finalInvoice) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { id: _id, invoiceDate: _invoiceDate, signedAtDate: _signedAtDate, signedAtLocation: _signedAtLocation, ...finalInvoiceUpdatePayload } = updates;
            await supabase.from('invoices').update({ ...finalInvoiceUpdatePayload, updatedAt: new Date().toISOString() }).eq('id', finalInvoice.id);
        }
    }

    return data as ProformaInvoice | null;
};

export const deleteProformaInvoice = async (id: string): Promise<boolean> => {
    // Unlink associated orders (non-critical — log but continue)
    const { error: unlinkError } = await supabase
        .from('orders')
        .update({ proforma_id: null })
        .eq('proforma_id', id);
    if (unlinkError) console.error('Error unlinking orders from proforma:', unlinkError.message);

    const { error } = await supabase.from('proforma_invoices').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return true;
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
