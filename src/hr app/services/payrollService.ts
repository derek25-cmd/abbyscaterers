// @ts-nocheck
import { payrolls as mockPayrolls } from '@/lib/mock-data';

const PAYROLL_STORAGE_KEY = 'payrolls';

const initializePayrolls = () => {
    if (typeof window !== 'undefined' && !localStorage.getItem(PAYROLL_STORAGE_KEY)) {
        localStorage.setItem(PAYROLL_STORAGE_KEY, JSON.stringify(mockPayrolls));
    }
};

initializePayrolls();

export const getPayrolls = async () => {
    if (typeof window === 'undefined') return [];
    const payrolls = JSON.parse(localStorage.getItem(PAYROLL_STORAGE_KEY) || '[]');
    return Promise.resolve(payrolls);
};

export const addPayroll = async (payroll) => {
    if (typeof window === 'undefined') return;
    const payrolls = await getPayrolls();
    const newPayroll = { ...payroll, id: `PAY${Date.now()}` };
    const updatedPayrolls = [newPayroll, ...payrolls];
    localStorage.setItem(PAYROLL_STORAGE_KEY, JSON.stringify(updatedPayrolls));
    return Promise.resolve(newPayroll.id);
};

export const updatePayroll = async (id, updatedPayroll) => {
    if (typeof window === 'undefined') return;
    const payrolls = await getPayrolls();
    const updatedPayrolls = payrolls.map(p => 
        p.id === id ? { ...p, ...updatedPayroll } : p
    );
    localStorage.setItem(PAYROLL_STORAGE_KEY, JSON.stringify(updatedPayrolls));
    return Promise.resolve();
};
