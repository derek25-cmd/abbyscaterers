
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { recipeSchema, type RecipeFormData } from "@/lib/schemas";
import type { Recipe, Ingredient } from "@/types";
import { useRecipeStorage } from "@/hooks/use-recipe-storage";
import { useIngredientStorage } from "@/hooks/use-ingredient-storage";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Info, PlusCircle, Trash2 } from "lucide-react";
import React, { useState, useEffect } from "react";

interface RecipeFormProps {
  recipe?: Recipe; 
}

export function RecipeForm({ recipe }: RecipeFormProps) {
  const router = useRouter();
  const { addRecipe, updateRecipe } = useRecipeStorage();
  const { ingredients: availableIngredients, isLoading: ingredientsLoading } = useIngredientStorage();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<RecipeFormData>({
    resolver: zodResolver(recipeSchema),
    defaultValues: recipe
      ? { 
          recipeNumber: recipe.recipeNumber,
          recipeName: recipe.recipeName,
          ingredients: recipe.ingredients.map(ing => ({ ingredientId: ing.ingredientId, measurement: ing.measurement })) || [],
        }
      : {
          recipeNumber: "",
          recipeName: "",
          ingredients: [{ ingredientId: "", measurement: "" }],
        },
  });
  
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "ingredients"
  });

  useEffect(() => {
    if (recipe) {
      form.reset({
        recipeNumber: recipe.recipeNumber,
        recipeName: recipe.recipeName,
        ingredients: recipe.ingredients.map(ing => ({ ingredientId: ing.ingredientId, measurement: ing.measurement })) || [],
      });
    }
  }, [recipe, form]);

  async function onSubmit(data: RecipeFormData) {
    setIsSubmitting(true);
    try {
      if (recipe) {
        const updated = updateRecipe(recipe.recipeNumber, data); 
        if (updated) {
          toast({ title: "Recipe Updated", description: `${updated.recipeName} (No: ${updated.recipeNumber}) has been updated.` });
          router.push(`/recipes/${updated.recipeNumber}`);
        } else {
          toast({ variant: "destructive", title: "Error", description: "Failed to update recipe." });
        }
      } else {
        const newRecipeData = addRecipe(data);
        toast({ title: "Recipe Added", description: `${newRecipeData.recipeName} (No: ${newRecipeData.recipeNumber}) has been added.` });
        router.push("/recipes");
      }
    } catch (error: unknown) {
      console.error("Submission error:", error);
      let errorMessage = "An unexpected error occurred.";
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      toast({ variant: "destructive", title: "Submission Error", description: errorMessage });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>{recipe ? "Edit Recipe" : "Add New Recipe"}</CardTitle>
            <CardDescription>
              {recipe ? "Update the details for this recipe." : "Fill in the information for the new recipe."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="recipeNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Recipe No.</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. REC-001" {...field} />
                  </FormControl>
                  <FormDescription className="flex items-center gap-1">
                    <Info className="h-3 w-3" /> Enter a unique identifier for this recipe.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="recipeName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Recipe Name (Food Created)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Classic Beef Stew" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Separator />
            <div>
              <h3 className="text-lg font-medium mb-2">Ingredients</h3>
              {fields.map((item, index) => (
                <div key={item.id} className="mb-4 border rounded-md relative">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
                    <FormField
                      control={form.control}
                      name={`ingredients.${index}.ingredientId`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Ingredient</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value} disabled={ingredientsLoading}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={ingredientsLoading ? "Loading..." : "Select ingredient"} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {!ingredientsLoading && availableIngredients.map((ing: Ingredient) => (
                                <SelectItem key={ing.id} value={ing.itemNumber}>
                                  {ing.itemDescription} ({ing.itemNumber})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`ingredients.${index}.measurement`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Measurement</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. 2 cups, 100g" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  {fields.length > 1 && (
                     <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute top-2 right-2 text-destructive hover:text-destructive-foreground hover:bg-destructive/90"
                        onClick={() => remove(index)}
                        disabled={isSubmitting}
                      >
                        <Trash2 className="h-4 w-4 mr-1" /> Remove
                      </Button>
                  )}
                </div>
              ))}
               <FormMessage>{form.formState.errors.ingredients?.root?.message || form.formState.errors.ingredients?.message}</FormMessage>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => append({ ingredientId: "", measurement: "" })}
                disabled={isSubmitting}
              >
                <PlusCircle className="mr-2 h-4 w-4" /> Add Ingredient
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || ingredientsLoading}>
            {(isSubmitting || ingredientsLoading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {recipe ? "Save Changes" : "Add Recipe"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
