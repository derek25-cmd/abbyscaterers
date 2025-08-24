
"use client";

import type { StockLog } from "@/types";
import { format } from "date-fns";

const STOCK_LOGS_KEY = "caterSmartStockLogs";

function getStockLogsFromStorage(): StockLog[] {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(STOCK_LOGS_KEY);
  try {
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error("Failed to parse stock logs from storage", e);
    return [];
  }
}

function saveStockLogsToStorage(logs: StockLog[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STOCK_LOGS_KEY, JSON.stringify(logs));
  } catch (e) {
    console.error("Failed to save stock logs to storage", e);
  }
}

export function getAllStockLogs(): StockLog[] {
  return getStockLogsFromStorage();
}

export function addStockLog(logData: Omit<StockLog, 'id' | 'createdAt' | 'updatedAt' | 'date'>): StockLog {
  const allLogs = getStockLogsFromStorage();
  const now = new Date();
  
  const newLog: StockLog = {
    id: `LOG-${Date.now()}`,
    ...logData,
    date: format(now, 'yyyy-MM-dd'), // Standardize date format
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  const updatedLogs = [newLog, ...allLogs].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  saveStockLogsToStorage(updatedLogs);
  return newLog;
}

export function updateStockLog(id: string, updates: Partial<StockLog>): StockLog | undefined {
    const allLogs = getStockLogsFromStorage();
    const logIndex = allLogs.findIndex(log => log.id === id);
    if (logIndex === -1) return undefined;

    const updatedLog: StockLog = {
        ...allLogs[logIndex],
        ...updates,
        updatedAt: new Date().toISOString(),
    };

    allLogs[logIndex] = updatedLog;
    saveStockLogsToStorage(allLogs);
    return updatedLog;
}
