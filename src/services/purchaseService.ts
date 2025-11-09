
import { supabase } from '@/lib/supabase-client';
import { Purchase } from '@/types';

export const getPurchases = async (): Promise<Purchase[]> => {
    const { data, error } = await supabase.from('purchases').select('*').order('date', { ascending: false });
    if (error) {
        console.error('Error fetching purchases:', error);
        return [];
    }
    return data as Purchase[];
};

export const addPurchase = async (purchase: Omit<Purchase, 'id' | 'createdAt' | 'updatedAt' | 'user_id'>): Promise<Purchase | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        console.error("User not authenticated to add a purchase.");
        throw new Error("You must be logged in to add a purchase.");
    }
    
    const purchaseData = {
        ...purchase,
        user_id: user.id
    };

    const { data, error } = await supabase.from('purchases').insert([purchaseData]).select().single();
    if (error) {
        console.error('Error adding purchase:', error);
        return null;
    }
    return data as Purchase;
};

export const updatePurchase = async (id: string, updatedPurchase: Partial<Omit<Purchase, 'id' | 'createdAt' | 'updatedAt'>>): Promise<boolean> => {
    const { error } = await supabase.from('purchases').update({ ...updatedPurchase, updatedAt: new Date().toISOString() }).eq('id', id);
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
