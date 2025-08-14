// @ts-nocheck
import { issuanceLog as mockIssuanceLog } from '@/lib/mock-data';

const ISSUANCE_STORAGE_KEY = 'issuanceLog';

const initializeIssuanceLog = () => {
    if (typeof window !== 'undefined' && !localStorage.getItem(ISSUANCE_STORAGE_KEY)) {
        localStorage.setItem(ISSUANCE_STORAGE_KEY, JSON.stringify(mockIssuanceLog));
    }
};

initializeIssuanceLog();

export const getIssuances = async () => {
    if (typeof window === 'undefined') return [];
    const logs = JSON.parse(localStorage.getItem(ISSUANCE_STORAGE_KEY) || '[]');
    return Promise.resolve(logs);
};

export const addIssuance = async (log) => {
    if (typeof window === 'undefined') return;
    const logs = await getIssuances();
    const newLog = { ...log, id: `ISS${Date.now()}` };
    const updatedLogs = [newLog, ...logs];
    localStorage.setItem(ISSUANCE_STORAGE_KEY, JSON.stringify(updatedLogs));
    return Promise.resolve(newLog.id);
};

export const updateIssuance = async (id, updatedLog) => {
    if (typeof window === 'undefined') return;
    const logs = await getIssuances();
    const updatedLogs = logs.map(l => (l.id === id ? { ...l, ...updatedLog } : l));
    localStorage.setItem(ISSUANCE_STORAGE_KEY, JSON.stringify(updatedLogs));
    return Promise.resolve();
};
