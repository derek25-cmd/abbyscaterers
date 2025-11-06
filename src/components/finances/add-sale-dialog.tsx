
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
import { addSale, updateSale } from "@/services/saleService";
import { useToast } from "@/hooks/use-toast";
import type { Sale, Client } from "@/types";

const SaleSchema = z.object({
  date: z.date({ required_error: "A date is required." }),
  customerId: z.string().min(1, "Customer is required."),
  invoiceNumber: z.string().min(1, "Invoice number is required."),
  description: z.string().min(1, "Description is required."),
  quantity: z.number().min(0.01, "Quantity must be greater than 0."),
  unitPrice: z.number().min(0, "Unit price cannot be negative."),
  taxAmount: z.number().min(0, "Tax amount cannot be negative."),
  paymentMethod: z.enum(['cash', 'bank', 'credit']),
  paymentStatus: z.enum(['paid', 'unpaid']),
});

type SaleFormData = z.infer<typeof SaleSchema>;

interface AddSaleDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onSave: () => void;
  sale: Sale | null;
  clients: Client[];
}

export function AddSaleDialog({ isOpen, setIsOpen, onSave, sale, clients }: AddSaleDialogProps) {
  const { toast } = useToast();
  const form = useForm<SaleFormData>({
    resolver: zodResolver(SaleSchema),
  });

  useEffect(() => {
    if (sale) {
      form.reset({
        ...sale,
        date: new Date(sale.date),
        quantity: Number(sale.quantity),
        unitPrice: Number(sale.unitPrice),
        taxAmount: Number(sale.taxAmount),
      });
    } else {
      form.reset({
        date: new Date(),
        customerId: "",
        invoiceNumber: "",
        description: "",
        quantity: 1,
        unitPrice: 0,
        taxAmount: 0,
        paymentMethod: "credit",
        paymentStatus: "unpaid",
      });
    }
  }, [sale, form, isOpen]);
  
  const totalAmount = (form.watch("quantity") || 0) * (form.watch("unitPrice") || 0) + (form.watch("taxAmount") || 0);

  const handleSubmit = async (values: SaleFormData) => {
    const payload = {
        ...values,
        date: format(values.date, "yyyy-MM-dd"),
        totalAmount,
    };
    
    if (sale) {
        await updateSale(sale.id, payload);
        toast({ title: "Success", description: "Sale updated successfully." });
    } else {
        await addSale(payload);
        toast({ title: "Success", description: "Sale added successfully." });
    }
    
    onSave();
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[600px]">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <DialogHeader>
              <DialogTitle>{sale ? "Edit Sale" : "Add New Sale"}</DialogTitle>
              <DialogDescription>
                Fill in the details of the sale record.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto px-2">
                <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                    <FormItem className="flex flex-col">
                        <FormLabel>Date of Sale</FormLabel>
                        <Popover>
                        <PopoverTrigger asChild>
                            <FormControl>
                            <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal",!field.value && "text-muted-foreground")}>
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
                <FormField control={form.control} name="customerId" render={({ field }) => (
                    <FormItem><FormLabel>Customer</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select a customer"/></SelectTrigger></FormControl>
                            <SelectContent>
                                {clients.map(client => (
                                    <SelectItem key={client.id} value={client.id}>{client.companyName}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    <FormMessage /></FormItem>
                )} />
                 <FormField control={form.control} name="invoiceNumber" render={({ field }) => (
                    <FormItem><FormLabel>Invoice Number</FormLabel><FormControl><Input placeholder="Invoice #" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                 <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem><FormLabel>Description</FormLabel><FormControl><Input placeholder="e.g., Catering for event" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-3 gap-4">
                     <FormField control={form.control} name="quantity" render={({ field }) => (
                        <FormItem><FormLabel>Quantity</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(Number(e.target.value))} /></FormControl><FormMessage /></FormItem>
                    )} />
                     <FormField control={form.control} name="unitPrice" render={({ field }) => (
                        <FormItem><FormLabel>Unit Price (TZS)</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(Number(e.target.value))} /></FormControl><FormMessage /></FormItem>
                    )} />
                     <FormField control={form.control} name="taxAmount" render={({ field }) => (
                        <FormItem><FormLabel>Tax Amount (TZS)</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(Number(e.target.value))} /></FormControl><FormMessage /></FormItem>
                    )} />
                </div>
                 <div className="text-right font-bold">Total Amount: {formatCurrency(totalAmount)}</div>
                <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="paymentMethod" render={({ field }) => (
                        <FormItem><FormLabel>Payment Method</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="bank">Bank</SelectItem><SelectItem value="credit">Credit</SelectItem></SelectContent></Select><FormMessage/></FormItem>
                    )}/>
                    <FormField control={form.control} name="paymentStatus" render={({ field }) => (
                        <FormItem><FormLabel>Payment Status</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="paid">Paid</SelectItem><SelectItem value="unpaid">Unpaid</SelectItem></SelectContent></Select><FormMessage/></FormItem>
                    )}/>
                </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={form.formState.isSubmitting}>Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {sale ? 'Save Changes' : 'Add Sale'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function formatCurrency(amount: number) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS' }).format(amount);
}
