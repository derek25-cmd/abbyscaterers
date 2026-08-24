
"use client";

import { RecipeDetailsView } from "@/components/recipes/recipe-details-view";
import { useRecipeStorage } from "@/hooks/use-recipe-storage";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { Recipe } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export function RecipeDetailsPageComponent() {
  const [isMounted, setIsMounted] = useState(false);
  const params = useParams();
  const { getRecipeById, isLoading: storageLoading } = useRecipeStorage();
  const [recipe, setRecipe] = useState<Recipe | undefined>(undefined);
  const [componentLoading, setComponentLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const recipeId = typeof params.id === 'string' ? params.id : undefined; 

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) {
      return;
    }

    if (!recipeId) {
      setError("Invalid recipe ID provided.");
      setRecipe(undefined);
      setComponentLoading(false);
      return;
    }
    
    if (storageLoading) {
      setComponentLoading(true);
      return;
    }

    setComponentLoading(true);
    setError(null);
    try {
      const fetchedRecipe = getRecipeById(recipeId); 
      if (fetchedRecipe) {
        setRecipe(fetchedRecipe);
      } else {
        setRecipe(undefined);
        setError("Recipe not found. The item may have been deleted or the ID is incorrect.");
      }
    } catch (e) {
      console.error("Error fetching recipe details:", e);
      setRecipe(undefined);
      setError("An unexpected error occurred while loading recipe data.");
    } finally {
      setComponentLoading(false);
    }
  }, [recipeId, getRecipeById, storageLoading, isMounted]);

  if (!isMounted || componentLoading || storageLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 p-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-10 w-1/2" />
          <Skeleton className="h-10 w-48" /> 
        </div>
        <Skeleton className="h-8 w-1/3 mb-2" /> 
        <Skeleton className="h-40 w-full md:col-span-2" />
        <Skeleton className="h-32 w-full md:col-span-2" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-10 max-w-xl mx-auto">
        <h2 className="text-2xl font-semibold text-destructive mb-4">Error Loading Recipe</h2>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Button asChild>
          <Link href="/recipes">Go to Recipe List</Link>
        </Button>
      </div>
    );
  }
  
  if (!recipe || !recipe.recipeNumber) {
     return (
      <div className="text-center py-10 max-w-xl mx-auto">
        <h2 className="text-2xl font-semibold text-destructive mb-4">Recipe Not Found</h2>
        <p className="text-muted-foreground mb-6">The requested recipe could not be found. It might have been deleted or the ID is incorrect.</p>
        <Button asChild>
          <Link href="/recipes">Go to Recipe List</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <RecipeDetailsView recipe={recipe} />
    </div>
  );
}
