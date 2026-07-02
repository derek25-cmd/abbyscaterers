
import { supabase } from '@/lib/supabase-client';
import type { Invoice } from '@/types';
import { FinalInvoiceSchema, type FinalInvoiceFormData } from '@/lib/schemas';
import { validate } from '@/lib/service-validation';
import { resyncCommissionForInvoice, voidCommissionForInvoice, renameInvoiceIdForCommission, recordCommissionForInvoice } from '@/features/marketing/utils/commission';

export const getInvoices = async (): Promise<Invoice[]> => {
    const PAGE = 1000;
    const all: Invoice[] = [];
    let page = 0;
    while (true) {
        const { data, error } = await supabase
            .from('invoices')
            .select('*')
            .order('createdAt', { ascending: false })
            .range(page * PAGE, (page + 1) * PAGE - 1);
        if (error) { console.error('Error fetching invoices:', error); break; }
        if (!data || data.length === 0) break;
        all.push(...(data as Invoice[]));
        if (data.length < PAGE) break;
        page++;
    }
    return all;
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
    // Server-side guard: a proforma can only ever have one final invoice.
    // This catches races and direct-URL bypasses where the client-side
    // isInvoiced flag might be stale.
    if (invoiceData.proformaId) {
        const { data: existing } = await supabase
            .from('invoices')
            .select('id')
            .eq('proformaId', invoiceData.proformaId)
            .maybeSingle();
        if (existing) {
            throw new Error(
                `A final invoice (${existing.id}) already exists for this proforma. Open that invoice instead of creating a new one.`
            );
        }
    }

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

    // Marketer commission (non-critical — log but don't block invoice creation)
    recordCommissionForInvoice(data as Invoice).catch((err) => console.error('Error recording commission:', err));

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

    // Marketer commission (non-critical — log but don't block invoice update)
    (async () => {
        if (idChanged) await renameInvoiceIdForCommission(oldId, newId as string);
        await resyncCommissionForInvoice(data as Invoice);
    })().catch((err) => console.error('Error resyncing commission:', err));

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

    // Marketer commission (non-critical — log but don't block invoice deletion)
    voidCommissionForInvoice(id).catch((err) => console.error('Error voiding commission:', err));

    return true;
};

export const getLatestInvoiceNumber = async (): Promise<number> => {
    // Scan-based: used only to SUGGEST the next number in the UI picker.
    // Actual uniqueness is enforced by the server-side duplicate check in
    // addInvoice() — claim_ids() is not used here so that opening the form
    // never permanently consumes a counter slot.
    try {
        const PAGE = 1000;
        let maxNum = 0;
        let page = 0;
        while (true) {
            const { data, error } = await supabase
                .from('invoices')
                .select('id')
                .order('createdAt', { ascending: false })
                .range(page * PAGE, (page + 1) * PAGE - 1);
            if (error || !data || data.length === 0) break;
            for (const row of data) {
                let match = row.id.match(/INV-(\d{5,})$/);
                if (!match) match = row.id.match(/^(\d+)$/);
                if (match?.[1]) {
                    const num = parseInt(match[1], 10);
                    if (num > maxNum) maxNum = num;
                }
            }
            if (data.length < PAGE) break;
            page++;
        }
        return maxNum > 0 ? maxNum + 1 : 1;
    } catch (err) {
        console.error('Error in getLatestInvoiceNumber:', err);
        return 1;
    }
}
