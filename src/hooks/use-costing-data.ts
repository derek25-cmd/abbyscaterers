
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { DailyCosting } from "@/types";
import { 
  getAllCostingSnapshots,
  getCostingSnapshotByDate,
  saveCostingSnapshot as saveSnapshotToStorage,
  deleteCostingSnapshot as deleteSnapshotFromStorage
} from '@/lib/costing-data';

export function useCostingData() {
  const [costingHistory, setCostingHistory] = useState<DailyCosting[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setCostingHistory(getAllCostingSnapshots());
      setIsLoading(false);
    }
  }, []);

  const refreshHistory = useCallback(() => {
    if (typeof window !== "undefined") {
      setCostingHistory(getAllCostingSnapshots());
    }
  }, []);

  const saveDailySnapshot = useCallback((snapshotData: Omit<DailyCosting, 'createdAt'>) => {
    const newSnapshot = saveSnapshotToStorage(snapshotData);
    // Refresh state to ensure it's in sync
    refreshHistory();
    return newSnapshot;
  }, [refreshHistory]);

  const deleteDailySnapshot = useCallback((date: string) => {
    const success = deleteSnapshotFromStorage(date);
    if (success) {
      setCostingHistory(prev => prev.filter(s => s.date !== date));
    }
    return success;
  }, []);
  
  const getSnapshotByDate = useCallback((date: string) => {
    return getCostingSnapshotByDate(date);
  }, []);

  return { 
    costingHistory, 
    isLoading, 
    saveDailySnapshot, 
    deleteDailySnapshot,
    getSnapshotByDate,
    refreshHistory
  };
}
