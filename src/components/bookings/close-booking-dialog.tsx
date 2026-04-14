
"use client";

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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, Loader2 } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { baseInvoiceSchema, type ProformaInvoiceFormData } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { Textarea } from "../ui/textarea";
import { useSettingsStorage } from "@/hooks/use-settings-storage";
import { useEffect } from "react";

interface CloseBookingDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onSubmit: (data: Partial<ProformaInvoiceFormData>) => Promise<void>;
}

const CloseBookingFormSchema = baseInvoiceSchema.pick({
    id: true,
    invoiceDate: true,
    lpoNumber: true,
    receiverName: true,
    receiverPosition: true,
    location: true,
    serviceDesc: true,
    serviceCharge: true,
    transportCosts: true,
    vatType: true,
});


export function CloseBookingDialog({ isOpen, setIsOpen, onSubmit }: CloseBookingDialogProps) {
  const form = useForm<Partial<ProformaInvoiceFormData>>({
    resolver: zodResolver(CloseBookingFormSchema),
    defaultValues: {
      id: `PI-${Date.now()}`,
      invoiceDate: new Date().toISOString(),
      lpoNumber: '',
      receiverName: '',
      receiverPosition: '',
      location: '',
      serviceDesc: '',
      serviceCharge: 0,
      transportCosts: 0,
      vatType: 'inclusive',
    },
  });

  const { settings, isLoading: settingsLoading } = useSettingsStorage();

  useEffect(() => {
      if (!settingsLoading && isOpen) {
          const currentId = form.getValues('id');
          if (currentId && currentId.startsWith('PI-17')) {
              form.setValue('id', settings.nextProformaNumber || '');
          }
      }
  }, [settingsLoading, settings.nextProformaNumber, isOpen, form]);

  const { isSubmitting } = form.formState;

  const handleSubmit = async (data: Partial<ProformaInvoiceFormData>) => {
    await onSubmit(data);
    form.reset();
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-2xl">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <DialogHeader>
              <DialogTitle>Generate Proforma Invoice</DialogTitle>
              <DialogDescription>
                Provide the final details to generate an aggregated proforma invoice for this booking.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto pr-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="id" render={({ field }) => (
                        <FormItem><FormLabel>Proforma Invoice Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                     <FormField control={form.control} name="invoiceDate" render={({ field }) => (
                        <FormItem className="flex flex-col"><FormLabel>Proforma Invoice Date</FormLabel>
                        <Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                            {field.value ? format(parseISO(field.value), "PPP") : <span>Pick a date</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button></FormControl></PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value ? parseISO(field.value) : undefined} onSelect={(date) => field.onChange(date?.toISOString())} /></PopoverContent>
                        </Popover><FormMessage />
                        </FormItem>
                    )} />
                     <FormField control={form.control} name="lpoNumber" render={({ field }) => (
                        <FormItem><FormLabel>LPO Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                </div>
                 <FormField control={form.control} name="serviceDesc" render={({ field }) => (
                    <FormItem><FormLabel>Service Description</FormLabel><FormControl><Textarea {...field} placeholder="e.g. Being costs for provision of daily lunch..."/></FormControl><FormMessage /></FormItem>
                )} />
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="receiverName" render={({ field }) => (
                        <FormItem><FormLabel>Receiver Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                     <FormField control={form.control} name="receiverPosition" render={({ field }) => (
                        <FormItem><FormLabel>Receiver Position</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     <FormField control={form.control} name="serviceCharge" render={({ field }) => (
                        <FormItem><FormLabel>Service Charge (TZS)</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="transportCosts" render={({ field }) => (
                        <FormItem><FormLabel>Transport Costs (TZS)</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="vatType" render={({ field }) => (
                        <FormItem><FormLabel>VAT Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent><SelectItem value="inclusive">Inclusive</SelectItem><SelectItem value="exclusive">Exclusive</SelectItem></SelectContent>
                        </Select><FormMessage /></FormItem>
                    )} />
                </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Generate Proforma
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
