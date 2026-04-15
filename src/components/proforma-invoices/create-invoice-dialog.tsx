
"use client";

import { useEffect, useState } from "react";
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
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Loader2 } from "lucide-react";
import { REGIONS, Region } from "@/types";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

import { Checkbox } from "@/components/ui/checkbox";

const CreateInvoiceSchema = z.object({
  invoiceId: z.string().min(1, "Invoice number is required."),
  invoiceDate: z.date({ required_error: "Invoice date is required." }),
  region: z.enum(REGIONS, { required_error: "Region is required." }),
  signedAtDate: z.date({ required_error: "Signing date is required." }),
  signedAtLocation: z.string().min(1, "Signing location is required."),
  appendProformaId: z.boolean().default(false),
  lpoNumber: z.string().optional().nullable(),
  receiverName: z.string().optional().nullable(),
  receiverPosition: z.string().optional().nullable(),
});

type CreateInvoiceFormData = z.infer<typeof CreateInvoiceSchema>;

interface CreateInvoiceDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onSubmit: (data: { 
    invoiceId: string, 
    invoiceDate: string, 
    region: Region,
    signedAtDate: string,
    signedAtLocation: string,
    appendProformaId: boolean,
    lpoNumber?: string | null,
    receiverName?: string | null,
    receiverPosition?: string | null
  }) => Promise<void>;
  isCreating: boolean;
  proformaId: string;
  initialLpoNumber?: string | null;
  initialReceiverName?: string | null;
  initialReceiverPosition?: string | null;
}

export function CreateInvoiceDialog({ 
  isOpen, 
  setIsOpen, 
  onSubmit, 
  isCreating, 
  proformaId,
  initialLpoNumber,
  initialReceiverName,
  initialReceiverPosition,
}: CreateInvoiceDialogProps) {
  const form = useForm<CreateInvoiceFormData>({
    resolver: zodResolver(CreateInvoiceSchema),
    defaultValues: {
      invoiceId: `INV-${proformaId.replace('PI-', '')}`,
      invoiceDate: new Date(),
      region: "Dar es Salaam",
      signedAtDate: new Date(),
      signedAtLocation: "Dar es Salaam",
      appendProformaId: true,
      lpoNumber: initialLpoNumber || '',
      receiverName: initialReceiverName || '',
      receiverPosition: initialReceiverPosition || '',
    },
  });

  useEffect(() => {
    if (isOpen) {
      form.reset({
        invoiceId: `INV-${proformaId.replace('PI-', '')}`,
        invoiceDate: new Date(),
        region: "Dar es Salaam",
        signedAtDate: new Date(),
        signedAtLocation: "Dar es Salaam",
        appendProformaId: true,
        lpoNumber: initialLpoNumber || '',
        receiverName: initialReceiverName || '',
        receiverPosition: initialReceiverPosition || '',
      });
    }
  }, [isOpen, proformaId, form, initialLpoNumber, initialReceiverName, initialReceiverPosition]);

  const handleSubmit = (values: CreateInvoiceFormData) => {
    onSubmit({
        ...values,
        invoiceDate: format(values.invoiceDate, 'yyyy-MM-dd'),
        signedAtDate: values.signedAtDate.toISOString(),
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <DialogHeader>
              <DialogTitle>Create Final Invoice</DialogTitle>
              <DialogDescription>
                Please confirm the details for the final invoice.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <FormField
                control={form.control}
                name="invoiceId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Final Invoice Number</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., INV-2024-001" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="invoiceDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Invoice Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
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
              <FormField
                control={form.control}
                name="region"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Region</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "Dar es Salaam"}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a region" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {REGIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="signedAtDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Signed Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button variant={"outline"} className={cn("pl-3 text-left font-normal h-10", !field.value && "text-muted-foreground")}>
                              {field.value ? format(field.value, "PPP") : <span>Date</span>}
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

                <FormField
                  control={form.control}
                  name="signedAtLocation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Signed At (Location)</FormLabel>
                      <FormControl>
                        <Input {...field} className="h-10" placeholder="e.g. Dar es Salaam" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <FormField
                    control={form.control}
                    name="lpoNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>LPO Number</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ''} placeholder="e.g. LPO-123" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="receiverName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Receiver Name</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ''} placeholder="e.g. John Doe" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="receiverPosition"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Receiver Position</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ''} placeholder="e.g. Manager" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
              </div>

              <FormField
                control={form.control}
                name="appendProformaId"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4 bg-muted/20">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="text-sm font-semibold text-primary">
                        Link to Proforma Invoice
                      </FormLabel>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">
                        Append "as per Proforma Invoice No. {proformaId}" to description
                      </p>
                    </div>
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={isCreating}>
                Cancel
              </Button>
              <Button type="submit" disabled={isCreating}>
                {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm & Create
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
