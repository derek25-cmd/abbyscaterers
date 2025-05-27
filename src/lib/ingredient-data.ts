
"use client";

import type { Ingredient } from "@/types";
import type { IngredientFormData } from "@/lib/schemas";

const INGREDIENTS_STORAGE_KEY = "caterSmartIngredients";

function getIngredientsFromStorage(): Ingredient[] {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(INGREDIENTS_STORAGE_KEY);
  return data ? JSON.parse(data) : [];
}

function saveIngredientsToStorage(ingredients: Ingredient[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(INGREDIENTS_STORAGE_KEY, JSON.stringify(ingredients));
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
    id: ingredientData.itemNumber, // Use itemNumber as the internal ID
    unitPrice: Number(ingredientData.unitPrice),
    createdAt: now,
    updatedAt: now,
  };
  const updatedIngredientList = [...allIngredients, newIngredient];
  saveIngredientsToStorage(updatedIngredientList);
  return newIngredient;
}

export function updateIngredient(originalItemNumber: string, updates: IngredientFormData): Ingredient | undefined {
  let allIngredients = getIngredientsFromStorage();
  const ingredientIndex = allIngredients.findIndex(ing => ing.itemNumber === originalItemNumber);
  if (ingredientIndex === -1) return undefined;

  if (updates.itemNumber && updates.itemNumber !== originalItemNumber && allIngredients.some(ing => ing.itemNumber === updates.itemNumber)) {
    throw new Error(`Cannot update Item No. to "${updates.itemNumber}" as it already exists for another ingredient.`);
  }
  
  const updatedIngredient: Ingredient = {
    ...allIngredients[ingredientIndex],
    ...updates,
    id: updates.itemNumber, // Update internal ID to match new itemNumber
    unitPrice: Number(updates.unitPrice),
    updatedAt: new Date().toISOString(),
  };
  allIngredients[ingredientIndex] = updatedIngredient;
  saveIngredientsToStorage(allIngredients);
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
