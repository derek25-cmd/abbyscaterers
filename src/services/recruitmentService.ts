
import { supabase } from '@/lib/supabase-client';

export const getPositions = async () => {
    const { data, error } = await supabase.from('positions').select('*');
    if (error) {
        console.error('Error fetching positions:', error);
        return [];
    }
    return data;
};

export const addPosition = async (position: Omit<any, 'id'>) => {
    const { data, error } = await supabase.from('positions').insert([position]).select();
    if (error) {
        console.error('Error adding position:', error);
        return null;
    }
    return data?.[0]?.id;
};

export const updatePosition = async (id: string, updatedPosition: Partial<any>) => {
    const { error } = await supabase.from('positions').update(updatedPosition).eq('id', id);
    if (error) {
        console.error('Error updating position:', error);
    }
    return !error;
};
