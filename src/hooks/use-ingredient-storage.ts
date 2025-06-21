
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { Ingredient } from "@/types";
import type { IngredientFormData } from "@/lib/schemas"; // Corrected import path
import { 
  getAllIngredients as getAllIngredientsFromStorage,
  getIngredientById as getIngredientByIdFromStorage,
  addIngredient as addIngredientToStorage,
  updateIngredient as updateIngredientInStorage,
  deleteIngredient as deleteIngredientFromStorage,
  addMultipleIngredients as addMultipleIngredientsToStorage
} from '@/lib/ingredient-data';

export function useIngredientStorage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIngredients(getAllIngredientsFromStorage());
      setIsLoading(false);
    }
  }, []);

  const refreshIngredients = useCallback(() => {
    if (typeof window !== "undefined") {
      setIngredients(getAllIngredientsFromStorage());
    }
  }, []);

  const addIngredient = useCallback((ingredientData: IngredientFormData) => {
    const newIngredient = addIngredientToStorage(ingredientData);
    setIngredients(prevIngredients => [...prevIngredients, newIngredient]);
    return newIngredient;
  }, []);

  const addBulkIngredients = useCallback((ingredientDataList: IngredientFormData[]) => {
    const newItems = addMultipleIngredientsToStorage(ingredientDataList);
    setIngredients(prev => [...prev, ...newItems]);
    return newItems;
  }, []);

  const updateIngredient = useCallback((originalId: string, updates: IngredientFormData) => {
    const updatedItem = updateIngredientInStorage(originalId, updates);
    if (updatedItem) {
      setIngredients(prevIngredients => 
        prevIngredients.map(ing => ing.itemNumber === originalId ? updatedItem : ing)
      );
    }
    return updatedItem;
  }, []);

  const deleteIngredient = useCallback((itemNumber: string) => {
    const success = deleteIngredientFromStorage(itemNumber);
    if (success) {
      setIngredients(prevIngredients => prevIngredients.filter(ing => ing.itemNumber !== itemNumber));
    }
    return success;
  }, []);
  
  const getIngredientById = useCallback((itemNumber: string) => {
    const itemFromState = ingredients.find(ing => ing.itemNumber === itemNumber);
    if (itemFromState) return itemFromState;
    return getIngredientByIdFromStorage(itemNumber);
  }, [ingredients]);

  return { 
    ingredients, 
    isLoading, 
    addIngredient,
    addBulkIngredients, 
    updateIngredient, 
    deleteIngredient, 
    getIngredientById,
    refreshIngredients 
  };
}
