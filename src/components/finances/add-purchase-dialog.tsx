'use client';

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { CalendarIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useEffect } from "react";
import { addPurchase, updatePurchase } from "@/services/purchaseService";
import { getBookings } from "@/services/bookingService";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { Purchase, Booking } from "@/types";

const PurchaseSchema = z.object({
  date: z.date({ required_error: "A date is required." }),
  supplier: z.string().min(1, "Supplier name is required."),
  supplier_tin: z.string().length(9, "Supplier TIN must be exactly 9 digits."),
  invoiceNumber: z.string().min(1, "Invoice number is required."),
  efd_receipt: z.string().min(1, "EFD Receipt is mandatory to claim Input VAT."),
  description: z.string().min(1, "Description is required."),
  quantity: z.number().min(0.01, "Quantity must be greater than 0."),
  unitCost: z.number().min(0, "Unit cost cannot be negative."),
  taxAmount: z.number().min(0, "Tax amount cannot be negative."),
  paymentMethod: z.enum(['cash', 'bank', 'credit']),
  paymentStatus: z.enum(['paid', 'unpaid']),
  expenseCategory: z.string().min(1, "Expense category is required."),
  event_id: z.string().min(1, "Event linkage is required."),
});

type PurchaseFormData = z.infer<typeof PurchaseSchema>;

interface AddPurchaseDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onSave: () => void;
  purchase: Purchase | null;
}

export function AddPurchaseDialog({ isOpen, setIsOpen, onSave, purchase }: AddPurchaseDialogProps) {
  const { toast } = useToast();
  
  const form = useForm<PurchaseFormData>({
    resolver: zodResolver(PurchaseSchema),
    defaultValues: {
      supplier: "",
      supplier_tin: "",
      invoiceNumber: "",
      efd_receipt: "",
      description: "",
      quantity: 1,
      unitCost: 0,
      taxAmount: 0,
      paymentMethod: "credit",
      paymentStatus: "unpaid",
      expenseCategory: "Food Ingredients",
      event_id: "",
    }
  });

  const { data: bookings = [] } = useQuery<Booking[]>({
    queryKey: ['bookings'],
    queryFn: getBookings,
    enabled: isOpen
  });

  useEffect(() => {
    if (purchase) {
      form.reset({
        ...purchase,
        date: new Date(purchase.date),
        quantity: Number(purchase.quantity),
        unitCost: Number(purchase.unitCost),
        taxAmount: Number(purchase.taxAmount),
        event_id: purchase.event_id || "",
        supplier_tin: purchase.supplier_tin || "",
        efd_receipt: purchase.efd_receipt || "",
      });
    } else {
      form.reset({
        date: new Date(),
        supplier: "",
        supplier_tin: "",
        invoiceNumber: "",
        efd_receipt: "",
        description: "",
        quantity: 1,
        unitCost: 0,
        taxAmount: 0,
        paymentMethod: "credit",
        paymentStatus: "unpaid",
        expenseCategory: "Food Ingredients",
        event_id: "",
      });
    }
  }, [purchase, form, isOpen]);
  
  const totalCost = (form.watch("quantity") || 0) * (form.watch("unitCost") || 0) + (form.watch("taxAmount") || 0);

  const handleSubmit = async (values: PurchaseFormData) => {
    const payload = {
        ...values,
        date: format(values.date, "yyyy-MM-dd"),
        totalCost,
    };
    
    if (purchase) {
        await updatePurchase(purchase.id, payload);
        toast({ title: "Success", description: "Purchase updated successfully." });
    } else {
        await addPurchase(payload);
        toast({ title: "Success", description: "Purchase added successfully." });
    }
    
    onSave();
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[600px]">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <DialogHeader>
              <DialogTitle>{purchase ? "Edit Purchase" : "Add New Purchase"}</DialogTitle>
              <DialogDescription>
                Fill in the details of the purchase record. Purchases must carry a valid Event ID to calculate per-event gross margins.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto px-2">
                <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                    <FormItem className="flex flex-col">
                        <FormLabel>Date of Purchase</FormLabel>
                        <Popover>
                        <PopoverTrigger asChild>
                            <FormControl>
                            <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                            </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                        </PopoverContent>
                        </Popover>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                
                <FormField control={form.control} name="event_id" render={({ field }) => (
                    <FormItem><FormLabel>Event ID Linkage (Mandatory)</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || undefined}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select linked Event Booking"/></SelectTrigger></FormControl>
                            <SelectContent>
                                {bookings.map(b => (
                                    <SelectItem key={b.id} value={b.id}>{b.id} - {b.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )} />

                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="supplier" render={({ field }) => (
                      <FormItem><FormLabel>Supplier</FormLabel><FormControl><Input placeholder="e.g., Mwenge Fresh Foods Ltd" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="supplier_tin" render={({ field }) => (
                      <FormItem><FormLabel>Supplier TIN (TRA 9-Digits)</FormLabel><FormControl><Input placeholder="e.g., 100234567" maxLength={9} {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="invoiceNumber" render={({ field }) => (
                      <FormItem><FormLabel>Supplier Invoice #</FormLabel><FormControl><Input placeholder="e.g., MFF-2026-7890" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="efd_receipt" render={({ field }) => (
                      <FormItem><FormLabel>TRA EFD Receipt Number</FormLabel><FormControl><Input placeholder="e.g., 1204899010" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                
                 <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem><FormLabel>Description</FormLabel><FormControl><Input placeholder="e.g., Perishables: 100kg Premium Beef Tenderloin" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                
                <div className="grid grid-cols-3 gap-4">
                     <FormField control={form.control} name="quantity" render={({ field }) => (
                        <FormItem><FormLabel>Quantity</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(Number(e.target.value))} /></FormControl><FormMessage /></FormItem>
                    )} />
                     <FormField control={form.control} name="unitCost" render={({ field }) => (
                        <FormItem><FormLabel>Unit Cost (TZS)</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(Number(e.target.value))} /></FormControl><FormMessage /></FormItem>
                    )} />
                     <FormField control={form.control} name="taxAmount" render={({ field }) => (
                        <FormItem><FormLabel>Tax Amount (TZS - 18%)</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(Number(e.target.value))} /></FormControl><FormMessage /></FormItem>
                    )} />
                </div>
                 <div className="text-right font-bold text-lg text-primary">Total Cost: {formatCurrency(totalCost)}</div>
                 <FormField control={form.control} name="expenseCategory" render={({ field }) => (
                    <FormItem><FormLabel>Expense Category</FormLabel><FormControl><Input placeholder="e.g., Food Ingredients" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="paymentMethod" render={({ field }) => (
                        <FormItem><FormLabel>Payment Method</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bank">Bank</SelectItem><SelectItem value="credit">Credit</SelectItem></SelectContent></Select><FormMessage/></FormItem>
                    )}/>
                    <FormField control={form.control} name="paymentStatus" render={({ field }) => (
                        <FormItem><FormLabel>Payment Status</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="paid">Paid</SelectItem><SelectItem value="unpaid">Unpaid</SelectItem></SelectContent></Select><FormMessage/></FormItem>
                    )}/>
                </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={form.formState.isSubmitting}>Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={form.formState.isSubmitting} className="bg-amber-600 hover:bg-amber-700 text-white">
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {purchase ? 'Save Changes' : 'Add Purchase'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function formatCurrency(amount: number) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS' }).format(amount).replace('TZS', 'TZS ');
}
