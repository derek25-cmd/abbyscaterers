
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
import { ClientEventForm } from "../orders/order-form";
import { format, parseISO } from "date-fns";


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
  
  const DailyOrderDialogSchema = OrderSchema.pick({ clientEvents: true, booking_id: true }).partial();

  const form = useForm<Partial<OrderFormData>>({
    resolver: zodResolver(DailyOrderDialogSchema),
    defaultValues: {
      booking_id: bookingId,
      clientEvents: [{
        clientId: clientId,
        date: format(new Date(), 'yyyy-MM-dd'),
        mealType: "Lunch only",
        numberOfPeople: 1,
        unitPrice: 0,
        total: 0,
        vatType: "inclusive",
        recipes: [],
        particularType: 'meal'
      }]
    },
  });
  
  const { control, watch, setValue } = form;
  const clientEvents = watch('clientEvents');

  useEffect(() => {
    if (clientEvents && clientEvents.length > 0) {
      const { numberOfPeople, unitPrice } = clientEvents[0];
      const newTotal = (numberOfPeople || 0) * (unitPrice || 0);
      if (clientEvents[0].total !== newTotal) {
        setValue('clientEvents.0.total', newTotal, { shouldValidate: true });
      }
    }
  }, [clientEvents, setValue]);

  const { isSubmitting } = form.formState;

  const handleSubmit = async (data: Partial<OrderFormData>) => {
    await onSubmit(data);
    setIsOpen(false);
  };
  
  const fromDate = parseISO(bookingStartDate);
  const toDate = parseISO(bookingEndDate);

  useEffect(() => {
    if (isOpen) {
      form.reset({
        booking_id: bookingId,
        clientEvents: [{
          clientId: clientId,
          date: format(new Date(), 'yyyy-MM-dd'),
          mealType: "Lunch only",
          numberOfPeople: 1,
          unitPrice: 0,
          total: 0,
          vatType: "inclusive",
          recipes: [],
          particularType: 'meal'
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
              <DialogTitle>Record Order Item</DialogTitle>
              <DialogDescription>
                Add a new daily order or a custom line item to this booking contract.
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
                 allowCustomMealType={true}
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
