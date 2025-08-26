
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { StockLog } from "@/types";
import { 
  getAllStockLogs as getAllFromStorage,
  addStockLog as addToStorage,
  updateStockLog as updateInStorage,
} from '@/lib/stock-log-data';

export function useStockLogStorage() {
  const [logs, setLogs] = useState<StockLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshLogs = useCallback(() => {
    if (typeof window !== "undefined") {
      const storedLogs = getAllFromStorage();
      // Ensure quantity and price are numbers
      const sanitizedLogs = storedLogs.map(log => ({
        ...log,
        quantity: Number(log.quantity) || 0,
        price: Number(log.price) || 0,
      }));
      setLogs(sanitizedLogs);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      refreshLogs();
      setIsLoading(false);
    }
  }, [refreshLogs]);

  const addStockLog = useCallback((data: Omit<StockLog, 'id' | 'createdAt' | 'updatedAt' | 'date'>) => {
    const newItem = addToStorage(data);
    refreshLogs();
    return newItem;
  }, [refreshLogs]);

  const updateStockLog = useCallback((id: string, updates: Partial<StockLog>) => {
    const updatedItem = updateInStorage(id, updates);
    if (updatedItem) {
      refreshLogs();
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
