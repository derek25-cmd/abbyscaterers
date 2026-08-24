
"use client";

import { IngredientForm } from "@/components/ingredients/ingredient-form";
import { useIngredientStorage } from "@/hooks/use-ingredient-storage";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { Ingredient } from "@/types";
import { Skeleton } from "@/components/ui/skeleton"; 
import { Edit3, PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export function IngredientEditPageComponent() {
  const [isMounted, setIsMounted] = useState(false);
  const params = useParams();
  const { getIngredientById, isLoading: storageLoading } = useIngredientStorage();
  const [ingredient, setIngredient] = useState<Ingredient | undefined>(undefined);
  const [componentLoading, setComponentLoading] = useState(true); // Renamed from isLoading
  const [error, setError] = useState<string | null>(null);

  const ingredientId = typeof params.id === 'string' ? params.id : undefined; 

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) {
      return;
    }
    
    if (!ingredientId) {
      setError("Invalid ingredient ID provided.");
      setIngredient(undefined);
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
      const fetchedIngredient = getIngredientById(ingredientId); 
      if (fetchedIngredient) {
        setIngredient(fetchedIngredient);
      } else {
        setIngredient(undefined);
        setError("Ingredient not found. Cannot edit a non-existent item.");
      }
    } catch (e: unknown) {
      console.error("Error fetching ingredient for edit:", e);
      setIngredient(undefined);
      let message = "An unexpected error occurred while loading ingredient data for editing.";
      if (e instanceof Error) {
        message = `An unexpected error occurred: ${e.message}`;
      }
      setError(message);
    } finally {
      setComponentLoading(false);
    }
  }, [ingredientId, getIngredientById, storageLoading, isMounted]);

  if (!isMounted || componentLoading || storageLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-12 w-1/4 mb-6" />
        <Skeleton className="h-[600px] w-full" /> 
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
        <h2 className="text-2xl font-semibold text-destructive mb-4">Error Loading Ingredient for Editing</h2>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Button asChild>
          <Link href="/ingredients">Go to Ingredient List</Link>
        </Button>
      </div>
    );
  }

  if (!ingredient || !ingredient.itemNumber) { // Added check for ingredient.itemNumber
    return (
      <div className="text-center py-10 max-w-xl mx-auto">
        <h2 className="text-2xl font-semibold text-muted-foreground mb-4">Ingredient Data Not Available for Editing</h2>
        <p className="text-muted-foreground mb-6">Could not load ingredient data for editing. The item might have been deleted or the ID is incorrect.</p>
        <Button asChild>
          <Link href="/ingredients">Go to Ingredient List</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground mb-6 flex items-center">
        <Edit3 className="mr-2 h-6 w-6 text-primary" /> Edit Ingredient: <PackagePlus className="ml-2 mr-1 h-6 w-6 text-accent" /> {ingredient.itemDescription}
      </h1>
      <IngredientForm ingredient={ingredient} />
    </div>
  );
}
