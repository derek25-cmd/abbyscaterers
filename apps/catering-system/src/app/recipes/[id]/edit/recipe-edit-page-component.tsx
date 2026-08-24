
"use client";

import { RecipeForm } from "@/components/recipes/recipe-form";
import { useRecipeStorage } from "@/hooks/use-recipe-storage";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { Recipe } from "@/types";
import { Skeleton } from "@/components/ui/skeleton"; 
import { ClipboardSignature, SquarePen } from "lucide-react";
import { Button } from '@/components/ui/button';
import Link from "next/link";

export function RecipeEditPageComponent() {
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
        setError("Recipe not found. Cannot edit a non-existent item.");
      }
    } catch (e: unknown) {
      console.error("Error fetching recipe for edit:", e);
      setRecipe(undefined);
      let message = "An unexpected error occurred while loading recipe data for editing.";
      if (e instanceof Error) {
        message = `An unexpected error occurred: ${e.message}`;
      }
      setError(message);
    } finally {
      setComponentLoading(false);
    }
  }, [recipeId, getRecipeById, storageLoading, isMounted]);

  if (!isMounted || componentLoading || storageLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-12 w-3/4 mb-6" /> {/* For title like "Edit Recipe: [Recipe Name]" */}
        <Skeleton className="h-[500px] w-full" /> 
        <div className="flex justify-end gap-4">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-24" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-10 max-w-xl mx-auto">
        <h2 className="text-2xl font-semibold text-destructive mb-4">Error Loading Recipe for Editing</h2>
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
        <h2 className="text-2xl font-semibold text-muted-foreground mb-4">Recipe Data Not Available for Editing</h2>
        <p className="text-muted-foreground mb-6">Could not load recipe data for editing. The item might have been deleted or the ID is incorrect.</p>
        <Button asChild>
          <Link href="/recipes">Go to Recipe List</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground mb-6 flex items-center">
        <SquarePen className="mr-2 h-6 w-6 text-primary" /> Edit Recipe: <ClipboardSignature className="ml-2 mr-1 h-6 w-6 text-accent" /> {recipe.recipeName}
      </h1>
      <RecipeForm recipe={recipe} />
    </div>
  );
}
