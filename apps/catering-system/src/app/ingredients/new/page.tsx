"use client"; // Make this page a Client Component

import { IngredientForm } from "@/components/ingredients/ingredient-form";
import { PackagePlus } from "lucide-react";

export default function NewIngredientPage() {
  return (
    <div className="max-w-4xl mx-auto">
       <h1 className="text-2xl font-semibold tracking-tight text-foreground mb-6 flex items-center">
         <PackagePlus className="mr-2 h-7 w-7 text-primary" /> Add New Ingredient
        </h1>
      <IngredientForm />
    </div>
  );
}
