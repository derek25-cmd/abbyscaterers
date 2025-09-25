
import { supabase } from '@/lib/supabase-client';
import { Position } from '@/types';

export const getPositions = async (): Promise<Position[]> => {
    const { data, error } = await supabase.from('positions').select('*');
    if (error) {
        console.error('Error fetching positions:', error);
        return [];
    }
    return data as Position[];
};

export const addPosition = async (position: Omit<Position, 'id' | 'createdAt' | 'updatedAt'>): Promise<Position | null> => {
    const { data, error } = await supabase.from('positions').insert([position]).select();
    if (error) {
        console.error('Error adding position:', error);
        return null;
    }
    return data?.[0] as Position;
};

export const updatePosition = async (id: string, updatedPosition: Partial<Position>): Promise<boolean> => {
    const { error } = await supabase.from('positions').update(updatedPosition).eq('id', id);
    if (error) {
        console.error('Error updating position:', error);
    }
    return !error;
};
