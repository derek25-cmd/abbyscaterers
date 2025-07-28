
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { OrderSchema, type OrderFormData } from "@/lib/schemas";
import type { Order } from "@/types";
import { useOrderStorage } from "@/hooks/use-order-storage";
import { useRecipeStorage } from "@/hooks/use-recipe-storage";
import { useClientStorage } from "@/hooks/use-client-storage";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Info, PlusCircle, Trash2, Check, ChevronsUpDown, CalendarIcon, User, Utensils, Users, DollarSign } from "lucide-react";
import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { format, parseISO, isValid } from "date-fns";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { MEAL_TYPES } from "@/types";
import { Textarea } from "../ui/textarea";

interface OrderFormProps {
  order?: Order;
  clientId?: string;
}

const ClientEventRecipeForm = ({ nestIndex, control }: { nestIndex: number, control: any }) => {
    const { fields: recipeFields, append: appendRecipe, remove: removeRecipe } = useFieldArray({
        control,
        name: `clientEvents.${nestIndex}.recipes`
    });

    const { recipes: availableRecipes, isLoading: recipesLoading } = useRecipeStorage();

    return (
        <div className="space-y-3">
             <FormLabel>Recipes</FormLabel>
            {recipeFields.map((item, k) => (
                <div key={item.id} className="flex items-center gap-2">
                    <FormField
                        control={control}
                        name={`clientEvents.${nestIndex}.recipes.${k}.recipeId`}
                        render={({ field }) => (
                            <FormItem className="flex-1">
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <FormControl>
                                            <Button variant="outline" role="combobox" className={cn("w-full justify-between", !field.value && "text-muted-foreground")} disabled={recipesLoading}>
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
                                                        <CommandItem key={rec.recipeNumber} value={rec.recipeName} onSelect={() => { field.onChange(rec.recipeNumber) }}>
                                                            <Check className={cn("mr-2 h-4 w-4", rec.recipeNumber === field.value ? "opacity-100" : "opacity-0")} />
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
                        )}
                    />
                    <Button type="button" variant="ghost" size="icon" className="text-destructive hover:text-destructive-foreground hover:bg-destructive/90 shrink-0" onClick={() => removeRecipe(k)}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            ))}
             <FormMessage>{(control.getFieldState(`clientEvents.${nestIndex}.recipes`)?.error as any)?.message}</FormMessage>
            <Button type="button" variant="outline" size="sm" onClick={() => appendRecipe({ recipeId: "" })}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add Recipe
            </Button>
        </div>
    )
}

export function OrderForm({ order, clientId }: OrderFormProps) {
  const router = useRouter();
  const { addOrder, updateOrder } = useOrderStorage();
  const { clients: availableClients, isLoading: clientsLoading } = useClientStorage();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditMode = !!order;

  const form = useForm<OrderFormData>({
    resolver: zodResolver(OrderSchema),
    defaultValues: order
      ? { ...order }
      : {
          id: "",
          name: "",
          description: "",
          proformaId: "",
          clientEvents: [{ 
              clientId: clientId || "", 
              date: new Date().toISOString(), 
              mealType: "Lunch only", 
              numberOfPeople: 10,
              unitPrice: 0,
              vatType: "inclusive", 
              recipes: [{recipeId: ""}] 
            }],
        },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "clientEvents"
  });

  useEffect(() => {
    if (order) {
      form.reset(order);
    }
  }, [order, form]);

  async function onSubmit(data: OrderFormData) {
    setIsSubmitting(true);
    try {
      if (order) {
        const updated = updateOrder(order.id, data);
        if (updated) {
          toast({ title: "Order Updated", description: `${updated.name} (ID: ${updated.id}) has been updated.` });
          router.push(`/orders/${updated.id}`);
        }
      } else {
        const newOrderData = addOrder(data);
        toast({ title: "Order Added", description: `${newOrderData.name} (ID: ${newOrderData.id}) has been added.` });
        router.push("/orders");
      }
    } catch (error) {
       console.error("Submission error:", error);
       let errorMessage = "An unexpected error occurred.";
       if (error instanceof Error) { errorMessage = error.message; }
       toast({ variant: "destructive", title: "Submission Error", description: errorMessage });
    } finally {
      setIsSubmitting(false);
    }
  }
  
  const isLoading = isSubmitting || clientsLoading;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>{order ? `Edit Order: ${order.name}` : "Add New Order"}</CardTitle>
            <CardDescription>
              An order can contain multiple events for different clients and dates.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="id" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Order ID</FormLabel>
                        <FormControl><Input placeholder="e.g. BOOK-2024-07" {...field} readOnly={isEditMode} /></FormControl>
                        <FormDescription><Info className="h-3 w-3 inline-block mr-1"/>A unique identifier for this entire order.</FormDescription>
                        <FormMessage />
                    </FormItem>
                )} />
                <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Order Name</FormLabel>
                        <FormControl><Input placeholder="e.g. Wedding Weekend Special" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
                <FormField control={form.control} name="proformaId" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Proforma No. (Optional)</FormLabel>
                        <FormControl><Input placeholder="e.g. PI-2024-001" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
                 <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Description (Optional)</FormLabel>
                        <FormControl><Textarea placeholder="A brief summary of the order..." {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
            </div>
          </CardContent>
        </Card>

        <Separator />
        
        <div className="space-y-6">
             {fields.map((item, index) => (
                <Card key={item.id} className="relative bg-card/50">
                    <CardHeader>
                        <CardTitle className="text-xl">Client Event #{index + 1}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField control={form.control} name={`clientEvents.${index}.clientId`} render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="flex items-center"><User className="mr-2 h-4 w-4"/>Client</FormLabel>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button variant="outline" role="combobox" className={cn("w-full justify-between", !field.value && "text-muted-foreground")} disabled={clientsLoading || !!clientId}>
                                                    {clientsLoading ? "Loading..." : field.value ? availableClients.find(c => c.id === field.value)?.companyName : "Select client"}
                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                            <Command>
                                                <CommandInput placeholder="Search client..." />
                                                <CommandList>
                                                    <CommandEmpty>No client found.</CommandEmpty>
                                                    <CommandGroup>
                                                        {availableClients.map((c) => (
                                                            <CommandItem key={c.id} value={c.companyName} onSelect={() => { field.onChange(c.id)}}>
                                                                <Check className={cn("mr-2 h-4 w-4", c.id === field.value ? "opacity-100" : "opacity-0")} />
                                                                {c.companyName}
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                    <FormMessage />
                                </FormItem>
                             )} />
                             <FormField control={form.control} name={`clientEvents.${index}.date`} render={({ field }) => {
                                 const dateValue = field.value ? parseISO(field.value) : undefined;
                                 return (
                                     <FormItem className="flex flex-col">
                                         <FormLabel>Event Date</FormLabel>
                                         <Popover>
                                             <PopoverTrigger asChild><FormControl><Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                                 {dateValue ? format(dateValue, "PPP") : <span>Pick a date</span>}
                                                 <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                             </Button></FormControl></PopoverTrigger>
                                             <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={dateValue} onSelect={(date) => field.onChange(date?.toISOString())} initialFocus /></PopoverContent>
                                         </Popover>
                                         <FormMessage />
                                     </FormItem>
                                 )
                             }} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField control={form.control} name={`clientEvents.${index}.numberOfPeople`} render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="flex items-center"><Users className="mr-2 h-4 w-4"/>Number of People</FormLabel>
                                    <FormControl><Input type="number" placeholder="e.g. 50" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)}/></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name={`clientEvents.${index}.mealType`} render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="flex items-center"><Utensils className="mr-2 h-4 w-4"/>Meal Type</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Select a meal type" /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            {MEAL_TYPES.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                             <FormField control={form.control} name={`clientEvents.${index}.unitPrice`} render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="flex items-center"><DollarSign className="mr-2 h-4 w-4"/>Unit Price</FormLabel>
                                    <FormControl><Input type="number" placeholder="e.g. 25.50" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)}/></FormControl>
                                    <FormMessage />
                                </FormItem>
                             )}/>
                             <FormItem>
                                <FormLabel>Total Price</FormLabel>
                                <Input type="text" readOnly disabled value={`$${(form.watch(`clientEvents.${index}.unitPrice`) * form.watch(`clientEvents.${index}.numberOfPeople`)).toFixed(2)}`} />
                             </FormItem>
                              <FormField control={form.control} name={`clientEvents.${index}.vatType`} render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="flex items-center">VAT</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Select VAT type" /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="inclusive">Inclusive</SelectItem>
                                            <SelectItem value="exclusive">Exclusive</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                         </div>
                        <Separator />
                        <ClientEventRecipeForm nestIndex={index} control={form.control} />

                    </CardContent>
                    {fields.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" className="absolute top-3 right-3 text-destructive hover:bg-destructive/90 hover:text-destructive-foreground" onClick={() => remove(index)}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    )}
                </Card>
             ))}
             <FormMessage>{(form.formState.errors.clientEvents as any)?.message || (form.formState.errors.clientEvents as any)?.root?.message}</FormMessage>
        </div>

        <Button type="button" variant="outline" size="sm" onClick={() => append({ clientId: "", date: new Date().toISOString(), mealType: "Lunch only", numberOfPeople: 10, unitPrice: 0, vatType: "inclusive", recipes: [{recipeId: ""}] })} disabled={isLoading}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add Client Event
        </Button>

        <div className="flex justify-end gap-4 pt-4 border-t">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {order ? "Save Changes" : "Save Order"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
