
"use client";

import type { DailyCosting } from "@/types";

const COSTING_HISTORY_KEY = "caterSmartCostingHistory";

function getCostingHistoryFromStorage(): DailyCosting[] {
  if (typeof window === "undefined") return [];
  let data = null;
  try {
    data = localStorage.getItem(COSTING_HISTORY_KEY);
  } catch (error) {
    console.error("Error reading costing history from localStorage:", error);
    return [];
  }
  if (data) {
    try {
      return JSON.parse(data);
    } catch (error) {
      console.error("Error parsing costing history from localStorage:", error);
      return [];
    }
  }
  return [];
}

function saveCostingHistoryToStorage(history: DailyCosting[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(COSTING_HISTORY_KEY, JSON.stringify(history));
  } catch (error) {
    console.error("Error saving costing history to localStorage:", error);
  }
}

export function getAllCostingSnapshots(): DailyCosting[] {
  return getCostingHistoryFromStorage();
}

export function getCostingSnapshotByDate(date: string): DailyCosting | undefined {
  const history = getCostingHistoryFromStorage();
  return history.find(snapshot => snapshot.date === date);
}

export function saveCostingSnapshot(snapshotData: Omit<DailyCosting, 'createdAt'>): DailyCosting {
  const history = getCostingHistoryFromStorage();
  const now = new Date().toISOString();

  const existingIndex = history.findIndex(s => s.date === snapshotData.date);

  const newSnapshot: DailyCosting = {
    ...snapshotData,
    createdAt: now,
  };

  if (existingIndex !== -1) {
    // Update existing snapshot for the date
    history[existingIndex] = { ...history[existingIndex], ...snapshotData };
  } else {
    // Add new snapshot
    history.push(newSnapshot);
  }

  // Keep history sorted by date
  history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  saveCostingHistoryToStorage(history);
  return newSnapshot;
}

export function deleteCostingSnapshot(date: string): boolean {
  let history = getCostingHistoryFromStorage();
  const initialLength = history.length;
  history = history.filter(snapshot => snapshot.date !== date);

  if (history.length < initialLength) {
    saveCostingHistoryToStorage(history);
    return true;
  }
  return false;
}

export const initialIngredients = [];
export const eventsDatabase = [];

    