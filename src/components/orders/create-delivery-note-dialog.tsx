
"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { DeliveryNoteSchema, type DeliveryNoteFormData } from "@/lib/schemas";
import { useToast } from "@/hooks/use-toast";
import { useDeliveryNoteStorage } from "@/hooks/use-delivery-note-storage";
import { useRecipeStorage } from "@/hooks/use-recipe-storage";
import { useClientStorage } from "@/hooks/use-client-storage";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import type { Order } from "@/types";
import { format, parseISO } from "date-fns";
import React from "react";

interface CreateDeliveryNoteDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  order: Order;
}

export function CreateDeliveryNoteDialog({ isOpen, setIsOpen, order }: CreateDeliveryNoteDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { addDeliveryNote } = useDeliveryNoteStorage();
  const { getRecipeById } = useRecipeStorage();
  const { getClientById } = useClientStorage();

  const form = useForm<DeliveryNoteFormData>({
    resolver: zodResolver(DeliveryNoteSchema),
  });

  React.useEffect(() => {
    if (order && isOpen) {
      const client = order.clientEvents[0] ? getClientById(order.clientEvents[0].clientId) : null;
      
      form.reset({
        id: `DN-${Date.now()}`,
        orderId: order.id,
        clientId: client?.id || '',
        clientName: client?.companyName || 'Unknown Client',
        deliveryDate: format(new Date(), 'yyyy-MM-dd'),
        deliveryLocation: client?.primaryLocation || client?.address1 || "",
        vehicleRegNo: "",
        deliveredBy: "",
        items: order.clientEvents.flatMap(event => 
          event.recipes.map(recipeRef => {
            const recipe = getRecipeById(recipeRef.recipeId);
            return {
              qty: event.numberOfPeople, // 'qty' should be the number of people
              itemCode: recipe?.recipeNumber || 'N/A',
              description: recipe?.recipeName || 'Unknown Recipe'
            }
          })
        ),
      });
    }
  }, [order, isOpen, getClientById, getRecipeById, form]);


  async function onSubmit(data: DeliveryNoteFormData) {
    try {
      const newNote = await addDeliveryNote(data);
      if (newNote) {
        toast({ title: "Success", description: `Delivery note ${newNote.id} created.` });
        setIsOpen(false);
        router.push(`/delivery-notes/${newNote.id}`);
      } else {
         throw new Error("Failed to save delivery note to storage.");
      }
    } catch (error) {
      console.error("Failed to create delivery note:", error);
      toast({ variant: "destructive", title: "Error", description: "Failed to create delivery note." });
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>Create Delivery Note</DialogTitle>
              <DialogDescription>
                Confirm details for the delivery note for order {order.name}.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
               <FormField
                control={form.control}
                name="id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Delivery Note Number</FormLabel>
                    <FormControl><Input {...field} readOnly /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="deliveryLocation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Delivery Location</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="vehicleRegNo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vehicle Registration No.</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="deliveredBy"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Delivered By</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create & View Note
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
