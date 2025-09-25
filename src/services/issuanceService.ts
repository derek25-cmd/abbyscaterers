
import { supabase } from '@/lib/supabase-client';

export const getIssuances = async () => {
    const { data, error } = await supabase.from('issuance').select('*');
    if (error) {
        console.error('Error fetching issuances:', error);
        return [];
    }
    return data;
};

export const addIssuance = async (issuance: Omit<any, 'id'>) => {
    const { data, error } = await supabase.from('issuance').insert([issuance]).select();
    if (error) {
        console.error('Error adding issuance:', error);
        return null;
    }
    return data?.[0];
};

export const updateIssuance = async (id: string, updatedIssuance: Partial<any>) => {
    const { error } = await supabase.from('issuance').update(updatedIssuance).eq('id', id);
    if (error) {
        console.error('Error updating issuance:', error);
    }
    return !error;
};

export const getIssuanceById = async (id: string) => {
    const { data, error } = await supabase.from('issuance').select('*').eq('id', id).single();
    if (error) {
        console.error('Error fetching issuance by id:', error);
        return null;
    }
    return data;
};
