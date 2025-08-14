// @ts-nocheck
import { stockInventory as mockProducts } from '@/lib/mock-data';

const PRODUCTS_STORAGE_KEY = 'products';

const initializeProducts = () => {
    if (typeof window !== 'undefined' && !localStorage.getItem(PRODUCTS_STORAGE_KEY)) {
        localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(mockProducts));
    }
};

initializeProducts();

export const getProducts = async () => {
    if (typeof window === 'undefined') return [];
    const products = JSON.parse(localStorage.getItem(PRODUCTS_STORAGE_KEY) || '[]');
    return Promise.resolve(products);
};

export const addProduct = async (product) => {
    if (typeof window === 'undefined') return;
    const products = await getProducts();
    const newProduct = { ...product, id: `PROD${Date.now()}` };
    const updatedProducts = [newProduct, ...products];
    localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(updatedProducts));
    return Promise.resolve(newProduct.id);
};

export const updateProduct = async (id, updatedProduct) => {
    if (typeof window === 'undefined') return;
    const products = await getProducts();
    const updatedProducts = products.map(p => 
        p.id === id ? { ...p, ...updatedProduct } : p
    );
    localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(updatedProducts));
    return Promise.resolve();
};
