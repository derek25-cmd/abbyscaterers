
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
import { DailyOrderSchema, type DailyOrderFormData } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { Textarea } from "../ui/textarea";

interface AddDailyOrderDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onSubmit: (data: Omit<DailyOrderFormData, 'bookingId' | 'total'>) => Promise<void>;
  bookingStartDate: string;
  bookingEndDate: string;
}

export function AddDailyOrderDialog({ isOpen, setIsOpen, onSubmit, bookingStartDate, bookingEndDate }: AddDailyOrderDialogProps) {
  const form = useForm<Omit<DailyOrderFormData, 'bookingId' | 'total'>>({
    resolver: zodResolver(DailyOrderSchema.omit({ bookingId: true, total: true, id: true })),
    defaultValues: {
      orderDate: new Date().toISOString(),
      menu: "",
      quantity: 1,
      unitPrice: 0,
    },
  });

  const { isSubmitting } = form.formState;

  const handleSubmit = async (data: Omit<DailyOrderFormData, 'bookingId' | 'total'>) => {
    await onSubmit(data);
    form.reset();
  };
  
  const fromDate = parseISO(bookingStartDate);
  const toDate = parseISO(bookingEndDate);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <DialogHeader>
              <DialogTitle>Record Daily Order</DialogTitle>
              <DialogDescription>
                Add a new daily order to this booking contract.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
               <FormField
                control={form.control}
                name="orderDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Order Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                            {field.value ? format(parseISO(field.value), "PPP") : <span>Pick a date</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar 
                            mode="single" 
                            selected={field.value ? parseISO(field.value) : undefined} 
                            onSelect={(date) => field.onChange(date?.toISOString())} 
                            disabled={{ before: fromDate, after: toDate }}
                            initialFocus 
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="menu"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Menu / Particulars</FormLabel>
                    <FormControl>
                      <Textarea placeholder="e.g., Breakfast & Lunch for 50pax" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="quantity"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Quantity</FormLabel>
                        <FormControl>
                        <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} />
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
                        <FormLabel>Unit Price (TZS)</FormLabel>
                        <FormControl>
                        <Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
              </div>
            </div>
            <DialogFooter>
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

