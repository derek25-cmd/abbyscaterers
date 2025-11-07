
import { supabase } from '@/lib/supabase-client';
import type { CostingReportItem } from '@/types';

export const getCostingReportsByDate = async (date: string): Promise<CostingReportItem[]> => {
    const { data, error } = await supabase
        .from('costing_reports')
        .select('*')
        .eq('report_date', date);

    if (error) {
        console.error('Error fetching costing reports:', error);
        return [];
    }
    return data as CostingReportItem[];
};

export const addCostingReport = async (item: Omit<CostingReportItem, 'id' | 'created_at'>): Promise<CostingReportItem | null> => {
    const { data, error } = await supabase
        .from('costing_reports')
        .upsert({ ...item }, { onConflict: 'report_date, type, description' })
        .select()
        .single();
    
    if (error) {
        console.error('Error adding costing report item:', error);
        return null;
    }
    return data as CostingReportItem;
};

export const deleteCostingReport = async (id: number): Promise<boolean> => {
    const { error } = await supabase
        .from('costing_reports')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting costing report item:', error);
    }
    return !error;
}
