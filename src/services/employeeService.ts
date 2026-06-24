
import { supabase } from '@/lib/supabase-client';
import { Employee } from '@/types';
import { EmployeeSchema } from '@/lib/schemas';
import { validate } from '@/lib/service-validation';

export const getEmployees = async (): Promise<Employee[]> => {
    const { data, error } = await supabase.from('employees').select('*');
    if (error) {
        console.error('Error fetching employees:', error);
        return [];
    }
    return data as Employee[];
};

export const addEmployee = async (employee: Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>): Promise<Employee> => {
    const validated = validate(EmployeeSchema, employee);
    const { data, error } = await supabase.from('employees').insert([validated]).select();
    if (error) {
        throw new Error(error.message);
    }
    return data![0] as Employee;
};

export const updateEmployee = async (id: string, updatedEmployee: Partial<Employee>): Promise<boolean> => {
    const { error } = await supabase.from('employees').update(updatedEmployee).eq('id', id);
    if (error) {
        console.error('Error updating employee:', error);
    }
    return !error;
};
