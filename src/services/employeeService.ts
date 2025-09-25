
import { supabase } from '@/lib/supabase-client';

export const getEmployees = async () => {
    const { data, error } = await supabase.from('employees').select('*');
    if (error) {
        console.error('Error fetching employees:', error);
        return [];
    }
    return data;
};

export const addEmployee = async (employee: Omit<any, 'id'>) => {
    const { data, error } = await supabase.from('employees').insert([employee]).select();
    if (error) {
        console.error('Error adding employee:', error);
        return null;
    }
    return data?.[0]?.id;
};

export const updateEmployee = async (id: string, updatedEmployee: Partial<any>) => {
    const { error } = await supabase.from('employees').update(updatedEmployee).eq('id', id);
    if (error) {
        console.error('Error updating employee:', error);
    }
    return !error;
};
