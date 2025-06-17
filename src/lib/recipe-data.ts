
"use client";

import type { Recipe, RecipeIngredientItem } from "@/types";
import type { RecipeFormData } from "@/lib/schemas";

const RECIPES_STORAGE_KEY = "caterSmartRecipes";

function getRecipesFromStorage(): Recipe[] {
  if (typeof window === "undefined") return [];
  let data = null;
  try {
    data = localStorage.getItem(RECIPES_STORAGE_KEY);
  } catch (error) {
    console.error("Error reading recipes from localStorage:", error);
    return [];
  }

  if (data) {
    try {
      return JSON.parse(data);
    } catch (error) {
      console.error("Error parsing recipes from localStorage:", error);
      return [];
    }
  }
  return [];
}

function saveRecipesToStorage(recipes: Recipe[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(RECIPES_STORAGE_KEY, JSON.stringify(recipes));
  } catch (error) {
    console.error("Error saving recipes to localStorage:", error);
  }
}

export function getAllRecipes(): Recipe[] {
  return getRecipesFromStorage();
}

export function getRecipeById(recipeNumber: string): Recipe | undefined {
  const allRecipes = getRecipesFromStorage();
  return allRecipes.find(rec => rec.recipeNumber === recipeNumber);
}

export function addRecipe(recipeData: RecipeFormData): Recipe {
  const allRecipes = getRecipesFromStorage();
  const now = new Date().toISOString();

  if (allRecipes.some(rec => rec.recipeNumber === recipeData.recipeNumber)) {
    throw new Error(`Recipe No. "${recipeData.recipeNumber}" already exists.`);
  }

  const newRecipe: Recipe = {
    id: recipeData.recipeNumber,
    recipeNumber: recipeData.recipeNumber,
    recipeName: recipeData.recipeName,
    ingredients: recipeData.ingredients.map(ing => ({
      ingredientId: ing.ingredientId,
      measurement: ing.measurement,
    })),
    createdAt: now,
    updatedAt: now,
  };
  const updatedRecipeList = [...allRecipes, newRecipe];
  saveRecipesToStorage(updatedRecipeList);
  return newRecipe;
}

export function updateRecipe(originalRecipeNumber: string, updates: RecipeFormData): Recipe | undefined {
  const allRecipes = getRecipesFromStorage();
  const recipeIndex = allRecipes.findIndex(rec => rec.recipeNumber === originalRecipeNumber);
  if (recipeIndex === -1) return undefined;

  if (updates.recipeNumber && updates.recipeNumber !== originalRecipeNumber && allRecipes.some(rec => rec.recipeNumber === updates.recipeNumber)) {
    throw new Error(`Cannot update Recipe No. to "${updates.recipeNumber}" as it already exists for another recipe.`);
  }
  
  const updatedRecipe: Recipe = {
    ...allRecipes[recipeIndex],
    recipeNumber: updates.recipeNumber,
    recipeName: updates.recipeName,
    ingredients: updates.ingredients.map(ing => ({
      ingredientId: ing.ingredientId,
      measurement: ing.measurement,
    })),
    id: updates.recipeNumber, // Ensure id is updated if recipeNumber changes
    updatedAt: new Date().toISOString(),
  };
  
  const updatedAllRecipes = [...allRecipes];
  updatedAllRecipes[recipeIndex] = updatedRecipe;
  saveRecipesToStorage(updatedAllRecipes);
  return updatedRecipe;
}

export function deleteRecipe(recipeNumber: string): boolean {
  let allRecipes = getRecipesFromStorage();
  const initialLength = allRecipes.length;
  allRecipes = allRecipes.filter(rec => rec.recipeNumber !== recipeNumber);
  if (allRecipes.length < initialLength) {
    saveRecipesToStorage(allRecipes);
    return true;
  }
  return false;
}
