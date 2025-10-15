
import { supabase } from '@/lib/supabase-client';
import { StockLog } from '@/types';
import { format } from 'date-fns';

export const getStockLogs = async (): Promise<StockLog[]> => {
    const { data, error } = await supabase.from('stock_logs').select('*');
    if (error) {
        console.error('Error fetching stock logs:', error);
        return [];
    }
    return data as StockLog[];
};

export const addStockLog = async (log: Omit<StockLog, 'id' | 'createdAt' | 'updatedAt' >): Promise<StockLog | null> => {
    const now = new Date();
    const newLogData = {
        ...log,
        date: log.date || format(now, 'yyyy-MM-dd')
    };

    const { data, error } = await supabase.from('stock_logs').insert([newLogData]).select();
    if (error) {
        console.error('Error adding stock log:', error);
        return null;
    }
    return data?.[0] as StockLog;
};

export const updateStockLog = async (id: string, updatedLog: Partial<StockLog>): Promise<boolean> => {
    const { error } = await supabase.from('stock_logs').update(updatedLog).eq('id', id);
    if (error) {
        console.error('Error updating stock log:', error);
    }
    return !error;
};
