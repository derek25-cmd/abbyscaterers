import { supabase } from '@/lib/supabase-client';
import { Purchase } from '@/types';

const PURCHASES_LOCAL_KEY = 'cater_purchases_local';

// Helper to get local fallback purchases
const getLocalPurchases = (): Purchase[] => {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(PURCHASES_LOCAL_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        console.error('Error reading local purchases:', e);
        return [];
    }
};

// Helper to save local purchases
const saveLocalPurchases = (purchases: Purchase[]) => {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(PURCHASES_LOCAL_KEY, JSON.stringify(purchases));
    } catch (e) {
        console.error('Error writing local purchases:', e);
    }
};

export const getPurchases = async (): Promise<Purchase[]> => {
    const { data, error } = await supabase.from('purchases').select('*').order('date', { ascending: false });
    
    if (error) {
        console.warn('Supabase fetch failed, falling back to local purchases storage:', error.message);
        return getLocalPurchases();
    }

    // Map snake_case database columns to camelCase for the application
    const mappedPurchases = data.map(p => {
        const totalCost = Number(p.totalcost || p.total_cost || 0);
        const rawStatus = p.paymentstatus || p.payment_status || 'unpaid';
        const amountPaid = p.amount_paid !== undefined && p.amount_paid !== null
            ? Number(p.amount_paid)
            : rawStatus === 'paid' ? totalCost : 0;
        return {
            id: p.id,
            date: p.date,
            supplier: p.supplier,
            supplierId: p.supplier_id || p.supplierid || '',
            invoiceNumber: p.invoicenumber || p.invoice_number,
            description: p.description,
            quantity: Number(p.quantity),
            unitCost: Number(p.unitcost || p.unit_cost),
            totalCost,
            taxAmount: Number(p.taxamount || p.tax_amount || 0),
            amountPaid,
            paymentMethod: p.paymentmethod || p.payment_method || 'cash',
            paymentStatus: rawStatus as 'paid' | 'unpaid' | 'partial',
            expenseCategory: p.expensecategory || p.expense_category || 'Food Ingredients',
            event_id: p.event_id || p.eventid || getLocalPurchases().find(lp => lp.id === p.id)?.event_id || '',
            supplier_tin: p.supplier_tin || p.suppliertin || getLocalPurchases().find(lp => lp.id === p.id)?.supplier_tin || '',
            efd_receipt: p.efd_receipt || p.efdreceipt || getLocalPurchases().find(lp => lp.id === p.id)?.efd_receipt || '',
            user_id: p.user_id,
            createdAt: p.createdat || p.created_at,
            updatedAt: p.updatedat || p.updated_at,
        };
    }) as Purchase[];

    // Sync remote with local
    const localPurchases = getLocalPurchases();
    const updatedLocal = [...localPurchases];
    mappedPurchases.forEach(p => {
        if (!updatedLocal.some(lp => lp.id === p.id)) {
            updatedLocal.push(p);
        } else {
            const idx = updatedLocal.findIndex(lp => lp.id === p.id);
            updatedLocal[idx] = { ...updatedLocal[idx], ...p };
        }
    });
    saveLocalPurchases(updatedLocal);

    return mappedPurchases;
};

export const addPurchase = async (purchase: Omit<Purchase, 'id' | 'createdAt' | 'updatedAt' | 'user_id'>): Promise<Purchase | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    const purchaseId = typeof crypto !== 'undefined' ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9);
    const userId = user?.id || '00000000-0000-0000-0000-000000000000';
    const now = new Date().toISOString();
    
    // Map from camelCase (app) to snake_case (db)
    const dbPurchase = {
        date: purchase.date,
        supplier: purchase.supplier,
        supplier_id: purchase.supplierId || null,
        invoicenumber: purchase.invoiceNumber,
        description: purchase.description,
        quantity: Number(purchase.quantity),
        unitcost: Number(purchase.unitCost),
        totalcost: Number(purchase.totalCost),
        taxamount: Number(purchase.taxAmount || 0),
        amount_paid: Number(purchase.amountPaid ?? purchase.totalCost),
        paymentmethod: purchase.paymentMethod,
        paymentstatus: purchase.paymentStatus,
        expensecategory: purchase.expenseCategory,
        event_id: purchase.event_id,
        supplier_tin: purchase.supplier_tin,
        efd_receipt: purchase.efd_receipt,
        user_id: userId
    };

    // Attempt to write to Supabase
    const { data, error } = await supabase.from('purchases').insert([dbPurchase]).select().single();
    
    if (error) {
        console.warn('Could not insert purchase into Supabase. Creating in localStorage fallback:', error.message);
        
        // Strip out columns if database errors on optional fields
        if (error.message.includes('event_id') || error.message.includes('supplier_tin') || error.message.includes('efd_receipt') || error.message.includes('amount_paid') || error.message.includes('supplier_id')) {
            const strippedDbPurchase = { ...dbPurchase };
            delete (strippedDbPurchase as any).event_id;
            delete (strippedDbPurchase as any).supplier_tin;
            delete (strippedDbPurchase as any).efd_receipt;
            delete (strippedDbPurchase as any).amount_paid;
            delete (strippedDbPurchase as any).supplier_id;
            
            const { data: strippedData, error: strippedError } = await supabase.from('purchases').insert([strippedDbPurchase]).select().single();
            if (!strippedError && strippedData) {
                const completedPurchase: Purchase = {
                    ...purchase,
                    id: strippedData.id,
                    user_id: userId,
                    createdAt: strippedData.created_at || now,
                    updatedAt: strippedData.updated_at || now
                };
                
                // Persist the linkage keys in local storage
                const localPurchases = getLocalPurchases();
                localPurchases.push(completedPurchase);
                saveLocalPurchases(localPurchases);
                return completedPurchase;
            }
        }

        // Entirely local fallback if all remote queries fail
        const localPurchase: Purchase = {
            ...purchase,
            id: purchaseId,
            user_id: userId,
            createdAt: now,
            updatedAt: now
        };
        const localPurchases = getLocalPurchases();
        localPurchases.push(localPurchase);
        saveLocalPurchases(localPurchases);
        return localPurchase;
    }

    // Successfully saved on remote DB
    const createdPurchase: Purchase = {
        ...purchase,
        id: data.id,
        user_id: userId,
        createdAt: data.created_at || now,
        updatedAt: data.updated_at || now
    };

    const localPurchases = getLocalPurchases();
    localPurchases.push(createdPurchase);
    saveLocalPurchases(localPurchases);

    return createdPurchase;
};

export const updatePurchase = async (id: string, updatedPurchase: Partial<Omit<Purchase, 'id' | 'createdAt' | 'updatedAt'>>): Promise<boolean> => {
    // Map to DB structure
    const dbUpdate: any = {};
    if (updatedPurchase.date !== undefined) dbUpdate.date = updatedPurchase.date;
    if (updatedPurchase.supplier !== undefined) dbUpdate.supplier = updatedPurchase.supplier;
    if (updatedPurchase.supplierId !== undefined) dbUpdate.supplier_id = updatedPurchase.supplierId || null;
    if (updatedPurchase.invoiceNumber !== undefined) dbUpdate.invoicenumber = updatedPurchase.invoiceNumber;
    if (updatedPurchase.description !== undefined) dbUpdate.description = updatedPurchase.description;
    if (updatedPurchase.quantity !== undefined) dbUpdate.quantity = Number(updatedPurchase.quantity);
    if (updatedPurchase.unitCost !== undefined) dbUpdate.unitcost = Number(updatedPurchase.unitCost);
    if (updatedPurchase.totalCost !== undefined) dbUpdate.totalcost = Number(updatedPurchase.totalCost);
    if (updatedPurchase.taxAmount !== undefined) dbUpdate.taxamount = Number(updatedPurchase.taxAmount);
    if (updatedPurchase.amountPaid !== undefined) dbUpdate.amount_paid = Number(updatedPurchase.amountPaid);
    if (updatedPurchase.paymentDate !== undefined) dbUpdate.payment_date = updatedPurchase.paymentDate || null;
    if (updatedPurchase.paymentMethod !== undefined) dbUpdate.paymentmethod = updatedPurchase.paymentMethod;
    if (updatedPurchase.paymentStatus !== undefined) dbUpdate.paymentstatus = updatedPurchase.paymentStatus;
    if (updatedPurchase.expenseCategory !== undefined) dbUpdate.expensecategory = updatedPurchase.expenseCategory;
    if (updatedPurchase.event_id !== undefined) dbUpdate.event_id = updatedPurchase.event_id;
    if (updatedPurchase.supplier_tin !== undefined) dbUpdate.supplier_tin = updatedPurchase.supplier_tin;
    if (updatedPurchase.efd_receipt !== undefined) dbUpdate.efd_receipt = updatedPurchase.efd_receipt;

    const { error } = await supabase.from('purchases').update({ ...dbUpdate, updatedat: new Date().toISOString() }).eq('id', id);

    if (error) {
        console.warn('Supabase update failed:', error.message);

        // If a column is missing from the schema, retry without only that column —
        // never strip payment-critical fields (amount_paid, payment_date) unless the
        // error is specifically about them. This prevents balances from silently not saving.
        const optionalCols: Record<string, string> = {
            event_id: 'event_id',
            supplier_tin: 'supplier_tin',
            efd_receipt: 'efd_receipt',
            supplier_id: 'supplier_id',
            payment_date: 'payment_date',
            amount_paid: 'amount_paid',
        };
        const missingCol = Object.keys(optionalCols).find(col => error.message.includes(col));
        if (missingCol) {
            const strippedUpdate = { ...dbUpdate };
            delete strippedUpdate[missingCol];
            const { error: retryError } = await supabase
                .from('purchases')
                .update({ ...strippedUpdate, updatedat: new Date().toISOString() })
                .eq('id', id);
            if (retryError) {
                console.warn('Retry also failed:', retryError.message);
            }
        }
    }

    // Always update local storage
    const localPurchases = getLocalPurchases();
    const idx = localPurchases.findIndex(p => p.id === id);
    if (idx !== -1) {
        localPurchases[idx] = { ...localPurchases[idx], ...updatedPurchase, updatedAt: new Date().toISOString() };
        saveLocalPurchases(localPurchases);
    }
    return true;
};

export const deletePurchase = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('purchases').delete().eq('id', id);
    if (error) {
        console.warn('Supabase delete failed or recorded in local storage only:', error.message);
    }
    
    const localPurchases = getLocalPurchases();
    const filtered = localPurchases.filter(p => p.id !== id);
    saveLocalPurchases(filtered);
    return true;
};
