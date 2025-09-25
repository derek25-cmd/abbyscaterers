
import { supabase } from '@/lib/supabase-client';

export const getStockLogs = async () => {
    const { data, error } = await supabase.from('stock_logs').select('*');
    if (error) {
        console.error('Error fetching stock logs:', error);
        return [];
    }
    return data;
};

export const addStockLog = async (log: Omit<any, 'id'>) => {
    const { data, error } = await supabase.from('stock_logs').insert([log]).select();
    if (error) {
        console.error('Error adding stock log:', error);
        return null;
    }
    return data?.[0]?.id;
};

export const updateStockLog = async (id: string, updatedLog: Partial<any>) => {
    const { error } = await supabase.from('stock_logs').update(updatedLog).eq('id', id);
    if (error) {
        console.error('Error updating stock log:', error);
    }
    return !error;
};
