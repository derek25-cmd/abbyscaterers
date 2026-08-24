
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { Product } from "@/types";
import {
  getProducts as getAllFromStorage,
  addProduct as addToStorage,
  updateProduct as updateInStorage,
} from '@/services/productService';
import { useToast } from '@/hooks/use-toast';
import { getErrorDescription } from '@/lib/service-validation';

export function useProductStorage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

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
    try {
      const newItem = await addToStorage(data);
      if (newItem) refreshProducts();
      return newItem;
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed to save product', description: getErrorDescription(err) });
      return null;
    }
  }, [refreshProducts, toast]);

  const updateProduct = useCallback(async (id: string, updates: Partial<Product>) => {
    try {
      const success = await updateInStorage(id, updates);
      if (success) refreshProducts();
      return success;
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed to update product', description: getErrorDescription(err) });
      return false;
    }
  }, [refreshProducts, toast]);

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
