

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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "../ui/separator";
import { RecipeSchema, type RecipeFormData } from "@/lib/schemas";
import type { Recipe } from "@/types";
import { useRecipeStorage } from "@/hooks/use-recipe-storage";
import { useIngredientStorage } from "@/hooks/use-ingredient-storage";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Info, PlusCircle, Trash2, Check, ChevronsUpDown } from "lucide-react";
import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UNITS_OF_MEASURE, RECIPE_TYPES } from "@/types";


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
    resolver: zodResolver(RecipeSchema),
    defaultValues: recipe
      ? {
          recipeNumber: recipe.recipeNumber,
          recipeName: recipe.recipeName,
          recipeType: recipe.recipeType,
          ingredients: recipe.ingredients || [],
        }
      : {
          recipeName: "",
          recipeType: "Lunch/Dinner",
          ingredients: [],
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
        recipeType: recipe.recipeType,
        ingredients: recipe.ingredients || [],
      });
    }
  }, [recipe, form]);

  async function onSubmit(data: RecipeFormData) {
    setIsSubmitting(true);
    try {
      if (recipe) {
        const success = await updateRecipe(recipe.recipeNumber, data);
        if (success) {
          toast({ title: "Recipe Updated", description: `${data.recipeName} (No: ${recipe.recipeNumber}) has been updated.` });
          router.push(`/recipes/${recipe.recipeNumber}`);
        } else {
          toast({ variant: "destructive", title: "Error", description: "Failed to update recipe." });
        }
      } else {
        const newRecipeData = await addRecipe(data);
        if (newRecipeData) {
          toast({ title: "Recipe Added", description: `${newRecipeData.recipeName} (No: ${newRecipeData.recipeNumber}) has been added.` });
          router.push("/recipes");
        } else {
            toast({ variant: "destructive", title: "Error", description: "Failed to add recipe. The recipe number might already exist or there was a database error." });
        }
      }
    } catch (error) {
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
            {recipe && (
                 <FormItem>
                  <FormLabel>Recipe No.</FormLabel>
                  <FormControl>
                    <Input value={recipe.recipeNumber} disabled />
                  </FormControl>
                </FormItem>
            )}
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
             <FormField
              control={form.control}
              name="recipeType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Recipe Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a recipe type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {RECIPE_TYPES.map(type => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />
            <div>
              <h3 className="text-lg font-medium mb-4">Ingredients (Optional)</h3>
              <div className="space-y-4">
              {fields.map((item, index) => (
                <div key={item.id} className="border rounded-md p-4 relative">
                   {fields.length > 0 && (
                     <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute top-1 right-1 text-destructive hover:text-destructive-foreground hover:bg-destructive/90 h-auto p-1.5 z-10"
                        onClick={() => remove(index)}
                        disabled={isSubmitting}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                    <FormField
                      control={form.control}
                      name={`ingredients.${index}.ingredientId`}
                      render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>Ingredient</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    role="combobox"
                                    className={cn(
                                      "w-full justify-between",
                                      !field.value && "text-muted-foreground"
                                    )}
                                    disabled={ingredientsLoading}
                                  >
                                    {(() => {
                                      if (ingredientsLoading) return "Loading...";
                                      const selected = availableIngredients.find(ing => ing.itemNumber === field.value);
                                      return selected ? `${selected.itemNumber} - ${selected.itemDescription}` : "Select ingredient";
                                    })()}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                <Command>
                                  <CommandInput
                                    placeholder="Search ingredient..."
                                  />
                                  <CommandList>
                                    <CommandEmpty>No ingredient found.</CommandEmpty>
                                    <CommandGroup>
                                      {availableIngredients.map((ing) => (
                                        <CommandItem
                                          key={ing.itemNumber}
                                          value={`${ing.itemNumber} - ${ing.itemDescription}`}
                                          onSelect={() => {
                                            form.setValue(`ingredients.${index}.ingredientId`, ing.itemNumber);
                                          }}
                                        >
                                          <Check
                                            className={cn(
                                              "mr-2 h-4 w-4",
                                              field.value === ing.itemNumber
                                                ? "opacity-100"
                                                : "opacity-0"
                                            )}
                                          />
                                          {ing.itemNumber} - {ing.itemDescription}
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )
                      }
                    />
                    <FormField
                      control={form.control}
                      name={`ingredients.${index}.quantity`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Quantity</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="any"
                              placeholder="e.g. 2.5"
                              {...field}
                              onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                     <FormField
                      control={form.control}
                      name={`ingredients.${index}.unit`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Unit</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a unit" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {UNITS_OF_MEASURE.map(unit => (
                                <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              ))}
              </div>
               <FormMessage>{(form.formState.errors.ingredients?.root?.message || form.formState.errors.ingredients?.message)}</FormMessage>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => append({ ingredientId: "", quantity: 1, unit: "kg" })}
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
