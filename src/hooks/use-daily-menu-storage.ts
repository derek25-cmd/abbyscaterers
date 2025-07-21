
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { DailyMenu, ClientEvent } from "@/types";
import type { DailyMenuFormData } from "@/lib/schemas";
import { 
  getAllDailyMenus as getAllMenusFromStorage,
  getDailyMenuById as getMenuByIdFromStorage,
  addDailyMenu as addMenuToStorage,
  updateDailyMenu as updateMenuInStorage,
  deleteDailyMenu as deleteMenuFromStorage 
} from '@/lib/daily-menu-data';
import { format } from 'date-fns';

export function useDailyMenuStorage() {
  const [menus, setMenus] = useState<DailyMenu[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setMenus(getAllMenusFromStorage());
      setIsLoading(false);
    }
  }, []);

  const refreshMenus = useCallback(() => {
    if (typeof window !== "undefined") {
      setMenus(getAllMenusFromStorage());
    }
  }, []);

  const addMenu = useCallback((menuData: DailyMenuFormData) => {
    const newMenu = addMenuToStorage(menuData);
    setMenus(prevMenus => [...prevMenus, newMenu]);
    return newMenu;
  }, []);

  const updateMenu = useCallback((originalId: string, updates: DailyMenuFormData) => {
    const updatedItem = updateMenuInStorage(originalId, updates);
    if (updatedItem) {
      setMenus(prevMenus => 
        prevMenus.map(menu => menu.id === originalId ? updatedItem : menu)
      );
      refreshMenus(); // In case the ID changed, refresh the whole list
    }
    return updatedItem;
  }, [refreshMenus]);

  const deleteMenu = useCallback((id: string) => {
    const success = deleteMenuFromStorage(id);
    if (success) {
      setMenus(prevMenus => prevMenus.filter(menu => menu.id !== id));
    }
    return success;
  }, []);
  
  const getMenuById = useCallback((id: string) => {
    return getMenuByIdFromStorage(id);
  }, []);
  
  const getEventsForDate = useCallback((date: Date): ClientEvent[] => {
    const targetDateStr = format(date, 'yyyy-MM-dd');
    const allEvents: ClientEvent[] = [];
    menus.forEach(menu => {
        menu.clientEvents.forEach(event => {
            const eventDateStr = format(new Date(event.date), 'yyyy-MM-dd');
            if (eventDateStr === targetDateStr) {
                allEvents.push(event);
            }
        });
    });
    return allEvents;
  }, [menus]);

  return { 
    menus, 
    isLoading, 
    addMenu, 
    updateMenu, 
    deleteMenu, 
    getMenuById,
    refreshMenus,
    getEventsForDate
  };
}
