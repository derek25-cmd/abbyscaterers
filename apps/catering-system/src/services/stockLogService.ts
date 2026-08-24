
import { supabase } from '@/lib/supabase-client';
import { StockLog } from '@/types';
import { format } from 'date-fns';

export const getStockLogs = async () => {
    // Supabase's default/max page size is 1 000 rows. The previous hardcoded
    // .limit(3000) silently dropped anything beyond it once stock_logs grew
    // past that — no error, just missing rows. Paginate until exhausted so
    // stock reports never silently under-report.
    const PAGE = 1000;
    const all: any[] = [];
    let page = 0;

    while (true) {
        const { data, error } = await supabase
            .from('stock_logs')
            .select('*')
            // Secondary sort on id breaks ties on same-date rows so .range()
            // pagination is deterministic — without it, rows sharing a date
            // could be skipped or duplicated across page boundaries.
            .order('date', { ascending: false })
            .order('id', { ascending: false })
            .range(page * PAGE, (page + 1) * PAGE - 1);

        if (error) {
            return { data: null, error };
        }
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < PAGE) break; // last page
        page++;
    }

    return { data: all, error: null };
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
