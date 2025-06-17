
"use client"; 

import { RecipeForm } from "@/components/recipes/recipe-form";
import { ClipboardSignature } from "lucide-react";

export default function NewRecipePage() {
  return (
    <div className="max-w-4xl mx-auto">
       <h1 className="text-2xl font-semibold tracking-tight text-foreground mb-6 flex items-center">
         <ClipboardSignature className="mr-2 h-7 w-7 text-primary" /> Add New Recipe
        </h1>
      <RecipeForm />
    </div>
  );
}
