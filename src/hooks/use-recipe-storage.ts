
"use client";

import { useState, useEffect, useCallback } from 'react';
import type { Recipe } from "@/types";
import type { RecipeFormData } from "@/lib/schemas";
import { 
  getAllRecipes as getAllRecipesFromStorage,
  getRecipeById as getRecipeByIdFromStorage,
  addRecipe as addRecipeToStorage,
  updateRecipe as updateRecipeInStorage,
  deleteRecipe as deleteRecipeFromStorage 
} from '@/lib/recipe-data';

export function useRecipeStorage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setRecipes(getAllRecipesFromStorage());
      setIsLoading(false);
    }
  }, []);

  const refreshRecipes = useCallback(() => {
    if (typeof window !== "undefined") {
      setRecipes(getAllRecipesFromStorage());
    }
  }, []);

  const addRecipe = useCallback((recipeData: RecipeFormData) => {
    const newRecipe = addRecipeToStorage(recipeData);
    setRecipes(prevRecipes => [...prevRecipes, newRecipe]);
    return newRecipe;
  }, []);

  const updateRecipe = useCallback((originalRecipeNumber: string, updates: RecipeFormData) => {
    const updatedItem = updateRecipeInStorage(originalRecipeNumber, updates);
    if (updatedItem) {
      setRecipes(prevRecipes => 
        prevRecipes.map(rec => rec.recipeNumber === originalRecipeNumber ? updatedItem : rec)
      );
      refreshRecipes(); // In case the ID changed, refresh the whole list
    }
    return updatedItem;
  }, [refreshRecipes]);

  const deleteRecipe = useCallback((recipeNumber: string) => {
    const success = deleteRecipeFromStorage(recipeNumber);
    if (success) {
      setRecipes(prevRecipes => prevRecipes.filter(rec => rec.recipeNumber !== recipeNumber));
    }
    return success;
  }, []);
  
  const getRecipeById = useCallback((recipeNumber: string) => {
    // Re-fetch from storage to ensure we have the latest data, especially after potential ID changes.
    return getRecipeByIdFromStorage(recipeNumber);
  }, []);

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
