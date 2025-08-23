
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { Product } from "@/types";
import {
  getAllProducts as getAllFromStorage,
  addProduct as addToStorage,
  updateProduct as updateInStorage,
} from '@/lib/product-data';

export function useProductStorage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setProducts(getAllFromStorage());
      setIsLoading(false);
    }
  }, []);

  const refreshProducts = useCallback(() => {
    if (typeof window !== "undefined") {
      setProducts(getAllFromStorage());
    }
  }, []);
  
  const addProduct = useCallback((data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newItem = addToStorage(data);
    refreshProducts();
    return newItem;
  }, [refreshProducts]);

  const updateProduct = useCallback((id: string, updates: Partial<Product>) => {
    const updatedItem = updateInStorage(id, updates);
    if (updatedItem) {
      refreshProducts();
    }
    return updatedItem;
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
