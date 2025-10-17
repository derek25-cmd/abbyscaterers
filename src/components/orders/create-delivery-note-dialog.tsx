
"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { useDeliveryNoteStorage } from "@/hooks/use-delivery-note-storage";
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
import { z } from "zod";
import { useClientStorage } from "@/hooks/use-client-storage";
import { useEffect } from "react";

interface CreateDeliveryNoteDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  order: Order;
}

const DeliveryNoteDialogSchema = z.object({
  vehicleRegNo: z.string().optional(),
  deliveredBy: z.string().min(1, "Delivered by is required"),
  location: z.string().min(1, "Location is required"),
});
type DeliveryNoteDialogFormData = z.infer<typeof DeliveryNoteDialogSchema>;

export function CreateDeliveryNoteDialog({ isOpen, setIsOpen, order }: CreateDeliveryNoteDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { addDeliveryNote } = useDeliveryNoteStorage();
  const { getClientById } = useClientStorage();

  const form = useForm<DeliveryNoteDialogFormData>({
    resolver: zodResolver(DeliveryNoteDialogSchema),
    defaultValues: {
      vehicleRegNo: "",
      deliveredBy: "",
      location: "",
    }
  });

  useEffect(() => {
    if (order.clientEvents && order.clientEvents.length > 0) {
      const clientId = order.clientEvents[0].client_id || order.clientEvents[0].clientId;
      const client = getClientById(clientId);
      if (client?.primaryLocation) {
        form.setValue("location", client.primaryLocation);
      }
    }
  }, [order, getClientById, form]);

  async function onSubmit(data: DeliveryNoteDialogFormData) {
    try {
      const newNote = await addDeliveryNote(order, data);

      if (newNote) {
        toast({ title: "Success", description: `Delivery note ${newNote.id} created.` });
        setIsOpen(false);
        form.reset();
        router.push(`/delivery-notes/${newNote.id}`);
      } else {
         throw new Error("Failed to create delivery note. The creation service returned null.");
      }
    } catch (error) {
      console.error("Failed to create delivery note:", error);
      let message = "An unexpected error occurred.";
      if (error instanceof Error) {
        message = error.message;
      }
      toast({ variant: "destructive", title: "Error", description: message });
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
                Confirm details for the delivery note for order: {order.name}.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
               <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Delivery Location</FormLabel>
                    <FormControl><Input {...field} placeholder="e.g. NMB HQ, Posta"/></FormControl>
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
                    <FormControl><Input {...field} placeholder="e.g. T123 ABC"/></FormControl>
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
                    <FormControl><Input {...field} placeholder="e.g. Jovin Paul Jovin"/></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => { setIsOpen(false); form.reset(); }} disabled={form.formState.isSubmitting}>
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
