
import { supabase } from '@/lib/supabase-client';
import { Asset } from '@/types';

export const getAssets = async (): Promise<Asset[]> => {
    const { data, error } = await supabase.from('assets').select('*');
    if (error) {
        console.error('Error fetching assets:', error);
        return [];
    }
    return data as Asset[];
};

export const addAsset = async (asset: Omit<Asset, 'id' | 'createdAt' | 'updatedAt'>): Promise<Asset | null> => {
    const { data, error } = await supabase.from('assets').insert([asset]).select();
    if (error) {
        console.error('Error adding asset:', error);
        return null;
    }
    return data?.[0] as Asset;
};

export const updateAsset = async (id: string, updatedAsset: Partial<Asset>): Promise<boolean> => {
    const { error } = await supabase.from('assets').update(updatedAsset).eq('id', id);
    if (error) {
        console.error('Error updating asset:', error);
    }
    return !error;
};
