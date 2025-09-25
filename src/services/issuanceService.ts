
import { supabase } from '@/lib/supabase-client';
import { Issuance } from '@/types';


export const getIssuances = async (): Promise<Issuance[]> => {
    const { data, error } = await supabase.from('issuance').select('*').order('date', { ascending: false });
    if (error) {
        console.error('Error fetching issuances:', error);
        return [];
    }
    return data as Issuance[];
};

export const addIssuance = async (issuance: Omit<Issuance, 'id' | 'createdAt' | 'updatedAt'>): Promise<Issuance | null> => {
    const { data, error } = await supabase.from('issuance').insert([issuance]).select();
    if (error) {
        console.error('Error adding issuance:', error);
        return null;
    }
    return data?.[0] as Issuance;
};

export const updateIssuance = async (id: string, updatedIssuance: Partial<Issuance>): Promise<boolean> => {
    const { error } = await supabase.from('issuance').update(updatedIssuance).eq('id', id);
    if (error) {
        console.error('Error updating issuance:', error);
    }
    return !error;
};

export const getIssuanceById = async (id: string): Promise<Issuance | null> => {
    const { data, error } = await supabase.from('issuance').select('*').eq('id', id).single();
    if (error) {
        console.error('Error fetching issuance by id:', error);
        return null;
    }
    return data as Issuance;
};
