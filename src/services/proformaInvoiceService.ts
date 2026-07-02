
import { supabase } from '@/lib/supabase-client';
import type { ProformaInvoice } from '@/types';
import { ProformaInvoiceSchema, type ProformaInvoiceFormData } from '@/lib/schemas';
import { validate } from '@/lib/service-validation';

export const getProformaInvoices = async (): Promise<ProformaInvoice[]> => {
    const PAGE = 1000;
    const all: ProformaInvoice[] = [];
    let page = 0;
    while (true) {
        const { data, error } = await supabase
            .from('proforma_invoices')
            .select('*')
            .order('createdAt', { ascending: false })
            .range(page * PAGE, (page + 1) * PAGE - 1);
        if (error) { console.error('Error fetching proforma invoices:', error); break; }
        if (!data || data.length === 0) break;
        all.push(...(data as ProformaInvoice[]));
        if (data.length < PAGE) break;
        page++;
    }
    return all;
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
    const { data, error } = await supabase.rpc('claim_ids', {
        counter_name: 'proforma_id',
        count: 1,
    });
    if (error) {
        console.error('Error in getLatestProformaNumber:', error);
        return 1;
    }
    return Number(data);
}
