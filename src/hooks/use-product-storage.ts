
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { Product } from "@/types";
import {
  getProducts as getAllFromStorage,
  addProduct as addToStorage,
  updateProduct as updateInStorage,
} from '@/services/productService';

export function useProductStorage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshProducts = useCallback(async () => {
    setIsLoading(true);
    const data = await getAllFromStorage();
    setProducts(data);
    setIsLoading(false);
  }, []);
  
  useEffect(() => {
    refreshProducts();
  }, [refreshProducts]);
  
  const addProduct = useCallback(async (data: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'sku'>) => {
    const newItem = await addToStorage(data);
    if(newItem) {
        refreshProducts();
    }
    return newItem;
  }, [refreshProducts]);

  const updateProduct = useCallback(async (id: string, updates: Partial<Product>) => {
    const success = await updateInStorage(id, updates);
    if (success) {
      refreshProducts();
    }
    return success;
  }, [refreshProducts]);

  const getProductById = useCallback((id: string) => {
     return products.find(p => p.id === id);
  }, [products]);

  return {
    products,
    isLoading,
    addProduct,
    updateProduct,
    getProductById,
    refreshProducts
  };
}
