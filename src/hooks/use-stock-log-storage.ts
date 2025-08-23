
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

  useEffect(() => {
    if (typeof window !== "undefined") {
      setLogs(getAllFromStorage());
      setIsLoading(false);
    }
  }, []);

  const refreshLogs = useCallback(() => {
    if (typeof window !== "undefined") {
      setLogs(getAllFromStorage());
    }
  }, []);

  const addStockLog = useCallback((data: Omit<StockLog, 'id' | 'createdAt' | 'updatedAt'>) => {
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

  return {
    logs,
    isLoading,
    addStockLog,
    updateStockLog,
    refreshLogs
  };
}
