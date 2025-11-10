
import { supabase } from '@/lib/supabase-client';
import { Purchase } from '@/types';

export const getPurchases = async (): Promise<Purchase[]> => {
    const { data, error } = await supabase.from('purchases').select('*').order('date', { ascending: false });
    if (error) {
        console.error('Error fetching purchases:', error);
        return [];
    }
    // Map snake_case from DB to camelCase for the app
    return data.map(p => ({
        id: p.id,
        date: p.date,
        supplier: p.supplier,
        invoiceNumber: p.invoicenumber,
        description: p.description,
        quantity: p.quantity,
        unitCost: p.unitcost,
        totalCost: p.totalcost,
        taxAmount: p.taxamount,
        paymentMethod: p.paymentmethod,
        paymentStatus: p.paymentstatus,
        expenseCategory: p.expensecategory,
        user_id: p.user_id,
        createdAt: p.createdat,
        updatedAt: p.updatedat,
    })) as Purchase[];
};

export const addPurchase = async (purchase: Omit<Purchase, 'id' | 'createdAt' | 'updatedAt' | 'user_id'>): Promise<Purchase | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        console.error("User not authenticated to add a purchase.");
        throw new Error("You must be logged in to add a purchase.");
    }
    
    // Map from camelCase (app) to snake_case (db)
    const purchaseDataForDB = {
        date: purchase.date,
        supplier: purchase.supplier,
        invoicenumber: purchase.invoiceNumber,
        description: purchase.description,
        quantity: Number(purchase.quantity),
        unitcost: Number(purchase.unitCost),
        totalcost: Number(purchase.totalCost),
        taxamount: Number(purchase.taxAmount),
        paymentmethod: purchase.paymentMethod,
        paymentstatus: purchase.paymentStatus,
        expensecategory: purchase.expenseCategory,
        user_id: user.id
    };

    const { data, error } = await supabase.from('purchases').insert([purchaseDataForDB]).select().single();
    
    if (error) {
        console.error('Error adding purchase:', error);
        return null;
    }
    return data as Purchase;
};

export const updatePurchase = async (id: string, updatedPurchase: Partial<Omit<Purchase, 'id' | 'createdAt' | 'updatedAt'>>): Promise<boolean> => {
    // Map from camelCase (app) to snake_case (db)
    const updateDataForDB = {
        date: updatedPurchase.date,
        supplier: updatedPurchase.supplier,
        invoicenumber: updatedPurchase.invoiceNumber,
        description: updatedPurchase.description,
        quantity: updatedPurchase.quantity !== undefined ? Number(updatedPurchase.quantity) : undefined,
        unitcost: updatedPurchase.unitCost !== undefined ? Number(updatedPurchase.unitCost) : undefined,
        totalcost: updatedPurchase.totalCost !== undefined ? Number(updatedPurchase.totalCost) : undefined,
        taxamount: updatedPurchase.taxAmount !== undefined ? Number(updatedPurchase.taxAmount) : undefined,
        paymentmethod: updatedPurchase.paymentMethod,
        paymentstatus: updatedPurchase.paymentStatus,
        expensecategory: updatedPurchase.expenseCategory,
        updatedAt: new Date().toISOString()
    };
    
    // Remove undefined keys so they are not sent in the update payload
    Object.keys(updateDataForDB).forEach(key => (updateDataForDB as any)[key] === undefined && delete (updateDataForDB as any)[key]);

    const { error } = await supabase.from('purchases').update(updateDataForDB).eq('id', id);
    
    if (error) {
        console.error('Error updating purchase:', error);
    }
    return !error;
};

export const deletePurchase = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('purchases').delete().eq('id', id);
    if (error) {
        console.error('Error deleting purchase:', error);
    }
    return !error;
}
