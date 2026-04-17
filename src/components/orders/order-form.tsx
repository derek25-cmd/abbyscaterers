"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray, Control, UseFormReturn } from "react-hook-form";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "../ui/separator";
import { OrderSchema, type OrderFormData } from "@/lib/schemas";
import type { Order } from "@/types";
import { useOrderStorage } from "@/hooks/use-order-storage";
import { useRecipeStorage } from "@/hooks/use-recipe-storage";
import { useClientStorage } from "@/hooks/use-client-storage";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Info, PlusCircle, Trash2, Check, ChevronsUpDown, CalendarIcon, User, Utensils, Users, DollarSign, Pencil, MapPin } from "lucide-react";
import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { format, parseISO, isValid } from "date-fns";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { MEAL_TYPES, REGIONS } from "@/types";
import { Textarea } from "../ui/textarea";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { Label } from "../ui/label";

interface ClientEventRecipeFormProps {
    nestIndex: number;
    control: Control<OrderFormData>;
}

const ClientEventRecipeForm = ({ nestIndex, control }: ClientEventRecipeFormProps) => {
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

interface ClientEventFormProps {
    form: UseFormReturn<any>;
    nestIndex: number;
    isSubmitting: boolean;
    dateRange?: { from: Date, to: Date };
}

export const ClientEventForm = ({ form, nestIndex, isSubmitting, dateRange }: ClientEventFormProps) => {
    const { control, watch, setValue } = form;
    const particularType = watch(`clientEvents.${nestIndex}.particularType`);

    const pax = watch(`clientEvents.${nestIndex}.numberOfPeople`);
    const unitPrice = watch(`clientEvents.${nestIndex}.unitPrice`);

    useEffect(() => {
        const total = (pax || 0) * (unitPrice || 0);
        setValue(`clientEvents.${nestIndex}.total`, total, { shouldValidate: true });
    }, [pax, unitPrice, nestIndex, setValue]);


    return (
        <div className="space-y-6">
            <FormField control={control} name={`clientEvents.${nestIndex}.particularType`} render={({ field }) => (
                <FormItem>
                    <FormLabel>Particulars Display</FormLabel>
                    <FormControl>
                        <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex gap-4 pt-2">
                            <div className="flex items-center space-x-2"><RadioGroupItem value="event" id={`event-${nestIndex}`} /><Label htmlFor={`event-${nestIndex}`}>Event Type</Label></div>
                            <div className="flex items-center space-x-2"><RadioGroupItem value="meal" id={`meal-${nestIndex}`} /><Label htmlFor={`meal-${nestIndex}`}>Meal Type</Label></div>
                            <div className="flex items-center space-x-2"><RadioGroupItem value="custom" id={`custom-${nestIndex}`} /><Label htmlFor={`custom-${nestIndex}`}>Custom</Label></div>
                        </RadioGroup>
                    </FormControl>
                </FormItem>
            )} />

             {particularType === 'custom' ? (
                 <FormField control={control} name={`clientEvents.${nestIndex}.particularDescription`} render={({ field }) => (
                    <FormItem><FormLabel>Custom Particulars</FormLabel><FormControl><Input {...field} placeholder="e.g. 93 Cartons of Juice" /></FormControl></FormItem>
                )} />
            ) : null}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={control} name={`clientEvents.${nestIndex}.date`} render={({ field }) => {
                    const dateValue = field.value ? parseISO(field.value) : undefined;
                    return (
                        <FormItem className="flex flex-col">
                            <FormLabel>Event Date</FormLabel>
                            <Popover>
                                <PopoverTrigger asChild><FormControl><Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                    {dateValue && isValid(dateValue) ? format(dateValue, "PPP") : <span>Pick a date</span>}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button></FormControl></PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar 
                                        mode="single" 
                                        selected={dateValue} 
                                        onSelect={(date) => field.onChange(date ? format(date, 'yyyy-MM-dd') : '')} 
                                        initialFocus 
                                        disabled={dateRange ? (date) => date < dateRange.from || date > dateRange.to : undefined} 
                                    />
                                </PopoverContent>
                            </Popover>
                            <FormMessage />
                        </FormItem>
                    )
                }} />
                <FormField control={control} name={`clientEvents.${nestIndex}.region`} render={({ field }) => (
                    <FormItem>
                        <FormLabel className="flex items-center"><MapPin className="mr-2 h-4 w-4"/>Region / Branch</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select region" /></SelectTrigger></FormControl>
                            <SelectContent>
                                {REGIONS.map(region => <SelectItem key={region} value={region}>{region}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={control} name={`clientEvents.${nestIndex}.numberOfPeople`} render={({ field }) => (
                    <FormItem>
                        <FormLabel className="flex items-center"><Users className="mr-2 h-4 w-4"/>Number of People/Qty</FormLabel>
                        <FormControl><Input type="number" placeholder="e.g. 50" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)}/></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
                <FormField control={control} name={`clientEvents.${nestIndex}.mealType`} render={({ field }) => (
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
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <FormField control={control} name={`clientEvents.${nestIndex}.unitPrice`} render={({ field }) => (
                    <FormItem>
                        <FormLabel className="flex items-center"><DollarSign className="mr-2 h-4 w-4"/>Unit Price</FormLabel>
                        <FormControl><Input type="number" placeholder="e.g. 25.50" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)}/></FormControl>
                        <FormMessage />
                    </FormItem>
                 )}/>
                  <FormField control={control} name={`clientEvents.${nestIndex}.vatType`} render={({ field }) => (
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
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <FormItem>
                    <FormLabel>Total Price</FormLabel>
                    <Input type="text" readOnly disabled value={`${((watch(`clientEvents.${nestIndex}.unitPrice`) || 0) * (watch(`clientEvents.${nestIndex}.numberOfPeople`) || 0)).toFixed(2)}`} />
                 </FormItem>
             </div>
             
            <Separator />
            <ClientEventRecipeForm nestIndex={nestIndex} control={control} />
        </div>
    )
}

interface OrderFormProps {
  order?: Order;
  clientId?: string;
}

export function OrderForm({ order, clientId }: OrderFormProps) {
  const router = useRouter();
  const { addOrder, updateOrder } = useOrderStorage();
  const { clients, isLoading: clientsLoading } = useClientStorage();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<OrderFormData>({
    resolver: zodResolver(OrderSchema),
    defaultValues: order
      ? { ...order }
      : {
          id: "",
          name: "",
          clientId: clientId || "",
          startDate: format(new Date(), 'yyyy-MM-dd'),
          endDate: format(new Date(), 'yyyy-MM-dd'),
          description: "",
          proformaId: "",
          clientEvents: [{ 
              date: format(new Date(), 'yyyy-MM-dd'),
              mealType: "Lunch only", 
              numberOfPeople: 10,
              unitPrice: 0,
              total: 0,
              vatType: "inclusive", 
              recipes: [],
              region: "Dar es Salaam",
              particularType: "event"
            }],
        },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "clientEvents"
  });

  useEffect(() => {
    if (order) {
      form.reset({
          ...order,
          clientId: order.clientId || "",
          startDate: order.startDate || format(new Date(), 'yyyy-MM-dd'),
          endDate: order.endDate || format(new Date(), 'yyyy-MM-dd'),
      });
    }
  }, [order, form]);
  
  const watchedClientId = form.watch('clientId');
  const watchedStartDate = form.watch('startDate');
  const watchedEndDate = form.watch('endDate');

  useEffect(() => {
      if (!order && watchedClientId && watchedStartDate) {
          const clientName = clients.find(c => c.id === watchedClientId)?.companyName || 'Client';
          const dateStr = watchedStartDate ? format(parseISO(watchedStartDate), 'PPP') : 'Date';
          form.setValue('name', `${clientName} Order - ${dateStr}`);
      }
  }, [watchedClientId, watchedStartDate, clients, order, form]);

  async function onSubmit(data: OrderFormData) {
    setIsSubmitting(true);
    try {
      if (order) {
        const updatedOrder = await updateOrder(order.id, data);
        if (updatedOrder) {
          toast({ title: "Order Updated", description: `${updatedOrder.name} (ID: ${updatedOrder.id}) has been updated.` });
          router.push(`/orders/${updatedOrder.id}`);
        } else {
            toast({ variant: "destructive", title: "Update Failed", description: "The order could not be saved. This is usually due to a database constraint or missing field."});
        }
      } else {
        const newOrderData = await addOrder(data);
        if (newOrderData) {
            toast({ title: "Order Added", description: `${newOrderData!.name} (ID: ${newOrderData!.id}) has been added.` });
            router.push("/orders");
        } else {
            toast({ variant: "destructive", title: "Creation Failed", description: "The order could not be created. Please ensure a customer is selected."});
        }
      }
    } catch (error: any) {
       console.error("Submission error:", error);
       toast({ variant: "destructive", title: "Submission Error", description: error.message || "An unexpected error occurred." });
    } finally {
      setIsSubmitting(false);
    }
  }

  const dateRange = React.useMemo(() => {
      if (watchedStartDate && watchedEndDate && isValid(parseISO(watchedStartDate)) && isValid(parseISO(watchedEndDate))) {
          return { from: parseISO(watchedStartDate), to: parseISO(watchedEndDate) };
      }
      return undefined;
  }, [watchedStartDate, watchedEndDate]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit, (err) => console.log("Validation Errors:", err))} className="space-y-8">
        <Card className="border-primary/20 shadow-md">
          <CardHeader>
            <CardTitle>{order ? `Edit Order: ${order.name}` : "Create New Order"}</CardTitle>
            <CardDescription>
              First select the client and contract duration, then add individual events.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="clientId" render={({ field }) => (
                    <FormItem>
                        <FormLabel className="flex items-center"><User className="mr-2 h-4 w-4"/>Customer Name</FormLabel>
                        <Popover>
                            <PopoverTrigger asChild>
                                <FormControl>
                                    <Button variant="outline" role="combobox" className={cn("w-full justify-between", !field.value && "text-muted-foreground")} disabled={clientsLoading}>
                                        {clientsLoading ? "Loading..." : field.value ? clients.find(c => c.id === field.value)?.companyName : "Select customer"}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                <Command>
                                    <CommandInput placeholder="Search customer..." />
                                    <CommandList>
                                        <CommandEmpty>No customer found.</CommandEmpty>
                                        <CommandGroup>
                                            {clients.map((c) => (
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
                <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Order Name / Reference</FormLabel>
                        <FormControl><Input placeholder="e.g. July Lunches for NMB" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="startDate" render={({ field }) => (
                    <FormItem className="flex flex-col">
                        <FormLabel>Start Date</FormLabel>
                        <Popover>
                            <PopoverTrigger asChild><FormControl><Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                {field.value && isValid(parseISO(field.value)) ? format(parseISO(field.value), "PPP") : <span>Select start date</span>}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button></FormControl></PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value ? parseISO(field.value) : undefined} onSelect={(d) => field.onChange(d ? format(d, 'yyyy-MM-dd') : '')} initialFocus /></PopoverContent>
                        </Popover>
                        <FormMessage />
                    </FormItem>
                )} />
                <FormField control={form.control} name="endDate" render={({ field }) => (
                    <FormItem className="flex flex-col">
                        <FormLabel>End Date</FormLabel>
                        <Popover>
                            <PopoverTrigger asChild><FormControl><Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                {field.value && isValid(parseISO(field.value)) ? format(parseISO(field.value), "PPP") : <span>Select end date</span>}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button></FormControl></PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value ? parseISO(field.value) : undefined} onSelect={(d) => field.onChange(d ? format(d, 'yyyy-MM-dd') : '')} initialFocus /></PopoverContent>
                        </Popover>
                        <FormMessage />
                    </FormItem>
                )} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="proformaId" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Link Proforma No. (Optional)</FormLabel>
                        <FormControl><Input placeholder="e.g. PI-2024-001" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
                 <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Internal Description (Optional)</FormLabel>
                        <FormControl><Textarea placeholder="Any internal notes about this order..." {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
             <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-primary flex items-center"><CalendarIcon className="mr-2 h-6 w-6"/>Daily Events / Deliveries</h3>
             </div>

             {fields.map((item, index) => (
                <Card key={item.id} className="relative bg-card/50 border-accent/20">
                    <CardHeader className="py-3 px-4 border-b bg-muted/30">
                        <div className="flex justify-between items-center">
                            <CardTitle className="text-sm font-semibold uppercase tracking-wider">Event #{index + 1}</CardTitle>
                            {fields.length > 1 && (
                                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => remove(index)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="p-6">
                        <ClientEventForm
                            form={form}
                            nestIndex={index}
                            isSubmitting={isSubmitting}
                            dateRange={dateRange}
                        />
                    </CardContent>
                </Card>
             ))}

             <Button 
                type="button" 
                variant="outline" 
                className="w-full py-8 border-dashed border-2 hover:bg-primary/5 hover:border-primary/50 transition-all duration-200 group h-auto" 
                onClick={() => append({ 
                    date: watchedStartDate || format(new Date(), 'yyyy-MM-dd'), 
                    mealType: "Lunch only", 
                    numberOfPeople: 10, 
                    unitPrice: 0, 
                    total: 0, 
                    vatType: "inclusive", 
                    recipes: [], 
                    region: "Dar es Salaam", 
                    particularType: "event" 
                })} 
                disabled={isSubmitting}
             >
                <div className="flex flex-col items-center gap-2">
                    <PlusCircle className="h-8 w-8 text-primary group-hover:scale-110 transition-transform" />
                    <span className="text-lg font-semibold">Add New Event Entry</span>
                    <span className="text-xs text-muted-foreground italic">Add another line item to this order</span>
                </div>
             </Button>

             <FormMessage>{(form.formState.errors.clientEvents as any)?.message || (form.formState.errors.clientEvents as any)?.root?.message}</FormMessage>
        </div>

        <div className="flex justify-end gap-4 pt-6 border-t">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting} size="lg">
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {order ? "Save Changes" : "Create Order"}
          </Button>
        </div>
      </form>
    </Form>
  );
}