// @ts-nocheck
import { stockLogs as mockStockLogs } from '@/lib/mock-data';
import { format } from "date-fns";

const STOCKLOGS_STORAGE_KEY = 'stockLogs';

const initializeStockLogs = () => {
    if (typeof window !== 'undefined' && !localStorage.getItem(STOCKLOGS_STORAGE_KEY)) {
        localStorage.setItem(STOCKLOGS_STORAGE_KEY, JSON.stringify(mockStockLogs));
    }
};

initializeStockLogs();

export const getStockLogs = async () => {
    if (typeof window === 'undefined') return [];
    const logs = JSON.parse(localStorage.getItem(STOCKLOGS_STORAGE_KEY) || '[]');
    return Promise.resolve(logs);
};

export const addStockLog = async (log) => {
    if (typeof window === 'undefined') return;
    const logs = await getStockLogs();
    const newLog = { 
        ...log, 
        id: `LOG${Date.now()}`,
        date: format(new Date(), 'yyyy-MM-dd')
    };
    const updatedLogs = [newLog, ...logs];
    localStorage.setItem(STOCKLOGS_STORAGE_KEY, JSON.stringify(updatedLogs));
    return Promise.resolve(newLog.id);
};

export const updateStockLog = async (id, updatedLog) => {
    if (typeof window === 'undefined') return;
    const logs = await getStockLogs();
    const updatedLogs = logs.map(log =>
        log.id === id ? { ...log, ...updatedLog } : log
    );
    localStorage.setItem(STOCKLOGS_STORAGE_KEY, JSON.stringify(updatedLogs));
    return Promise.resolve();
};
