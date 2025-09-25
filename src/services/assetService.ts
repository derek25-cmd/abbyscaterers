
import { supabase } from '@/lib/supabase-client';

export const getAssets = async () => {
    const { data, error } = await supabase.from('assets').select('*');
    if (error) {
        console.error('Error fetching assets:', error);
        return [];
    }
    return data;
};

export const addAsset = async (asset: Omit<any, 'id'>) => {
    const { data, error } = await supabase.from('assets').insert([asset]).select();
    if (error) {
        console.error('Error adding asset:', error);
        return null;
    }
    return data?.[0]?.id;
};

export const updateAsset = async (id: string, updatedAsset: Partial<any>) => {
    const { error } = await supabase.from('assets').update(updatedAsset).eq('id', id);
    if (error) {
        console.error('Error updating asset:', error);
    }
    return !error;
};
