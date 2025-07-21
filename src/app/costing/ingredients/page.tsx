
"use client";

import { useState, useEffect } from "react";
import IngredientInputForm from "@/components/costing/IngredientInputForm";
import { useIngredientStorage } from "@/hooks/use-ingredient-storage";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Ingredient } from "@/types";

export type IngredientUsage = {
  itemNumber: string;
  quantity: number;
};

export default function ManageIngredientsPage() {
  const { ingredients, updateIngredient, isLoading, getIngredientById } = useIngredientStorage();
  const { toast } = useToast();
  const [usedIngredients, setUsedIngredients] = useState<IngredientUsage[]>([]);

  useEffect(() => {
    // On mount, load ingredients that already have a quantityUsed from storage
    const initialUsed: IngredientUsage[] = [];
    ingredients.forEach(ing => {
      const quantityUsed = (ing as any).quantityUsed;
      if (quantityUsed && quantityUsed > 0) {
        initialUsed.push({ itemNumber: ing.itemNumber, quantity: quantityUsed });
      }
    });
    setUsedIngredients(initialUsed);
  }, [ingredients]);
  
  const handleSaveChanges = () => {
    // Persist the ephemeral `quantityUsed` on the main ingredient object
    // This is a simplified approach. A real app might save this to a separate record.
    const allIngredientIds = new Set(ingredients.map(i => i.itemNumber));
    const usedIngredientIds = new Set(usedIngredients.map(i => i.itemNumber));

    // Update ingredients that were used
    usedIngredients.forEach(({ itemNumber, quantity }) => {
      const ingredient = getIngredientById(itemNumber);
      if(ingredient) {
          updateIngredient(itemNumber, { ...ingredient, quantityUsed: quantity } as any);
      }
    });

    // Clear quantityUsed for ingredients that are no longer in the list
    allIngredientIds.forEach(id => {
      if (!usedIngredientIds.has(id)) {
        const ingredient = getIngredientById(id);
        if (ingredient && (ingredient as any).quantityUsed) {
           updateIngredient(id, { ...ingredient, quantityUsed: 0 } as any);
        }
      }
    });

    toast({
      title: "Quantities Recorded",
      description: "Today's ingredient usage has been updated for costing calculations.",
    });
  };

  const handleUsageChange = (updatedUsedIngredients: IngredientUsage[]) => {
      setUsedIngredients(updatedUsedIngredients);
  };
  
  return (
    <div className="container mx-auto p-6 space-y-6">
       <div className="flex justify-between items-center">
        <div>
            <h1 className="text-3xl font-bold text-foreground">Ingredient Usage</h1>
            <p className="text-muted-foreground">Input the quantity of each ingredient used today for cost analysis.</p>
        </div>
        <Button asChild variant="outline">
            <Link href="/costing">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Costing Report
            </Link>
        </Button>
      </div>

      <IngredientInputForm
        availableIngredients={ingredients}
        usedIngredients={usedIngredients}
        onUsageChange={handleUsageChange}
        isLoading={isLoading}
      />

       <div className="flex justify-end">
        <Button onClick={handleSaveChanges}>Save Usage Data</Button>
      </div>
    </div>
  );
}
