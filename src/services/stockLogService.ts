
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
        date: log.date || format(now, 'yyyy-MM-dd'),
        quantity: Number(log.quantity),
        price: Number(log.price),
        actual_unit_price: Number(log.actual_unit_price),
        branch: log.branch || 'Dar es Salaam',
    };

    const { data, error } = await supabase.from('stock_logs').insert([newLogData]).select();
    if (error) {
        console.error('Error adding stock log — full error:', JSON.stringify(error, null, 2));
        console.error('Attempted payload:', JSON.stringify(newLogData, null, 2));
        return null;
    }
    return data?.[0] as StockLog;
};


export const updateStockLog = async (id: string, updatedLog: Partial<StockLog>): Promise<boolean> => {
    const updatePayload: { [key: string]: any } = { ...updatedLog };
    if (updatePayload.quantity) {
        updatePayload.quantity = Number(updatePayload.quantity);
    }
    if (updatePayload.price) {
        updatePayload.price = Number(updatePayload.price);
    }
     if (updatePayload.actual_unit_price) {
        updatePayload.actual_unit_price = Number(updatePayload.actual_unit_price);
    }
    const { error } = await supabase.from('stock_logs').update(updatePayload).eq('id', id);
    if (error) {
        console.error('Error updating stock log:', error);
    }
    return !error;
};

export const deleteStockLog = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('stock_logs').delete().eq('id', id);
    if (error) {
        console.error('Error deleting stock log:', error);
    }
    return !error;
}

export const deleteStockLogs = async (ids: string[]): Promise<boolean> => {
    const { error } = await supabase.from('stock_logs').delete().in('id', ids);
    if (error) {
        console.error('Error bulk deleting stock logs:', error);
    }
    return !error;
}
