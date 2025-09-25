
import { supabase } from '@/lib/supabase-client';

export const getPayrolls = async () => {
    const { data, error } = await supabase.from('payroll').select('*');
    if (error) {
        console.error('Error fetching payrolls:', error);
        return [];
    }
    return data;
};

export const addPayroll = async (payroll: Omit<any, 'id'>) => {
    const { data, error } = await supabase.from('payroll').insert([payroll]).select();
    if (error) {
        console.error('Error adding payroll:', error);
        return null;
    }
    return data?.[0]?.id;
};

export const updatePayroll = async (id: string, updatedPayroll: Partial<any>) => {
    const { error } = await supabase.from('payroll').update(updatedPayroll).eq('id', id);
    if (error) {
        console.error('Error updating payroll:', error);
    }
    return !error;
};
