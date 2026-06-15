"use client";

import { useState, useEffect, useCallback } from 'react';
import type { Issuance } from "@/types";
import {
  getIssuances as getAllFromStorage,
  addIssuance as addToStorage,
  updateIssuance as updateInStorage,
  getIssuanceById as getByIdFromStorage
} from '@/services/issuanceService';
import { useToast } from '@/hooks/use-toast';
import { getErrorDescription } from '@/lib/service-validation';

export function useIssuanceStorage() {
  const [issuances, setIssuances] = useState<Issuance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

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
    try {
      const newIssuance = await addToStorage(data);
      if (newIssuance) refreshIssuances();
      return newIssuance;
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed to save issuance', description: getErrorDescription(err) });
      return null;
    }
  }, [refreshIssuances, toast]);

  const updateIssuance = useCallback(async (id: string, updates: Partial<Issuance>) => {
    try {
      const success = await updateInStorage(id, updates);
      if (success) refreshIssuances();
      return success;
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed to update issuance', description: getErrorDescription(err) });
      return false;
    }
  }, [refreshIssuances, toast]);

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
