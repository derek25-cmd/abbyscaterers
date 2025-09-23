
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { StockLog } from "@/types";
import { 
  getStockLogs as getAllFromStorage,
  addStockLog as addToStorage,
  updateStockLog as updateInStorage,
} from '@/services/stockLogService';

export function useStockLogStorage() {
  const [logs, setLogs] = useState<StockLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshLogs = useCallback(() => {
    const fetchAndSanitize = async () => {
      setIsLoading(true);
      const storedLogs = await getAllFromStorage();
      const sanitizedLogs = storedLogs.map((log: StockLog) => ({
        ...log,
        quantity: Number(log.quantity) || 0,
        price: Number(log.price) || 0,
      }));
      setLogs(sanitizedLogs.sort((a: StockLog, b: StockLog) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      setIsLoading(false);
    };

    if (typeof window !== "undefined") {
      fetchAndSanitize();
    }
  }, []);

  useEffect(() => {
    refreshLogs();
  }, [refreshLogs]);

  const addStockLog = useCallback(async (data: Omit<StockLog, 'id' | 'createdAt' | 'updatedAt' | 'date'>) => {
    await addToStorage(data);
    refreshLogs(); // Refresh after adding
  }, [refreshLogs]);

  const updateStockLog = useCallback(async (id: string, updates: Partial<StockLog>) => {
    const updatedItem = await updateInStorage(id, updates);
    if (updatedItem) {
      refreshLogs(); // Refresh after updating
    }
    return updatedItem;
  }, [refreshLogs]);
  
  const getStockLogById = useCallback((id: string) => {
     return logs.find(l => l.id === id);
  }, [logs]);

  return { 
    logs, 
    isLoading, 
    addStockLog, 
    updateStockLog, 
    getStockLogById,
    refreshLogs 
  };
}
