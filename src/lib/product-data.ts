
"use client";

import type { Product } from "@/types";

const PRODUCTS_STORAGE_KEY = "caterSmartProducts";

function getProductsFromStorage(): Product[] {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(PRODUCTS_STORAGE_KEY);
  return data ? JSON.parse(data) : [];
}

function saveProductsToStorage(products: Product[]): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(products));
  }
}

export function getAllProducts(): Product[] {
  return getProductsFromStorage();
}

export function getProductById(id: string): Product | undefined {
  return getProductsFromStorage().find(p => p.id === id);
}

export function addProduct(productData: Omit<Product, 'id'| 'createdAt' | 'updatedAt'>): Product {
  const allProducts = getProductsFromStorage();
  const now = new Date().toISOString();

  const newProduct: Product = {
    id: `PROD-${Date.now()}`,
    ...productData,
    createdAt: now,
    updatedAt: now,
  };
  
  saveProductsToStorage([...allProducts, newProduct]);
  return newProduct;
}

export function updateProduct(id: string, updates: Partial<Product>): Product | undefined {
    const allProducts = getProductsFromStorage();
    const productIndex = allProducts.findIndex(p => p.id === id);
    if (productIndex === -1) return undefined;

    const updatedProduct: Product = {
        ...allProducts[productIndex],
        ...updates,
        updatedAt: new Date().toISOString(),
    };

    allProducts[productIndex] = updatedProduct;
    saveProductsToStorage(allProducts);
    return updatedProduct;
}
