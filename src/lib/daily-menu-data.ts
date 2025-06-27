
"use client";

import type { DailyMenu } from "@/types";
import type { DailyMenuFormData } from "@/lib/schemas";

const DAILY_MENUS_STORAGE_KEY = "caterSmartDailyMenus";

function getMenusFromStorage(): DailyMenu[] {
  if (typeof window === "undefined") return [];
  let data = null;
  try {
    data = localStorage.getItem(DAILY_MENUS_STORAGE_KEY);
  } catch (error) {
    console.error("Error reading daily menus from localStorage:", error);
    return [];
  }

  if (data) {
    try {
      return JSON.parse(data);
    } catch (error) {
      console.error("Error parsing daily menus from localStorage:", error);
      return [];
    }
  }
  return [];
}

function saveMenusToStorage(menus: DailyMenu[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DAILY_MENUS_STORAGE_KEY, JSON.stringify(menus));
  } catch (error) {
    console.error("Error saving daily menus to localStorage:", error);
  }
}

export function getAllDailyMenus(): DailyMenu[] {
  return getMenusFromStorage();
}

export function getDailyMenuById(id: string): DailyMenu | undefined {
  const allMenus = getMenusFromStorage();
  return allMenus.find(menu => menu.id === id);
}

export function addDailyMenu(menuData: DailyMenuFormData): DailyMenu {
  const allMenus = getMenusFromStorage();
  const now = new Date().toISOString();

  if (allMenus.some(menu => menu.id === menuData.id)) {
    throw new Error(`Menu ID "${menuData.id}" already exists.`);
  }

  const newMenu: DailyMenu = {
    ...menuData,
    items: menuData.items.map(item => ({ recipeId: item.recipeId })),
    createdAt: now,
    updatedAt: now,
  };
  const updatedMenuList = [...allMenus, newMenu];
  saveMenusToStorage(updatedMenuList);
  return newMenu;
}

export function updateDailyMenu(originalId: string, updates: DailyMenuFormData): DailyMenu | undefined {
  const allMenus = getMenusFromStorage();
  const menuIndex = allMenus.findIndex(menu => menu.id === originalId);
  if (menuIndex === -1) return undefined;

  if (updates.id && updates.id !== originalId && allMenus.some(menu => menu.id === updates.id)) {
    throw new Error(`Cannot update Menu ID to "${updates.id}" as it already exists for another menu.`);
  }
  
  const updatedMenu: DailyMenu = {
    ...allMenus[menuIndex],
    ...updates,
    id: updates.id,
    items: updates.items.map(item => ({ recipeId: item.recipeId })),
    updatedAt: new Date().toISOString(),
  };
  
  const updatedAllMenus = [...allMenus];
  updatedAllMenus[menuIndex] = updatedMenu;
  saveMenusToStorage(updatedAllMenus);
  return updatedMenu;
}

export function deleteDailyMenu(id: string): boolean {
  let allMenus = getMenusFromStorage();
  const initialLength = allMenus.length;
  allMenus = allMenus.filter(menu => menu.id !== id);
  if (allMenus.length < initialLength) {
    saveMenusToStorage(allMenus);
    return true;
  }
  return false;
}
