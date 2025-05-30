
"use client";

import { IngredientDetailsView } from "@/components/ingredients/ingredient-details-view";
import { useIngredientStorage } from "@/hooks/use-ingredient-storage";
import { useParams } from "next/navigation"; // Removed useRouter
import { useEffect, useState } from "react";
import type { Ingredient } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export function IngredientDetailsPageComponent() {
  const params = useParams();
  // const router = useRouter(); // Not used
  const { getIngredientById, isLoading: storageLoading } = useIngredientStorage();
  const [ingredient, setIngredient] = useState<Ingredient | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const ingredientId = typeof params.id === 'string' ? params.id : undefined; 

  useEffect(() => {
    if (ingredientId) {
       if (!storageLoading) {
        try {
          const fetchedIngredient = getIngredientById(ingredientId); 
          if (fetchedIngredient) {
            setIngredient(fetchedIngredient);
          } else {
            setError("Ingredient not found. The item may have been deleted or the ID is incorrect.");
          }
        } catch (e) {
          console.error("Error fetching ingredient details:", e);
          setError("An unexpected error occurred while loading ingredient data.");
        } finally {
          setIsLoading(false);
        }
      }
    } else {
      setError("Invalid ingredient ID provided.");
      setIsLoading(false);
    }
  }, [ingredientId, getIngredientById, storageLoading]);

  if (isLoading || storageLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 p-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-10 w-1/2" />
          <Skeleton className="h-10 w-32" /> 
        </div>
        <Skeleton className="h-8 w-1/3 mb-2" /> 
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
          <Skeleton className="h-40 w-full" /> 
          <Skeleton className="h-40 w-full" /> 
          <Skeleton className="h-32 w-full md:col-span-2" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-10 max-w-xl mx-auto">
        <h2 className="text-2xl font-semibold text-destructive mb-4">Error Loading Ingredient</h2>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Button asChild>
          <Link href="/ingredients">Go to Ingredient List</Link>
        </Button>
      </div>
    );
  }
  
  if (!ingredient) {
     return (
      <div className="text-center py-10 max-w-xl mx-auto">
        <h2 className="text-2xl font-semibold text-destructive mb-4">Ingredient Not Found</h2>
        <p className="text-muted-foreground mb-6">The requested ingredient could not be found. It might have been deleted.</p>
        <Button asChild>
          <Link href="/ingredients">Go to Ingredient List</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <IngredientDetailsView ingredient={ingredient} />
    </div>
  );
}
