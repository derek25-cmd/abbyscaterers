
import { supabase } from '@/lib/supabase-client';
import { Payroll } from '@/types';

export const getPayrolls = async (): Promise<Payroll[]> => {
    const { data, error } = await supabase.from('payroll').select('*');
    if (error) {
        console.error('Error fetching payrolls:', error);
        return [];
    }
    return data as Payroll[];
};

export const addPayroll = async (payroll: Omit<Payroll, 'id'>): Promise<string | null> => {
    const { data, error } = await supabase.from('payroll').insert([payroll]).select();
    if (error) {
        console.error('Error adding payroll:', error);
        return null;
    }
    return data?.[0]?.id;
};

export const updatePayroll = async (id: string, updatedPayroll: Partial<Payroll>): Promise<boolean> => {
    const { error } = await supabase.from('payroll').update(updatedPayroll).eq('id', id);
    if (error) {
        console.error('Error updating payroll:', error);
    }
    return !error;
};
