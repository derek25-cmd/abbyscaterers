import { supabase } from '@/lib/supabase-client';
import { TaxRecord } from '@/types';

const TAX_LOCAL_KEY = 'cater_tax_local';

const getLocalTaxRecords = (): TaxRecord[] => {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(TAX_LOCAL_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        console.error('Error reading local tax records:', e);
        return [];
    }
};

const saveLocalTaxRecords = (records: TaxRecord[]) => {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(TAX_LOCAL_KEY, JSON.stringify(records));
    } catch (e) {
        console.error('Error writing local tax records:', e);
    }
};

export const getTaxRecords = async (): Promise<TaxRecord[]> => {
    const { data, error } = await supabase.from('vat_wht_ledger').select('*').order('date', { ascending: false });
    
    if (error) {
        console.warn('Supabase fetch failed for tax ledger, falling back to localStorage:', error.message);
        return getLocalTaxRecords();
    }

    const mapped = data.map(t => ({
        id: t.id,
        event_id: t.event_id || t.eventid || '',
        date: t.date,
        tax_type: t.tax_type || t.taxtype,
        ref_ledger: t.ref_ledger || t.refledger,
        ref_record: t.ref_record || t.refrecord,
        base_amount: Number(t.base_amount || t.baseamount),
        tax_rate: Number(t.tax_rate || t.taxrate),
        tax_amount: Number(t.tax_amount || t.taxamount),
        filing_st: t.filing_st || t.filingstatus || 'accrued',
        created_at: t.created_at
    })) as TaxRecord[];

    saveLocalTaxRecords(mapped);
    return mapped;
};

export const addTaxRecord = async (record: Omit<TaxRecord, 'id' | 'created_at'>): Promise<TaxRecord | null> => {
    const recordId = typeof crypto !== 'undefined' ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9);
    const now = new Date().toISOString();

    const dbRecord = {
        event_id: record.event_id,
        date: record.date,
        tax_type: record.tax_type,
        ref_ledger: record.ref_ledger,
        ref_record: record.ref_record,
        base_amount: Number(record.base_amount),
        tax_rate: Number(record.tax_rate),
        tax_amount: Number(record.tax_amount),
        filing_st: record.filing_st
    };

    const { data, error } = await supabase.from('vat_wht_ledger').insert([dbRecord]).select().single();
    
    if (error) {
        console.warn('Supabase tax ledger insert failed. Saving locally:', error.message);
        const localRec: TaxRecord = {
            ...record,
            id: recordId,
            created_at: now
        };
        const localRecords = getLocalTaxRecords();
        localRecords.push(localRec);
        saveLocalTaxRecords(localRecords);
        return localRec;
    }

    const createdRecord: TaxRecord = {
        ...record,
        id: data.id,
        created_at: data.created_at || now
    };

    const localRecords = getLocalTaxRecords();
    localRecords.push(createdRecord);
    saveLocalTaxRecords(localRecords);

    return createdRecord;
};

export const updateTaxFilingStatus = async (id: string, status: 'accrued' | 'filed' | 'paid'): Promise<boolean> => {
    const { error } = await supabase.from('vat_wht_ledger').update({ filing_st: status }).eq('id', id);
    if (error) {
        console.warn('Supabase tax update failed, updating locally:', error.message);
    }

    const localRecords = getLocalTaxRecords();
    const idx = localRecords.findIndex(r => r.id === id);
    if (idx !== -1) {
        localRecords[idx].filing_st = status;
        saveLocalTaxRecords(localRecords);
    }
    return true;
};
