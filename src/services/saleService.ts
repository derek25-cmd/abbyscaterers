import { supabase } from '@/lib/supabase-client';
import { Sale } from '@/types';

const SALES_LOCAL_KEY = 'cater_sales_local';

// Helper to get local fallback sales
const getLocalSales = (): Sale[] => {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(SALES_LOCAL_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        console.error('Error reading local sales:', e);
        return [];
    }
};

// Helper to save local sales
const saveLocalSales = (sales: Sale[]) => {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(SALES_LOCAL_KEY, JSON.stringify(sales));
    } catch (e) {
        console.error('Error writing local sales:', e);
    }
};

export const getSales = async (): Promise<Sale[]> => {
    const { data, error } = await supabase.from('sales').select('*').order('date', { ascending: false });
    
    if (error) {
        console.warn('Supabase fetch failed, falling back to local sales storage:', error.message);
        return getLocalSales();
    }

    // Map snake_case database columns to camelCase for the application
    const mappedSales = data.map(s => ({
        id: s.id,
        date: s.date,
        customerId: s.customerId || s.customer_id,
        invoiceNumber: s.invoiceNumber || s.invoice_number || s.invoicenumber,
        description: s.description,
        quantity: Number(s.quantity),
        unitPrice: Number(s.unitPrice || s.unit_price || s.unitprice),
        totalAmount: Number(s.totalAmount || s.total_amount || s.totalamount),
        taxAmount: Number(s.taxAmount || s.tax_amount || s.taxamount || 0),
        paymentMethod: s.paymentMethod || s.payment_method || s.paymentmethod || 'cash',
        paymentStatus: s.paymentStatus || s.payment_status || s.paymentstatus || 'outstanding',
        event_id: s.event_id || s.eventid || getLocalSales().find(ls => ls.id === s.id)?.event_id || '',
        efd_receipt: s.efd_receipt || s.efdreceipt || getLocalSales().find(ls => ls.id === s.id)?.efd_receipt || '',
        createdAt: s.createdAt || s.created_at || s.createdat,
        updatedAt: s.updatedAt || s.updated_at || s.updatedat,
    })) as Sale[];

    // Sync remote sales with local sales to make sure we keep any event_id annotations
    const localSales = getLocalSales();
    const updatedLocal = [...localSales];
    mappedSales.forEach(s => {
        if (!updatedLocal.some(ls => ls.id === s.id)) {
            updatedLocal.push(s);
        } else {
            const idx = updatedLocal.findIndex(ls => ls.id === s.id);
            updatedLocal[idx] = { ...updatedLocal[idx], ...s };
        }
    });
    saveLocalSales(updatedLocal);

    return mappedSales;
};

export const addSale = async (sale: Omit<Sale, 'id' | 'createdAt' | 'updatedAt'>): Promise<Sale | null> => {
    const saleId = typeof crypto !== 'undefined' ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9);
    const now = new Date().toISOString();
    
    const dbSale = {
        date: sale.date,
        customerId: sale.customerId,
        invoiceNumber: sale.invoiceNumber,
        description: sale.description,
        quantity: Number(sale.quantity),
        unitPrice: Number(sale.unitPrice),
        totalAmount: Number(sale.totalAmount),
        taxAmount: Number(sale.taxAmount || 0),
        paymentMethod: sale.paymentMethod,
        paymentStatus: sale.paymentStatus,
        event_id: sale.event_id,
        efd_receipt: sale.efd_receipt
    };

    // Attempt to write to Supabase
    const { data, error } = await supabase.from('sales').insert([dbSale]).select().single();
    
    if (error) {
        console.warn('Could not insert sale into Supabase. Creating in localStorage fallback:', error.message);
        
        // If it's a column missing error, we also try inserting without event_id & efd_receipt
        if (error.message.includes('event_id') || error.message.includes('efd_receipt')) {
            const strippedDbSale = { ...dbSale };
            delete (strippedDbSale as any).event_id;
            delete (strippedDbSale as any).efd_receipt;
            
            const { data: strippedData, error: strippedError } = await supabase.from('sales').insert([strippedDbSale]).select().single();
            if (!strippedError && strippedData) {
                const completedSale: Sale = {
                    ...sale,
                    id: strippedData.id,
                    createdAt: strippedData.created_at || now,
                    updatedAt: strippedData.updated_at || now
                };
                // Store the Event linkage properties locally
                const localSales = getLocalSales();
                localSales.push(completedSale);
                saveLocalSales(localSales);
                return completedSale;
            }
        }

        // Fallback entirely to local storage if all database insertions fail
        const localSale: Sale = {
            ...sale,
            id: saleId,
            createdAt: now,
            updatedAt: now
        };
        const localSales = getLocalSales();
        localSales.push(localSale);
        saveLocalSales(localSales);
        return localSale;
    }

    const createdSale: Sale = {
        ...sale,
        id: data.id,
        createdAt: data.created_at || now,
        updatedAt: data.updated_at || now
    };

    // Save locally too
    const localSales = getLocalSales();
    localSales.push(createdSale);
    saveLocalSales(localSales);

    return createdSale;
};

export const updateSale = async (id: string, updatedSale: Partial<Omit<Sale, 'id' | 'createdAt' | 'updatedAt'>>): Promise<boolean> => {
    // Map to DB structure
    const dbUpdate: any = {};
    if (updatedSale.date !== undefined) dbUpdate.date = updatedSale.date;
    if (updatedSale.customerId !== undefined) dbUpdate.customerId = updatedSale.customerId;
    if (updatedSale.invoiceNumber !== undefined) dbUpdate.invoiceNumber = updatedSale.invoiceNumber;
    if (updatedSale.description !== undefined) dbUpdate.description = updatedSale.description;
    if (updatedSale.quantity !== undefined) dbUpdate.quantity = Number(updatedSale.quantity);
    if (updatedSale.unitPrice !== undefined) dbUpdate.unitPrice = Number(updatedSale.unitPrice);
    if (updatedSale.totalAmount !== undefined) dbUpdate.totalAmount = Number(updatedSale.totalAmount);
    if (updatedSale.taxAmount !== undefined) dbUpdate.taxAmount = Number(updatedSale.taxAmount);
    if (updatedSale.paymentMethod !== undefined) dbUpdate.paymentMethod = updatedSale.paymentMethod;
    if (updatedSale.paymentStatus !== undefined) dbUpdate.paymentStatus = updatedSale.paymentStatus;
    if (updatedSale.event_id !== undefined) dbUpdate.event_id = updatedSale.event_id;
    if (updatedSale.efd_receipt !== undefined) dbUpdate.efd_receipt = updatedSale.efd_receipt;

    const { error } = await supabase.from('sales').update({ ...dbUpdate, updatedAt: new Date().toISOString() }).eq('id', id);
    
    if (error) {
        console.warn('Supabase update failed, falling back to local sales storage:', error.message);
        
        // Strip column-missing keys if needed
        if (error.message.includes('event_id') || error.message.includes('efd_receipt')) {
            const strippedUpdate = { ...dbUpdate };
            delete strippedUpdate.event_id;
            delete strippedUpdate.efd_receipt;
            await supabase.from('sales').update(strippedUpdate).eq('id', id);
        }
    }

    // Always update local storage
    const localSales = getLocalSales();
    const idx = localSales.findIndex(s => s.id === id);
    if (idx !== -1) {
        localSales[idx] = { ...localSales[idx], ...updatedSale, updatedAt: new Date().toISOString() };
        saveLocalSales(localSales);
    }
    return true;
};

export const deleteSale = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('sales').delete().eq('id', id);
    if (error) {
        console.warn('Supabase delete failed or recorded in local storage only:', error.message);
    }
    
    const localSales = getLocalSales();
    const filtered = localSales.filter(s => s.id !== id);
    saveLocalSales(filtered);
    return true;
};
