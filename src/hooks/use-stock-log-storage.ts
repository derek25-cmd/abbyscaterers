

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

  const processLogs = (rawLogs: any[]): StockLog[] => {
    return rawLogs.map(log => ({
      ...log,
      quantity: Number(log.quantity) || 0,
      price: Number(log.price) || 0,
    }));
  };

  const refreshLogs = useCallback(() => {
    if (typeof window !== "undefined") {
      const rawLogs = getAllFromStorage();
      setLogs(processLogs(rawLogs));
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const rawLogs = getAllFromStorage();
      setLogs(processLogs(rawLogs));
      setIsLoading(false);
    }
  }, []);

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

  return {
    logs,
    isLoading,
    addStockLog,
    updateStockLog,
    refreshLogs
  };
}
