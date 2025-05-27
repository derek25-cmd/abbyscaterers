
"use client";

import { IngredientForm } from "@/components/ingredients/ingredient-form";
import { useIngredientStorage } from "@/hooks/use-ingredient-storage";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Ingredient } from "@/types";
import { Skeleton } from "@/components/ui/skeleton"; 
import { Edit3, PackagePlus } from "lucide-react";

export default function EditIngredientPage() {
  const params = useParams();
  const router = useRouter();
  const { getIngredientById, isLoading: storageLoading } = useIngredientStorage();
  const [ingredient, setIngredient] = useState<Ingredient | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const ingredientId = typeof params.id === 'string' ? params.id : undefined; // itemNumber is used as ID in URL

  useEffect(() => {
    if (ingredientId) {
      if (!storageLoading) { 
        const fetchedIngredient = getIngredientById(ingredientId);
        if (fetchedIngredient) {
          setIngredient(fetchedIngredient);
        } else {
          setError("Ingredient not found.");
        }
        setIsLoading(false);
      }
    } else {
      setError("Invalid ingredient ID.");
      setIsLoading(false);
    }
  }, [ingredientId, getIngredientById, storageLoading, router]);

  if (isLoading || storageLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-12 w-1/4 mb-6" />
        <Skeleton className="h-[600px] w-full" /> {/* Approx height for form card */}
        <div className="flex justify-end gap-4">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-24" />
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="text-destructive text-center py-10">{error}</div>;
  }

  if (!ingredient) {
    return <div className="text-center py-10">Ingredient data could not be loaded.</div>;
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
