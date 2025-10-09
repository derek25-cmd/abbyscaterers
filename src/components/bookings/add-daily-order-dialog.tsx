
"use client";

import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
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
import { Form } from "@/components/ui/form";
import { Loader2 } from "lucide-react";
import { OrderSchema, type OrderFormData } from "@/lib/schemas";
import { format, parseISO } from "date-fns";
import { ClientEventForm } from "../orders/order-form";


interface AddDailyOrderDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onSubmit: (data: Partial<OrderFormData>) => Promise<void>;
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
  
  // Use a modified schema that omits the name for this specific dialog
  const DailyOrderDialogSchema = OrderSchema.omit({ name: true });

  const form = useForm<Partial<OrderFormData>>({
    resolver: zodResolver(DailyOrderDialogSchema),
    defaultValues: {
      id: `ORD-${Date.now()}`,
      description: `Part of booking #${bookingId}`,
      booking_id: bookingId,
      proformaId: "",
      clientEvents: [{
        clientId: clientId,
        date: new Date().toISOString(),
        mealType: "Lunch only",
        numberOfPeople: 1,
        unitPrice: 0,
        total: 0,
        vatType: "inclusive",
        recipes: [],
      }]
    },
  });

  const { isSubmitting } = form.formState;

  const handleSubmit = async (data: Partial<OrderFormData>) => {
    await onSubmit(data);
  };
  
  const fromDate = parseISO(bookingStartDate);
  const toDate = parseISO(bookingEndDate);

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      form.reset({
        id: `ORD-${Date.now()}`,
        description: `Part of booking #${bookingId}`,
        booking_id: bookingId,
        proformaId: "",
        clientEvents: [{
          clientId: clientId,
          date: new Date().toISOString(),
          mealType: "Lunch only",
          numberOfPeople: 1,
          unitPrice: 0,
          total: 0,
          vatType: "inclusive",
          recipes: [],
        }]
      });
    }
  }, [isOpen, form, bookingId, clientId]);

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
               
               <ClientEventForm
                 form={form as any}
                 nestIndex={0}
                 isSubmitting={isSubmitting}
                 singleClientEvent={true}
                 dateRange={{ from: fromDate, to: toDate }}
                 hideRecipes={true}
               />

            </div>
            <DialogFooter className="pt-4 border-t">
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
