// @ts-nocheck
import { assets as mockAssets } from '@/lib/mock-data';

const ASSETS_STORAGE_KEY = 'assets';

const initializeAssets = () => {
    if (typeof window !== 'undefined' && !localStorage.getItem(ASSETS_STORAGE_KEY)) {
        localStorage.setItem(ASSETS_STORAGE_KEY, JSON.stringify(mockAssets));
    }
};

initializeAssets();

export const getAssets = async () => {
    if (typeof window === 'undefined') return [];
    const assets = JSON.parse(localStorage.getItem(ASSETS_STORAGE_KEY) || '[]');
    return Promise.resolve(assets);
};

export const addAsset = async (asset) => {
    if (typeof window === 'undefined') return;
    const assets = await getAssets();
    const newAsset = { ...asset, id: `ASSET${Date.now()}` };
    const updatedAssets = [newAsset, ...assets];
    localStorage.setItem(ASSETS_STORAGE_KEY, JSON.stringify(updatedAssets));
    return Promise.resolve(newAsset.id);
};

export const updateAsset = async (id, updatedAsset) => {
    if (typeof window === 'undefined') return;
    const assets = await getAssets();
    const updatedAssets = assets.map(asset => 
        asset.id === id ? { ...asset, ...updatedAsset } : asset
    );
    localStorage.setItem(ASSETS_STORAGE_KEY, JSON.stringify(updatedAssets));
    return Promise.resolve();
};
