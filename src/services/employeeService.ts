
import { supabase } from '@/lib/supabase-client';
import { Employee } from '@/types';

export const getEmployees = async (): Promise<Employee[]> => {
    const { data, error } = await supabase.from('employees').select('*');
    if (error) {
        console.error('Error fetching employees:', error);
        return [];
    }
    return data as Employee[];
};

export const addEmployee = async (employee: Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>): Promise<Employee | null> => {
    const { data, error } = await supabase.from('employees').insert([employee]).select();
    if (error) {
        console.error('Error adding employee:', error);
        return null;
    }
    return data?.[0] as Employee;
};

export const updateEmployee = async (id: string, updatedEmployee: Partial<Employee>): Promise<boolean> => {
    const { error } = await supabase.from('employees').update(updatedEmployee).eq('id', id);
    if (error) {
        console.error('Error updating employee:', error);
    }
    return !error;
};
