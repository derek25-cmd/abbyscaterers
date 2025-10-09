"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2 } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { OrderSchema, type OrderFormData } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { useClientStorage } from "@/hooks/use-client-storage";
import { useRecipeStorage } from "@/hooks/use-recipe-storage";
import { ClientEventForm } from "../orders/order-form";


interface AddDailyOrderDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onSubmit: (data: OrderFormData) => Promise<void>;
  bookingStartDate: string;
  bookingEndDate: string;
  clientId: string;
  bookingId: string;
}

export function AddDailyOrderDialog({ 
    isOpen, 
    setIsOpen, 
    onSubmit, 
    bookingStartDate, 
    bookingEndDate,
    clientId,
    bookingId
}: AddDailyOrderDialogProps) {
  
  const form = useForm<OrderFormData>({
    resolver: zodResolver(OrderSchema),
    defaultValues: {
      id: `ORD-${Date.now()}`,
      name: `Daily Order for ${format(new Date(), 'PPP')}`,
      description: `Part of booking #${bookingId}`,
      booking_id: bookingId,
      proformaId: "",
      clientEvents: [{
        clientId: clientId,
        date: new Date().toISOString(),
        mealType: "Lunch only",
        numberOfPeople: 1,
        unitPrice: 0,
        vatType: "inclusive",
        recipes: [],
      }]
    },
  });

  const { isSubmitting } = form.formState;

  const handleSubmit = async (data: OrderFormData) => {
    await onSubmit(data);
    form.reset();
  };
  
  const fromDate = parseISO(bookingStartDate);
  const toDate = parseISO(bookingEndDate);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-4xl">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <DialogHeader>
              <DialogTitle>Record Daily Order</DialogTitle>
              <DialogDescription>
                Add a new daily order to this booking contract. This will create a new entry in the main Orders list.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-4">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Order ID</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., ORD-2024-001" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                   <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Order Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Daily Lunch for NMB" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
               </div>
               
               <ClientEventForm
                 control={form.control}
                 nestIndex={0}
                 isSubmitting={isSubmitting}
                 singleClientEvent={true}
                 dateRange={{ from: fromDate, to: toDate }}
               />

            </div>
            <DialogFooter className="pt-4">
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Record Order
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

