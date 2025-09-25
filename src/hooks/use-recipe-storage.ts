
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { Recipe } from "@/types";
import type { RecipeFormData } from "@/lib/schemas";
import { 
  getRecipes as getAllFromStorage,
  getRecipeById as getByIdFromStorage,
  addRecipe as addToStorage,
  updateRecipe as updateInStorage,
  deleteRecipe as deleteFromStorage 
} from '@/services/recipeService';

export function useRecipeStorage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshRecipes = useCallback(async () => {
    setIsLoading(true);
    const data = await getAllFromStorage();
    setRecipes(data);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    refreshRecipes();
  }, [refreshRecipes]);

  const addRecipe = useCallback(async (recipeData: RecipeFormData) => {
    const newRecipe = await addToStorage(recipeData);
    if(newRecipe) {
      refreshRecipes();
    }
    return newRecipe;
  }, [refreshRecipes]);

  const updateRecipe = useCallback(async (originalRecipeNumber: string, updates: RecipeFormData) => {
    const success = await updateInStorage(originalRecipeNumber, updates);
    if (success) {
      refreshRecipes();
    }
    return success;
  }, [refreshRecipes]);

  const deleteRecipe = useCallback(async (recipeNumber: string) => {
    const success = await deleteFromStorage(recipeNumber);
    if (success) {
      refreshRecipes();
    }
    return success;
  }, [refreshRecipes]);
  
  const getRecipeById = useCallback((recipeNumber: string) => {
    return recipes.find(rec => rec.recipeNumber === recipeNumber);
  }, [recipes]);

  return { 
    recipes, 
    isLoading, 
    addRecipe, 
    updateRecipe, 
    deleteRecipe, 
    getRecipeById,
    refreshRecipes 
  };
}
