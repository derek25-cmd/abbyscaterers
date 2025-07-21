
"use client";

import { useState } from "react";
import { IngredientInputForm, type Ingredient } from "@/components/costing/IngredientInputForm";
import { useCostingData } from "@/hooks/useCostingData";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function ManageIngredientsPage() {
  const { ingredients: initialIngredients, updateIngredients } = useCostingData();
  const [ingredients, setIngredients] = useState<Ingredient[]>(initialIngredients);

  const handleSaveChanges = () => {
    updateIngredients(ingredients);
    // Optionally, show a toast notification here
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
       <div className="flex justify-between items-center">
        <div>
            <h1 className="text-3xl font-bold text-foreground">Manage Ingredients</h1>
            <p className="text-muted-foreground">Add, edit, and manage ingredient details and pricing.</p>
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
        onIngredientsChange={setIngredients}
      />

       <div className="flex justify-end">
        <Button onClick={handleSaveChanges}>Save Changes</Button>
      </div>
    </div>
  );
}
