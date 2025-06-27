
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar"
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
import { Separator } from "@/components/ui/separator";
import { dailyMenuSchema, type DailyMenuFormData } from "@/lib/schemas";
import type { DailyMenu } from "@/types";
import { useDailyMenuStorage } from "@/hooks/use-daily-menu-storage";
import { useRecipeStorage } from "@/hooks/use-recipe-storage";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Info, PlusCircle, Trash2, Check, ChevronsUpDown, CalendarIcon } from "lucide-react";
import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { format, parseISO, isValid } from "date-fns";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

interface DailyMenuFormProps {
  menu?: DailyMenu;
}

export function DailyMenuForm({ menu }: DailyMenuFormProps) {
  const router = useRouter();
  const { addMenu, updateMenu } = useDailyMenuStorage();
  const { recipes: availableRecipes, isLoading: recipesLoading } = useRecipeStorage();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<DailyMenuFormData>({
    resolver: zodResolver(dailyMenuSchema),
    defaultValues: menu
      ? {
          id: menu.id,
          name: menu.name,
          date: menu.date,
          items: menu.items.map(item => ({ recipeId: item.recipeId })) || [],
        }
      : {
          id: "",
          name: "",
          date: new Date().toISOString(),
          items: [{ recipeId: "" }],
        },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items"
  });

  useEffect(() => {
    if (menu) {
      form.reset({
        id: menu.id,
        name: menu.name,
        date: menu.date,
        items: menu.items.length > 0 ? menu.items.map(item => ({ recipeId: item.recipeId })) : [{ recipeId: "" }],
      });
    }
  }, [menu, form]);

  async function onSubmit(data: DailyMenuFormData) {
    setIsSubmitting(true);
    try {
      const payload: DailyMenuFormData = {
        ...data,
        date: new Date(data.date).toISOString(),
      };
      
      if (menu) {
        const updated = updateMenu(menu.id, payload);
        if (updated) {
          toast({ title: "Menu Updated", description: `${updated.name} (ID: ${updated.id}) has been updated.` });
          router.push(`/daily-menus/${updated.id}`);
        } else {
          toast({ variant: "destructive", title: "Error", description: "Failed to update menu." });
        }
      } else {
        const newMenuData = addMenu(payload);
        toast({ title: "Menu Added", description: `${newMenuData.name} (ID: ${newMenuData.id}) has been added.` });
        router.push("/daily-menus");
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
            <CardTitle>{menu ? "Edit Daily Menu" : "Add New Daily Menu"}</CardTitle>
            <CardDescription>
              {menu ? "Update the details for this menu." : "Fill in the information for the new menu."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Menu ID</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. MENU-001" {...field} />
                      </FormControl>
                      <FormDescription className="flex items-center gap-1">
                        <Info className="h-3 w-3" /> Enter a unique identifier for this menu.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Menu Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Monday Lunch Special" {...field} />
                      </FormControl>
                       <FormDescription>A descriptive name for the menu.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
            </div>
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => {
                const dateValue = field.value ? parseISO(field.value) : undefined;
                const isDateValid = dateValue && isValid(dateValue);
                return (
                  <FormItem className="flex flex-col">
                    <FormLabel>Menu Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full md:w-1/2 lg:w-1/3 pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {isDateValid && dateValue ? (
                              format(dateValue, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={isDateValid ? dateValue : undefined}
                          onSelect={(date) => field.onChange(date?.toISOString())}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormDescription>
                      The date for which this menu is intended.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            <Separator />
            <div>
              <h3 className="text-lg font-medium mb-4">Recipes</h3>
              <div className="space-y-4">
              {fields.map((item, index) => {
                 const [open, setOpen] = React.useState(false);
                 return (
                  <div key={item.id} className="flex items-center gap-4 border p-4 rounded-md relative">
                    <FormField
                      control={form.control}
                      name={`items.${index}.recipeId`}
                      render={({ field }) => (
                          <FormItem className="flex-1 flex flex-col">
                            <FormLabel>Recipe</FormLabel>
                            <Popover open={open} onOpenChange={setOpen}>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    role="combobox"
                                    className={cn(
                                      "w-full justify-between",
                                      !field.value && "text-muted-foreground"
                                    )}
                                    disabled={recipesLoading}
                                  >
                                    {recipesLoading ? "Loading..." : field.value ? availableRecipes.find(rec => rec.recipeNumber === field.value)?.recipeName : "Select recipe"}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                <Command>
                                  <CommandInput placeholder="Search recipe..." />
                                  <CommandList>
                                    <CommandEmpty>No recipe found.</CommandEmpty>
                                    <CommandGroup>
                                      {availableRecipes.map((rec) => (
                                        <CommandItem
                                          key={rec.recipeNumber}
                                          value={rec.recipeNumber}
                                          onSelect={(currentValue) => {
                                            form.setValue(`items.${index}.recipeId`, currentValue);
                                            setOpen(false);
                                          }}
                                        >
                                          <Check
                                            className={cn(
                                              "mr-2 h-4 w-4",
                                              field.value === rec.recipeNumber ? "opacity-100" : "opacity-0"
                                            )}
                                          />
                                          {rec.recipeName}
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
                    {fields.length > 1 && (
                     <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive-foreground hover:bg-destructive/90 h-9 w-9 mt-6"
                        onClick={() => remove(index)}
                        disabled={isSubmitting}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                  )}
                  </div>
                 )
              })}
              </div>
               <FormMessage>{form.formState.errors.items?.root?.message || form.formState.errors.items?.message}</FormMessage>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => append({ recipeId: "" })}
                disabled={isSubmitting}
              >
                <PlusCircle className="mr-2 h-4 w-4" /> Add Recipe
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || recipesLoading}>
            {(isSubmitting || recipesLoading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {menu ? "Save Changes" : "Add Menu"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
