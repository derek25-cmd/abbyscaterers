
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
import { IngredientSchema, type IngredientFormData } from "@/lib/schemas";
import type { Ingredient } from "@/types";
import { ITEM_CLASSIFICATIONS, UNITS_OF_MEASURE } from "@/types";
import { useIngredientStorage } from "@/hooks/use-ingredient-storage";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Info, PlusCircle, Trash2 } from "lucide-react";
import React, { useState, useEffect } from "react";
import { Separator } from "../ui/separator";

interface IngredientFormProps {
  ingredient?: Ingredient; 
}

export function IngredientForm({ ingredient }: IngredientFormProps) {
  const router = useRouter();
  const { addIngredient, updateIngredient } = useIngredientStorage();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<IngredientFormData>({
    resolver: zodResolver(IngredientSchema),
    defaultValues: ingredient
      ? { ...ingredient }
      : {
          itemNumber: "",
          itemDescription: "",
          itemClassification: undefined,
          units: [{ unit: "kg", price: 0 }],
        },
  });
  
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "units"
  });

  useEffect(() => {
    if (ingredient) {
      form.reset({
        ...ingredient,
        units: ingredient.units.length > 0 ? ingredient.units : [{ unit: "kg", price: 0 }],
      });
    }
  }, [ingredient, form]);

  async function onSubmit(data: IngredientFormData) {
    setIsSubmitting(true);
    try {
      if (ingredient) {
        const updated = await updateIngredient(ingredient.itemNumber, data);
        if (updated) {
          toast({ title: "Ingredient Updated", description: `${data.itemDescription} (No: ${ingredient.itemNumber}) has been updated.` });
          router.push(`/ingredients/${ingredient.itemNumber}`);
        } else {
          toast({ variant: "destructive", title: "Error", description: "Failed to update ingredient." });
        }
      } else {
        const newIngredientData = await addIngredient(data);
        if (newIngredientData) {
          toast({ title: "Ingredient Added", description: `${newIngredientData.itemDescription} (No: ${newIngredientData.itemNumber}) has been added.` });
          router.push("/ingredients");
        } else {
          toast({ variant: "destructive", title: "Error", description: "Failed to add ingredient." });
        }
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
            <CardTitle>{ingredient ? "Edit Ingredient" : "Add New Ingredient"}</CardTitle>
            <CardDescription>
              {ingredient ? "Update the details for this ingredient." : "Fill in the information for the new ingredient."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="itemNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Item No.</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. ING-001" {...field} />
                  </FormControl>
                  <FormDescription className="flex items-center gap-1">
                    <Info className="h-3 w-3" /> Enter a unique identifier for this ingredient.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="itemDescription"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Item Description</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Organic Basil Leaves" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="itemClassification"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Item Classification</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select item classification" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ITEM_CLASSIFICATIONS.map((classification) => (
                        <SelectItem key={classification} value={classification}>
                          {classification}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Separator />
            
            <div>
              <h3 className="text-lg font-medium mb-4">Units & Pricing</h3>
              <div className="space-y-4">
                {fields.map((item, index) => (
                  <div key={item.id} className="flex items-end gap-4 border p-4 rounded-md relative">
                    {fields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute top-1 right-1 text-destructive hover:text-destructive-foreground hover:bg-destructive/90 h-7 w-7"
                        onClick={() => remove(index)}
                        disabled={isSubmitting}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                    <FormField
                      control={form.control}
                      name={`units.${index}.unit`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
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
                    <FormField
                      control={form.control}
                      name={`units.${index}.price`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel>Price</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="e.g. 10.99"
                              {...field}
                              onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => append({ unit: "kg", price: 0 })}
                disabled={isSubmitting}
              >
                <PlusCircle className="mr-2 h-4 w-4" /> Add Unit
              </Button>
              <FormMessage>{form.formState.errors.units?.root?.message || form.formState.errors.units?.message}</FormMessage>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {ingredient ? "Save Changes" : "Add Ingredient"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
