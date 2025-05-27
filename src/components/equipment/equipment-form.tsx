
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
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { equipmentSchema, type EquipmentFormData } from "@/lib/schemas";
import type { Equipment } from "@/types";
import { useEquipmentStorage } from "@/hooks/use-equipment-storage";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Info } from "lucide-react";
import React, { useState, useEffect } from "react";

interface EquipmentFormProps {
  equipment?: Equipment; // For editing existing equipment
}

export function EquipmentForm({ equipment }: EquipmentFormProps) {
  const router = useRouter();
  const { addEquipment, updateEquipment } = useEquipmentStorage();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<EquipmentFormData>({
    resolver: zodResolver(equipmentSchema),
    defaultValues: equipment
      ? { ...equipment, quantity: equipment.quantity || 1 } // Ensure quantity has a default if undefined
      : {
          equipmentNumber: "",
          equipmentName: "",
          oem: "",
          model: "",
          powerRating: "",
          quantity: 1,
          yearOfManufacture: "",
          equipmentSource: "",
          capacity: "",
          commitment: "",
          registrationNumber: "",
        },
  });
  
  useEffect(() => {
    if (equipment) {
      form.reset({ ...equipment, quantity: equipment.quantity || 1 });
    }
  }, [equipment, form]);

  async function onSubmit(data: EquipmentFormData) {
    setIsSubmitting(true);
    try {
      const payload: EquipmentFormData = {
        ...data,
        quantity: Number(data.quantity) // Ensure quantity is treated as a number
      };

      if (equipment) {
        const updated = updateEquipment(equipment.equipmentNumber, payload); 
        if (updated) {
          toast({ title: "Equipment Updated", description: `${updated.equipmentName} (No: ${updated.equipmentNumber}) has been updated.` });
          router.push(`/equipment/${updated.equipmentNumber}`);
        } else {
          toast({ variant: "destructive", title: "Error", description: "Failed to update equipment." });
        }
      } else {
        const newEquipmentData = addEquipment(payload);
        toast({ title: "Equipment Added", description: `${newEquipmentData.equipmentName} (No: ${newEquipmentData.equipmentNumber}) has been added.` });
        router.push("/equipment");
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
            <CardTitle>{equipment ? "Edit Equipment" : "Add New Equipment"}</CardTitle>
            <CardDescription>
              {equipment ? "Update the details for this equipment item." : "Fill in the information for the new equipment item."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="equipmentNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Equipment No.</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. EQ-001" {...field} />
                  </FormControl>
                  <FormDescription className="flex items-center gap-1">
                    <Info className="h-3 w-3" /> Enter a unique identifier for this equipment.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="equipmentName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Equipment Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Industrial Oven" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="oem"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>OEM (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Hobart" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Model (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. HEC502" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="powerRating"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Power Rating (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 220V, 3 Phase, 10kW" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g. 1" {...field} onChange={e => field.onChange(parseInt(e.target.value,10) || 0 )}/>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="yearOfManufacture"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Year of Manufacture (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 2021" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="equipmentSource"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Equipment Source (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Purchased New, Leased" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <FormField
                control={form.control}
                name="capacity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Capacity (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 10 Trays, 50 Liters" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="commitment"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Commitment (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Owned, Leased until 2025" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="registrationNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Registration Number (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. REG-123XYZ" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {equipment ? "Save Changes" : "Add Equipment"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
