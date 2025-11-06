
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

export const addPurchase = async (purchase: Omit<Purchase, 'id' | 'createdAt' | 'updatedAt'>): Promise<Purchase | null> => {
    const { data, error } = await supabase.from('purchases').insert([purchase]).select().single();
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
