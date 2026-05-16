
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

export function useStockLogStorage() {
  const [logs, setLogs] = useState<StockLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const refreshLogs = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    console.log('[DEBUG StockLogs] Fetching from Supabase...');
    const { data: storedLogs, error } = await getAllFromStorage();
    
    if (error) {
      console.error('[DEBUG StockLogs] Supabase fetch error:', JSON.stringify(error, null, 2));
      setFetchError(`Failed to load stock logs: ${error.message}`);
      setIsLoading(false);
      return;
    }

    console.log('[DEBUG StockLogs] Raw data from Supabase:', storedLogs);
    
    const sanitizedLogs = (storedLogs || []).map((log: StockLog) => ({
      ...log,
      quantity: Number(log.quantity) || 0,
      price: Number(log.price) || 0,
    }));
    
    const sortedLogs = sanitizedLogs.sort((a: StockLog, b: StockLog) => new Date(b.date).getTime() - new Date(a.date).getTime());
    console.log('[DEBUG StockLogs] Sanitized & Sorted logs count:', sortedLogs.length);
    
    setLogs(sortedLogs);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    refreshLogs();
  }, [refreshLogs]);

  const addStockLog = useCallback(async (data: Omit<StockLog, 'id' | 'createdAt' | 'updatedAt'>) => {
    const result = await addToStorage(data);
    if (!result) {
      throw new Error('Failed to save stock log to database.');
    }
    refreshLogs();
    return result;
  }, [refreshLogs]);

  const updateStockLog = useCallback(async (id: string, updates: Partial<StockLog>) => {
    const updatedItem = await updateInStorage(id, updates);
    if (updatedItem) {
      refreshLogs(); // Refresh after updating
    }
    return updatedItem;
  }, [refreshLogs]);

  const deleteStockLog = useCallback(async (id: string) => {
    const success = await deleteFromStorage(id);
    if (success) {
      refreshLogs();
    }
    return success;
  }, [refreshLogs]);

  const deleteStockLogs = useCallback(async (ids: string[]) => {
    const success = await deleteBulkFromStorage(ids);
    if (success) {
      refreshLogs();
    }
    return success;
  }, [refreshLogs]);

  const bulkUpdateStockLogs = useCallback(async (updates: { id: string, data: Partial<StockLog> }[]) => {
    for (const update of updates) {
      await updateInStorage(update.id, update.data);
    }
    refreshLogs();
  }, [refreshLogs]);
  
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
