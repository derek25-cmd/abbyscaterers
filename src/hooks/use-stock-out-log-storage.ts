
"use client";

import { useState, useEffect, useMemo } from 'react';
import type { StockLog } from "@/types";
import { getAllStockLogs } from '@/lib/stock-log-data';

export function useStockOutLogs() {
  const [allLogs, setAllLogs] = useState<StockLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setAllLogs(getAllStockLogs());
      setIsLoading(false);
    }
  }, []);

  const stockOutLogs = useMemo(() => {
    return allLogs.filter(log => log.type === 'Stock Out');
  }, [allLogs]);

  return {
    stockOutLogs,
    isLoading
  };
}
