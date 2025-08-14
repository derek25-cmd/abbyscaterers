// @ts-nocheck
import { employees as mockEmployees } from '@/lib/mock-data';

const EMPLOYEES_STORAGE_KEY = 'employees';

const initializeEmployees = () => {
    if (typeof window !== 'undefined' && !localStorage.getItem(EMPLOYEES_STORAGE_KEY)) {
        localStorage.setItem(EMPLOYEES_STORAGE_KEY, JSON.stringify(mockEmployees));
    }
};

initializeEmployees();

export const getEmployees = async () => {
    if (typeof window === 'undefined') return [];
    const employees = JSON.parse(localStorage.getItem(EMPLOYEES_STORAGE_KEY) || '[]');
    return Promise.resolve(employees);
};

export const addEmployee = async (employee) => {
    if (typeof window === 'undefined') return;
    const employees = await getEmployees();
    const newEmployee = { ...employee, id: `EMP${Date.now()}` };
    const updatedEmployees = [newEmployee, ...employees];
    localStorage.setItem(EMPLOYEES_STORAGE_KEY, JSON.stringify(updatedEmployees));
    return Promise.resolve(newEmployee.id);
};

export const updateEmployee = async (id, updatedEmployee) => {
    if (typeof window === 'undefined') return;
    const employees = await getEmployees();
    const updatedEmployees = employees.map(emp => 
        emp.id === id ? { ...emp, ...updatedEmployee } : emp
    );
    localStorage.setItem(EMPLOYEES_STORAGE_KEY, JSON.stringify(updatedEmployees));
    return Promise.resolve();
};
