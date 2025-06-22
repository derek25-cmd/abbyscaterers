
"use client";

import type { Ingredient } from "@/types";
import type { IngredientFormData } from "@/lib/schemas";

const INGREDIENTS_STORAGE_KEY = "caterSmartIngredients";

function getIngredientsFromStorage(): Ingredient[] {
  if (typeof window === "undefined") return [];
  let data = null;
  try {
    data = localStorage.getItem(INGREDIENTS_STORAGE_KEY);
  } catch (error) {
    console.error("Error reading ingredients from localStorage:", error);
    return [];
  }
  if (data) {
    try {
      return JSON.parse(data);
    } catch (error) {
      console.error("Error parsing ingredients from localStorage:", error);
      return [];
    }
  }
  return [];
}

function saveIngredientsToStorage(ingredients: Ingredient[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(INGREDIENTS_STORAGE_KEY, JSON.stringify(ingredients));
  } catch (error) {
    console.error("Error saving ingredients to localStorage:", error);
  }
}

export function getAllIngredients(): Ingredient[] {
  return getIngredientsFromStorage();
}

export function getIngredientById(itemNumber: string): Ingredient | undefined {
  const allIngredients = getIngredientsFromStorage();
  return allIngredients.find(ing => ing.itemNumber === itemNumber);
}

export function addIngredient(ingredientData: IngredientFormData): Ingredient {
  const allIngredients = getIngredientsFromStorage();
  const now = new Date().toISOString();

  if (allIngredients.some(ing => ing.itemNumber === ingredientData.itemNumber)) {
    throw new Error(`Ingredient No. "${ingredientData.itemNumber}" already exists.`);
  }

  const newIngredient: Ingredient = {
    ...ingredientData,
    unitPrice: Number(ingredientData.unitPrice),
    createdAt: now,
    updatedAt: now,
  };
  const updatedIngredientList = [...allIngredients, newIngredient];
  saveIngredientsToStorage(updatedIngredientList);
  return newIngredient;
}

export function updateIngredient(originalItemNumber: string, updates: IngredientFormData): Ingredient | undefined {
  const allIngredients = getIngredientsFromStorage();
  const ingredientIndex = allIngredients.findIndex(ing => ing.itemNumber === originalItemNumber);
  if (ingredientIndex === -1) return undefined;

  if (updates.itemNumber && updates.itemNumber !== originalItemNumber && allIngredients.some(ing => ing.itemNumber === updates.itemNumber)) {
    throw new Error(`Cannot update Item No. to "${updates.itemNumber}" as it already exists for another ingredient.`);
  }
  
  const updatedIngredient: Ingredient = {
    ...allIngredients[ingredientIndex],
    ...updates,
    itemNumber: updates.itemNumber,
    unitPrice: Number(updates.unitPrice),
    updatedAt: new Date().toISOString(),
  };

  const updatedAllIngredients = [...allIngredients];
  updatedAllIngredients[ingredientIndex] = updatedIngredient;
  saveIngredientsToStorage(updatedAllIngredients);
  return updatedIngredient;
}

export function deleteIngredient(itemNumber: string): boolean {
  let allIngredients = getIngredientsFromStorage();
  const initialLength = allIngredients.length;
  allIngredients = allIngredients.filter(ing => ing.itemNumber !== itemNumber);
  if (allIngredients.length < initialLength) {
    saveIngredientsToStorage(allIngredients);
    return true;
  }
  return false;
}


export function addMultipleIngredients(ingredientDataList: IngredientFormData[]): Ingredient[] {
  const allIngredients = getIngredientsFromStorage();
  const now = new Date().toISOString();

  const newIngredientList: Ingredient[] = [];
  const existingNumbers = new Set(allIngredients.map(ing => ing.itemNumber));
  const newNumbersInBatch = new Set<string>();

  for (const ingredientData of ingredientDataList) {
    if (existingNumbers.has(ingredientData.itemNumber) || newNumbersInBatch.has(ingredientData.itemNumber)) {
      throw new Error(`Duplicate Item No. found during import: "${ingredientData.itemNumber}". Aborting import.`);
    }

    const newIngredient: Ingredient = {
      ...ingredientData,
      unitPrice: Number(ingredientData.unitPrice),
      createdAt: now,
      updatedAt: now,
    };
    newIngredientList.push(newIngredient);
    newNumbersInBatch.add(newIngredient.itemNumber);
  }

  const updatedIngredientList = [...allIngredients, ...newIngredientList];
  saveIngredientsToStorage(updatedIngredientList);
  return newIngredientList;
}
