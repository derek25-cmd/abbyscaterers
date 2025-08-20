
// @ts-nocheck
import { issuanceLog as mockIssuanceLog } from '@/lib/mock-data';

const ISSUANCE_STORAGE_KEY = 'issuanceLog';

// This is a one-time initialization to prevent overwriting data on every page load.
const initializeIssuanceLog = () => {
    if (typeof window !== 'undefined') {
        if (!localStorage.getItem(ISSUANCE_STORAGE_KEY)) {
            localStorage.setItem(ISSUANCE_STORAGE_KEY, JSON.stringify(mockIssuanceLog));
        }
    }
};

initializeIssuanceLog();

export const getIssuances = async () => {
    if (typeof window === 'undefined') return [];
    const logs = localStorage.getItem(ISSUANCE_STORAGE_KEY);
    return Promise.resolve(logs ? JSON.parse(logs) : []);
};

export const addIssuance = async (log) => {
    if (typeof window === 'undefined') return;
    const logs = await getIssuances();
    const now = new Date().toISOString();
    const newLog = { 
        ...log, 
        id: `ISS${Date.now()}`,
        createdAt: now,
        updatedAt: now,
    };
    const updatedLogs = [newLog, ...logs];
    localStorage.setItem(ISSUANCE_STORAGE_KEY, JSON.stringify(updatedLogs));
    return Promise.resolve(newLog);
};

export const updateIssuance = async (id, updatedLog) => {
    if (typeof window === 'undefined') return;
    const logs = await getIssuances();
    const now = new Date().toISOString();
    const updatedLogs = logs.map(l => (l.id === id ? { ...l, ...updatedLog, updatedAt: now } : l));
    localStorage.setItem(ISSUANCE_STORAGE_KEY, JSON.stringify(updatedLogs));
    return Promise.resolve();
};

export const getIssuanceById = async (id) => {
    if (typeof window === 'undefined') return null;
    const logs = await getIssuances();
    return Promise.resolve(logs.find(l => l.id === id) || null);
};
