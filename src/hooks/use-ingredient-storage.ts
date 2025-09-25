
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { Ingredient } from "@/types";
import type { IngredientFormData } from "@/lib/schemas";
import { 
  getIngredients as getAllFromStorage,
  getIngredientById as getByIdFromStorage,
  addIngredient as addToStorage,
  updateIngredient as updateInStorage,
  deleteIngredient as deleteFromStorage,
  addBulkIngredients as addBulkToStorage
} from '@/services/ingredientService';

export function useIngredientStorage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshIngredients = useCallback(async () => {
    setIsLoading(true);
    const data = await getAllFromStorage();
    setIngredients(data);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    refreshIngredients();
  }, [refreshIngredients]);

  const addIngredient = useCallback(async (ingredientData: IngredientFormData) => {
    const newIngredient = await addToStorage(ingredientData);
    if(newIngredient) {
      refreshIngredients();
    }
    return newIngredient;
  }, [refreshIngredients]);

  const addBulkIngredients = useCallback(async (ingredientDataList: IngredientFormData[]) => {
    const success = await addBulkToStorage(ingredientDataList);
    if (success) {
      refreshIngredients();
    }
    return success;
  }, [refreshIngredients]);

  const updateIngredient = useCallback(async (originalId: string, updates: IngredientFormData) => {
    const success = await updateInStorage(originalId, updates);
    if (success) {
      refreshIngredients();
    }
    return success;
  }, [refreshIngredients]);

  const deleteIngredient = useCallback(async (itemNumber: string) => {
    const success = await deleteFromStorage(itemNumber);
    if (success) {
      refreshIngredients();
    }
    return success;
  }, [refreshIngredients]);
  
  const getIngredientById = useCallback((itemNumber: string) => {
    return ingredients.find(ing => ing.itemNumber === itemNumber);
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
