
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { OrderSchema, type OrderFormData } from "@/lib/schemas";

interface AddBulkItemDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onSubmit: (data: Partial<OrderFormData>) => Promise<void>;
  bookingId: string;
  clientId: string;
}

const BulkItemSchema = OrderSchema.pick({ clientEvents: true, booking_id: true }).partial();


export function AddBulkItemDialog({ 
    isOpen, 
    setIsOpen, 
    onSubmit, 
    bookingId,
    clientId
}: AddBulkItemDialogProps) {
  
  const form = useForm<Partial<OrderFormData>>({
    resolver: zodResolver(BulkItemSchema),
    defaultValues: {
      booking_id: bookingId,
      clientEvents: [{
        clientId: clientId,
        particularDescription: "",
        numberOfPeople: 1, // Represents quantity for bulk items
        unitPrice: 0,
        total: 0,
        vatType: "inclusive",
        recipes: [],
        particularType: 'custom',
        date: new Date().toISOString()
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
    const payload = {
        ...data,
        name: data.clientEvents?.[0]?.particularDescription || 'Bulk Item'
    }
    await onSubmit(payload);
    setIsOpen(false);
  };
  
  useEffect(() => {
    if (isOpen) {
      form.reset({
        booking_id: bookingId,
        clientEvents: [{
          clientId: clientId,
          particularDescription: "",
          numberOfPeople: 1,
          unitPrice: 0,
          total: 0,
          vatType: "inclusive",
          recipes: [],
          particularType: 'custom',
          date: new Date().toISOString()
        }]
      });
    }
  }, [isOpen, form, bookingId, clientId]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-lg">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <DialogHeader>
              <DialogTitle>Add Bulk Item to Booking</DialogTitle>
              <DialogDescription>
                Record items consumed over the contract period, like cartons of drinks.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
               <FormField
                control={control}
                name="clientEvents.0.particularDescription"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Item Description</FormLabel>
                    <FormControl><Input {...field} placeholder="e.g. 93 Cartons of Azam Juice"/></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <div className="grid grid-cols-2 gap-4">
                <FormField
                    control={control}
                    name="clientEvents.0.numberOfPeople"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Quantity</FormLabel>
                        <FormControl><Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} /></FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormField
                    control={control}
                    name="clientEvents.0.unitPrice"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Unit Price</FormLabel>
                        <FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
               </div>
               <div className="text-right font-bold text-lg">
                Total: {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS'}).format(watch('clientEvents.0.total') || 0)}
               </div>
            </div>
            <DialogFooter className="pt-4 border-t">
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Bulk Item
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
