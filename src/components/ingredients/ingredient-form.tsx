
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
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
import { ingredientSchema, type IngredientFormData } from "@/lib/schemas";
import type { Ingredient } from "@/types";
import { ITEM_CLASSIFICATIONS } from "@/types";
import { useIngredientStorage } from "@/hooks/use-ingredient-storage";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Info } from "lucide-react";
import React, { useState, useEffect } from "react";

interface IngredientFormProps {
  ingredient?: Ingredient; 
}

export function IngredientForm({ ingredient }: IngredientFormProps) {
  const router = useRouter();
  const { addIngredient, updateIngredient } = useIngredientStorage();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<IngredientFormData>({
    resolver: zodResolver(ingredientSchema),
    defaultValues: ingredient
      ? { ...ingredient, unitPrice: ingredient.unitPrice || 0 }
      : {
          itemNumber: "",
          itemDescription: "",
          itemClassification: undefined, // Default to undefined for select placeholder
          unitOfMeasure: "",
          unitPrice: 0,
        },
  });
  
  useEffect(() => {
    if (ingredient) {
      form.reset({ ...ingredient, unitPrice: ingredient.unitPrice || 0 });
    }
  }, [ingredient, form]);

  async function onSubmit(data: IngredientFormData) {
    setIsSubmitting(true);
    try {
      const payload: IngredientFormData = {
        ...data,
        unitPrice: Number(data.unitPrice) 
      };

      if (ingredient) {
        const updated = updateIngredient(ingredient.itemNumber, payload); 
        if (updated) {
          toast({ title: "Ingredient Updated", description: `${updated.itemDescription} (No: ${updated.itemNumber}) has been updated.` });
          router.push(`/ingredients/${updated.itemNumber}`);
        } else {
          toast({ variant: "destructive", title: "Error", description: "Failed to update ingredient." });
        }
      } else {
        const newIngredientData = addIngredient(payload);
        toast({ title: "Ingredient Added", description: `${newIngredientData.itemDescription} (No: ${newIngredientData.itemNumber}) has been added.` });
        router.push("/ingredients");
      }
    } catch (error: any) {
      console.error("Submission error:", error);
      toast({ variant: "destructive", title: "Submission Error", description: error.message || "An unexpected error occurred." });
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="unitOfMeasure"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit of Measure</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. kg, lbs, bunch, item" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="unitPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit Price</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="e.g. 10.99" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0 )}/>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
