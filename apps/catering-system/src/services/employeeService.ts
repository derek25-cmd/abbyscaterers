
import { supabase } from '@/lib/supabase-client';
import { Employee } from '@/types';
import { EmployeeSchema } from '@/lib/schemas';
import { validate } from '@/lib/service-validation';

export const getEmployees = async (): Promise<Employee[]> => {
    const PAGE = 1000;
    const all: Employee[] = [];
    let page = 0;
    while (true) {
        const { data, error } = await supabase
            .from('employees')
            .select('*')
            .range(page * PAGE, (page + 1) * PAGE - 1);
        if (error) { console.error('Error fetching employees:', error); break; }
        if (!data || data.length === 0) break;
        all.push(...(data as Employee[]));
        if (data.length < PAGE) break;
        page++;
    }
    return all;
};

/**
 * Name/department/status only, via the get_employee_directory() RPC. Use this
 * for pickers and name lookups: plain staff have no SELECT on employees (it
 * holds ID, bank and salary data), so getEmployees() returns nothing for
 * them. Fields beyond those six are absent despite the Employee type.
 */
export const getEmployeeDirectory = async (): Promise<Employee[]> => {
    const { data, error } = await supabase.rpc('get_employee_directory');
    if (error) {
        console.error('Error fetching employee directory:', error);
        return [];
    }
    return (data ?? []) as Employee[];
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
    // Payroll runs read monthlySalary directly off this record — validate
    // partial updates the same way addEmployee validates full records,
    // rather than trusting whatever shape the caller passes.
    const validated = validate(EmployeeSchema.partial(), updatedEmployee);
    const { error } = await supabase.from('employees').update(validated).eq('id', id);
    if (error) {
        console.error('Error updating employee:', error);
    }
    return !error;
};
