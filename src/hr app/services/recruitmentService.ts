// @ts-nocheck
import { openPositions as mockPositions } from '@/lib/mock-data';

const POSITIONS_STORAGE_KEY = 'openPositions';

const initializePositions = () => {
    if (typeof window !== 'undefined' && !localStorage.getItem(POSITIONS_STORAGE_KEY)) {
        localStorage.setItem(POSITIONS_STORAGE_KEY, JSON.stringify(mockPositions));
    }
};

initializePositions();

export const getPositions = async () => {
    if (typeof window === 'undefined') return [];
    const positions = JSON.parse(localStorage.getItem(POSITIONS_STORAGE_KEY) || '[]');
    return Promise.resolve(positions);
};

export const addPosition = async (position) => {
    if (typeof window === 'undefined') return;
    const positions = await getPositions();
    const newPosition = { ...position, id: `JOB${Date.now()}` };
    const updatedPositions = [newPosition, ...positions];
    localStorage.setItem(POSITIONS_STORAGE_KEY, JSON.stringify(updatedPositions));
    return Promise.resolve(newPosition.id);
};

export const updatePosition = async (id, updatedPosition) => {
    if (typeof window === 'undefined') return;
    const positions = await getPositions();
    const updatedPositions = positions.map(p =>
        p.id === id ? { ...p, ...updatedPosition } : p
    );
    localStorage.setItem(POSITIONS_STORAGE_KEY, JSON.stringify(updatedPositions));
    return Promise.resolve();
};
