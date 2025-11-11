
"use client";

import { useEffect, useState } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { z } from "zod";
import { MEAL_TYPES } from "@/types";
import { parseISO } from "date-fns";

const BulkAddSchema = z.object({
  dates: z.array(z.date()).min(1, "Please select at least one date."),
  pax: z.number().min(1, "Number of people must be at least 1."),
  unitPrice: z.number().min(0, "Unit price must be a positive number."),
  mealType: z.string().min(1, "Meal type is required."),
  vatType: z.enum(['inclusive', 'exclusive']),
});

type BulkAddFormData = z.infer<typeof BulkAddSchema>;

interface BulkAddOrdersDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onSubmit: (data: BulkAddFormData) => Promise<void>;
  bookingStartDate: string;
  bookingEndDate: string;
}

export function BulkAddOrdersDialog({ 
    isOpen, 
    setIsOpen, 
    onSubmit, 
    bookingStartDate,
    bookingEndDate 
}: BulkAddOrdersDialogProps) {
  
  const form = useForm<BulkAddFormData>({
    resolver: zodResolver(BulkAddSchema),
    defaultValues: {
      dates: [],
      pax: 1,
      unitPrice: 0,
      mealType: "Lunch only",
      vatType: "inclusive",
    },
  });

  const { isSubmitting } = form.formState;

  const handleSubmit = async (data: BulkAddFormData) => {
    await onSubmit(data);
    form.reset();
  };

  const fromDate = parseISO(bookingStartDate);
  const toDate = parseISO(bookingEndDate);

  useEffect(() => {
    if (isOpen) {
      form.reset({
        dates: [],
        pax: 1,
        unitPrice: 0,
        mealType: "Lunch only",
        vatType: "inclusive",
      });
    }
  }, [isOpen, form]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-4xl">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <DialogHeader>
              <DialogTitle>Bulk Add Daily Orders</DialogTitle>
              <DialogDescription>
                Quickly create multiple daily orders with the same details for different dates.
              </DialogDescription>
            </DialogHeader>
            <div className="grid md:grid-cols-2 gap-8 py-4">
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="pax"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Number of People (PAX)</FormLabel>
                      <FormControl>
                        <Input type="number" min="1" {...field} onChange={e => field.onChange(parseInt(e.target.value) || 1)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="unitPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit Price</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" step="any" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="mealType"
                  render={({ field }) => (
                    <FormItem>
                        <FormLabel>Meal Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                                {MEAL_TYPES.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="vatType"
                  render={({ field }) => (
                    <FormItem>
                        <FormLabel>VAT Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                            <SelectContent>
                                <SelectItem value="inclusive">Inclusive</SelectItem>
                                <SelectItem value="exclusive">Exclusive</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="dates"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Select Order Dates</FormLabel>
                    <FormControl>
                      <div className="p-2 border rounded-md">
                        <Calendar
                          mode="multiple"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date < fromDate || date > toDate}
                          footer={<p className="text-center text-sm text-muted-foreground p-2">You selected {field.value?.length || 0} date(s).</p>}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create {form.getValues('dates')?.length || 0} Orders
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
