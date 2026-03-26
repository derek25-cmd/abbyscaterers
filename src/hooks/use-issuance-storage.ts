"use client";

import { useState, useEffect, useCallback } from 'react';
import type { Issuance } from "@/types";
import { 
  getIssuances as getAllFromStorage,
  addIssuance as addToStorage,
  updateIssuance as updateInStorage,
  getIssuanceById as getByIdFromStorage
} from '@/services/issuanceService';

/**
 * Hook for managing asset issuance state and storage operations.
 */
export function useIssuanceStorage() {
  const [issuances, setIssuances] = useState<Issuance[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshIssuances = useCallback(async () => {
    setIsLoading(true);
    try {
        const data = await getAllFromStorage();
        setIssuances(data || []);
    } catch (error) {
        console.error("Failed to fetch issuances:", error);
        setIssuances([]);
    } finally {
        setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshIssuances();
  }, [refreshIssuances]);

  const addIssuance = useCallback(async (data: Omit<Issuance, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newIssuance = await addToStorage(data);
    if (newIssuance) {
      refreshIssuances();
    }
    return newIssuance;
  }, [refreshIssuances]);

  const updateIssuance = useCallback(async (id: string, updates: Partial<Issuance>) => {
    const success = await updateInStorage(id, updates);
    if (success) {
      refreshIssuances();
    }
    return success;
  }, [refreshIssuances]);

  const getIssuanceById = useCallback(async (id: string) => {
    return await getByIdFromStorage(id);
  }, []);

  return { 
    issuances, 
    isLoading, 
    addIssuance, 
    updateIssuance, 
    getIssuanceById,
    refreshIssuances 
  };
}
