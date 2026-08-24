import { supabase } from '@/lib/supabase-client';
import type { SupervisorReport } from '@/types';

export const getSupervisorReports = async (): Promise<SupervisorReport[]> => {
    const { data, error } = await supabase
        .from('supervisor_reports')
        .select('*')
        .order('report_date', { ascending: false });

    if (error) {
        console.error('Error fetching supervisor reports:', error);
        return [];
    }
    return data as SupervisorReport[];
};

export const getSupervisorReportById = async (id: string): Promise<SupervisorReport | null> => {
    const { data, error } = await supabase
        .from('supervisor_reports')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        console.error('Error fetching supervisor report:', error);
        return null;
    }
    return data as SupervisorReport;
};

export const addSupervisorReport = async (report: Omit<SupervisorReport, 'id' | 'created_at' | 'updated_at'>): Promise<SupervisorReport | null> => {
    const { data, error } = await supabase
        .from('supervisor_reports')
        .insert([report])
        .select()
        .single();

    if (error) {
        console.error('Error adding supervisor report:', error);
        return null;
    }
    return data as SupervisorReport;
};

export const updateSupervisorReport = async (id: string, updates: Partial<SupervisorReport>): Promise<boolean> => {
    const { error } = await supabase
        .from('supervisor_reports')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);

    if (error) {
        console.error('Error updating supervisor report:', error);
    }
    return !error;
};

export const deleteSupervisorReport = async (id: string): Promise<boolean> => {
    const { error } = await supabase
        .from('supervisor_reports')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting supervisor report:', error);
    }
    return !error;
};
