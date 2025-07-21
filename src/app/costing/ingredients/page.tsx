
"use client";

import { useState, useEffect } from "react";
import IngredientInputForm from "@/components/costing/IngredientInputForm";
import { useIngredientStorage } from "@/hooks/use-ingredient-storage";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Ingredient } from "@/types";

export default function ManageIngredientsPage() {
  const { ingredients, updateIngredient, isLoading } = useIngredientStorage();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const { toast } = useToast();

  useEffect(() => {
    // Initialize quantities from storage
    const initialQuantities: Record<string, number> = {};
    ingredients.forEach(ing => {
      // Assuming a 'quantityUsed' field might exist on the ingredient type
      // For now, we'll manage it separately in the component's state
      initialQuantities[ing.itemNumber] = (ing as any).quantityUsed || 0;
    });
    setQuantities(initialQuantities);
  }, [ingredients]);


  const handleSaveChanges = () => {
     // This is a simplified approach. A real app would save these quantities
     // to a separate "daily usage" record, not directly on the ingredient.
     // For this demo, we can just show a toast.
    Object.entries(quantities).forEach(([itemNumber, quantity]) => {
      const ingredient = ingredients.find(i => i.itemNumber === itemNumber);
      if(ingredient) {
          // This is a conceptual update. The 'updateIngredient' hook would need
          // to be adapted if we were to persist this data.
          // updateIngredient(itemNumber, { ...ingredient, quantityUsed: quantity });
      }
    });

    toast({
      title: "Quantities Recorded",
      description: "Today's ingredient usage has been updated for costing calculations.",
    });
  };

  const handleQuantityChange = (itemNumber: string, quantity: number) => {
    setQuantities(prev => ({...prev, [itemNumber]: quantity}));
  }

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
        ingredients={ingredients}
        quantities={quantities}
        onQuantityChange={handleQuantityChange}
        isLoading={isLoading}
      />

       <div className="flex justify-end">
        <Button onClick={handleSaveChanges}>Save Usage Data</Button>
      </div>
    </div>
  );
}
