
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { StockLog } from "@/types";
import {
  getStockLogs as getAllFromStorage,
  addStockLog as addToStorage,
  updateStockLog as updateInStorage,
  deleteStockLog as deleteFromStorage,
  deleteStockLogs as deleteBulkFromStorage,
} from '@/services/stockLogService';
import { useToast } from '@/hooks/use-toast';
import { getErrorDescription } from '@/lib/service-validation';

export function useStockLogStorage() {
  const [logs, setLogs] = useState<StockLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const { toast } = useToast();

  const refreshLogs = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    const { data: storedLogs, error } = await getAllFromStorage();

    if (error) {
      setFetchError(`Failed to load stock logs: ${error.message}`);
      setIsLoading(false);
      return;
    }

    const sanitizedLogs = (storedLogs || []).map((log: StockLog) => ({
      ...log,
      quantity: Number(log.quantity) || 0,
      price: Number(log.price) || 0,
    }));

    setLogs(sanitizedLogs.sort((a: StockLog, b: StockLog) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    ));
    setIsLoading(false);
  }, []);

  useEffect(() => {
    refreshLogs();
  }, [refreshLogs]);

  const addStockLog = useCallback(async (data: Omit<StockLog, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const result = await addToStorage(data);
      if (!result) throw new Error('No data returned from database.');
      refreshLogs();
      return result;
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed to save stock log', description: getErrorDescription(err) });
      return null;
    }
  }, [refreshLogs, toast]);

  const updateStockLog = useCallback(async (id: string, updates: Partial<StockLog>) => {
    try {
      const updatedItem = await updateInStorage(id, updates);
      if (updatedItem) refreshLogs();
      return updatedItem;
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed to update stock log', description: getErrorDescription(err) });
      return null;
    }
  }, [refreshLogs, toast]);

  const deleteStockLog = useCallback(async (id: string) => {
    try {
      const success = await deleteFromStorage(id);
      if (success) refreshLogs();
      return success;
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed to delete stock log', description: getErrorDescription(err) });
      return false;
    }
  }, [refreshLogs, toast]);

  const deleteStockLogs = useCallback(async (ids: string[]) => {
    try {
      const success = await deleteBulkFromStorage(ids);
      if (success) refreshLogs();
      return success;
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed to delete stock logs', description: getErrorDescription(err) });
      return false;
    }
  }, [refreshLogs, toast]);

  const bulkUpdateStockLogs = useCallback(async (updates: { id: string, data: Partial<StockLog> }[]) => {
    try {
      for (const update of updates) {
        await updateInStorage(update.id, update.data);
      }
      refreshLogs();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Failed to update stock logs', description: getErrorDescription(err) });
    }
  }, [refreshLogs, toast]);

  const getStockLogById = useCallback((id: string) => {
    return logs.find(l => l.id === id);
  }, [logs]);

  return {
    logs,
    isLoading,
    fetchError,
    addStockLog,
    updateStockLog,
    bulkUpdateStockLogs,
    deleteStockLog,
    deleteStockLogs,
    refreshLogs,
    getStockLogById
  };
}
