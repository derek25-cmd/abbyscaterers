
import { supabase } from '@/lib/supabase-client';
import { Sale } from '@/types';

export const getSales = async (): Promise<Sale[]> => {
    const { data, error } = await supabase.from('sales').select('*').order('date', { ascending: false });
    if (error) {
        console.error('Error fetching sales:', error);
        return [];
    }
    return data as Sale[];
};

export const addSale = async (sale: Omit<Sale, 'id' | 'createdAt' | 'updatedAt'>): Promise<Sale | null> => {
    const { data, error } = await supabase.from('sales').insert([sale]).select().single();
    if (error) {
        console.error('Error adding sale:', error);
        return null;
    }
    return data as Sale;
};

export const updateSale = async (id: string, updatedSale: Partial<Omit<Sale, 'id' | 'createdAt' | 'updatedAt'>>): Promise<boolean> => {
    const { error } = await supabase.from('sales').update({ ...updatedSale, updatedAt: new Date().toISOString() }).eq('id', id);
    if (error) {
        console.error('Error updating sale:', error);
    }
    return !error;
};

export const deleteSale = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('sales').delete().eq('id', id);
    if (error) {
        console.error('Error deleting sale:', error);
    }
    return !error;
}
