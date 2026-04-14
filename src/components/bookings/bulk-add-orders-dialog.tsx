
"use client";

import { useEffect, useState, useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
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
import { Loader2, Calendar as CalendarIcon, Users, Trash2, ListChecks, Info } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { z } from "zod";
import { MEAL_TYPES } from "@/types";
import { format, parseISO, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const OrderEntrySchema = z.object({
  date: z.date(),
  pax: z.number().min(1, "Min 1"),
  unitPrice: z.number().min(0, "Min 0"),
  mealType: z.string().min(1, "Required"),
});

const BulkAddSchema = z.object({
  entries: z.array(OrderEntrySchema).min(1, "Please select at least one date."),
  vatType: z.enum(['inclusive', 'exclusive']),
});

export type BulkAddFormData = z.infer<typeof BulkAddSchema>;

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
  
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  
  const form = useForm<BulkAddFormData>({
    resolver: zodResolver(BulkAddSchema),
    defaultValues: {
      entries: [],
      vatType: "inclusive",
    },
  });

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: "entries"
  });

  const { isSubmitting } = form.formState;

  // Global settings for quick application
  const [globalPax, setGlobalPax] = useState(1);
  const [globalPrice, setGlobalPrice] = useState(0);
  const [globalMealType, setGlobalMealType] = useState("Lunch only");

  const fromDate = parseISO(bookingStartDate);
  const toDate = parseISO(bookingEndDate);

  useEffect(() => {
    if (isOpen) {
      form.reset({
        entries: [],
        vatType: "inclusive",
      });
      setSelectedDates([]);
    }
  }, [isOpen, form]);

  const handleDateSelect = (dates: Date[] | undefined) => {
    const newDates = dates || [];
    setSelectedDates(newDates);
    
    // Synchronize entries with selected dates
    const currentEntries = form.getValues('entries');
    const updatedEntries = newDates.map(date => {
        const existing = currentEntries.find(e => isSameDay(e.date, date));
        if (existing) return existing;
        return {
            date,
            pax: globalPax,
            unitPrice: globalPrice,
            mealType: globalMealType
        };
    }).sort((a,b) => a.date.getTime() - b.date.getTime());
    
    replace(updatedEntries);
  };

  const applyGlobals = () => {
    const currentEntries = form.getValues('entries');
    const updated = currentEntries.map(e => ({
        ...e,
        pax: globalPax,
        unitPrice: globalPrice,
        mealType: globalMealType
    }));
    replace(updated);
  };

  const handleSubmit = async (data: BulkAddFormData) => {
    await onSubmit(data);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="text-2xl font-black uppercase tracking-tight flex items-center gap-2">
             <ListChecks className="h-6 w-6 text-primary" />
             Bulk Daily Order Entry
          </DialogTitle>
          <DialogDescription>
            Select dates and customize PAX/Meal Types for each daily order in this booking contract.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 pt-2 space-y-6">
              
              <div className="grid md:grid-cols-[1fr_2fr] gap-8">
                {/* Left Side: Calendar and Global Settings */}
                <div className="space-y-6">
                    <Card className="border-2 border-dashed bg-muted/30">
                        <CardHeader className="py-3 px-4">
                            <CardTitle className="text-xs uppercase font-black tracking-widest text-muted-foreground flex items-center gap-2">
                                <CalendarIcon className="h-3 w-3" /> Step 1: Select Dates
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-2 flex justify-center bg-background rounded-b-xl border-t-2 border-dashed">
                             <Calendar
                                mode="multiple"
                                selected={selectedDates}
                                onSelect={handleDateSelect}
                                disabled={(date) => date < fromDate || date > toDate}
                                className="rounded-md"
                            />
                        </CardContent>
                    </Card>

                    <div className="space-y-4 p-4 rounded-xl border-2 bg-primary/5 border-primary/10">
                        <h4 className="text-[10px] uppercase font-black tracking-widest text-primary flex items-center gap-2">
                            <Users className="h-3 w-3" /> Quick Template
                        </h4>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase">Pax</label>
                                <Input type="number" value={globalPax} onChange={e => setGlobalPax(parseInt(e.target.value) || 0)} className="h-9 font-bold" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase">Price</label>
                                <Input type="number" value={globalPrice} onChange={e => setGlobalPrice(parseFloat(e.target.value) || 0)} className="h-9 font-bold" />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase">Meal Type</label>
                            <Select value={globalMealType} onValueChange={setGlobalMealType}>
                                <SelectTrigger className="h-9 font-bold"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {MEAL_TYPES.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button type="button" variant="secondary" size="sm" className="w-full font-black italic tracking-widest text-[10px]" onClick={applyGlobals}>
                            APPLY TO ALL ROWS
                        </Button>
                    </div>

                    <FormField
                        control={form.control}
                        name="vatType"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-[10px] font-black uppercase tracking-widest opacity-70">VAT Configuration</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger className="h-10 border-2 font-bold"><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value="inclusive">VAT Inclusive</SelectItem>
                                        <SelectItem value="exclusive">VAT Exclusive (18%)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </FormItem>
                        )}
                    />
                </div>

                {/* Right Side: Editable Table */}
                <div className="space-y-4">
                     <div className="flex items-center justify-between">
                         <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Step 2: Review & Customize ({fields.length} orders)</h3>
                         {fields.length > 0 && (
                             <Badge variant="secondary" className="font-bold text-primary italic">
                                Total: {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS' }).format(fields.reduce((sum, f) => sum + (f.pax * f.unitPrice), 0))}
                             </Badge>
                         )}
                     </div>
                     <Separator />
                     
                     <div className="border rounded-xl overflow-hidden bg-card shadow-sm border-2">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="w-[120px] text-[10px] font-black uppercase">Date</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase">Meal Type</TableHead>
                                    <TableHead className="w-[80px] text-[10px] font-black uppercase">Pax</TableHead>
                                    <TableHead className="w-[120px] text-[10px] font-black uppercase">Unit Price</TableHead>
                                    <TableHead className="w-[120px] text-right text-[10px] font-black uppercase">Subtotal</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {fields.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-64 text-center">
                                            <div className="flex flex-col items-center justify-center text-muted-foreground">
                                                <CalendarIcon className="h-12 w-12 mb-2 opacity-20" />
                                                <p className="font-bold italic">No dates selected on the calendar</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    fields.map((field, index) => (
                                        <TableRow key={field.id} className="group hover:bg-primary/5 transition-colors">
                                            <TableCell className="font-bold text-xs py-3">
                                                {format(field.date, "eee, MMM dd")}
                                            </TableCell>
                                            <TableCell>
                                                <Select 
                                                    value={form.watch(`entries.${index}.mealType`)} 
                                                    onValueChange={(val) => form.setValue(`entries.${index}.mealType`, val)}
                                                >
                                                    <SelectTrigger className="h-8 border-dashed bg-transparent border-0 hover:bg-muted font-medium py-0 px-2 shadow-none"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        {MEAL_TYPES.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                            <TableCell>
                                                <Input 
                                                    type="number" 
                                                    {...form.register(`entries.${index}.pax`, { valueAsNumber: true })} 
                                                    className="h-8 border-dashed bg-transparent hover:bg-muted py-0 px-2 text-center font-bold"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Input 
                                                    type="number" 
                                                    {...form.register(`entries.${index}.unitPrice`, { valueAsNumber: true })} 
                                                    className="h-8 border-dashed bg-transparent hover:bg-muted py-0 px-2 font-bold"
                                                />
                                            </TableCell>
                                            <TableCell className="text-right font-black italic text-primary text-xs">
                                                {new Intl.NumberFormat('en-US', { minimumFractionDigits: 0 }).format(form.watch(`entries.${index}.pax`) * form.watch(`entries.${index}.unitPrice`))}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                     </div>
                     {fields.length > 0 && (
                         <div className="flex items-center gap-2 p-3 bg-blue-50/50 border border-blue-100 rounded-lg">
                             <Info className="h-4 w-4 text-blue-500" />
                             <p className="text-[10px] text-blue-700 leading-tight">
                                 Tip: You can edit individual rows if some days have different prices or attendee counts.
                             </p>
                         </div>
                     )}
                </div>
              </div>
            </div>

            <DialogFooter className="p-6 border-t bg-muted/20">
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={isSubmitting} className="font-bold">Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={isSubmitting || fields.length === 0} className="min-w-[180px] font-black italic tracking-widest border-2">
                {isSubmitting ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> CREATING ORDERS...</>
                ) : (
                    <>CREATE {fields.length} DAILY ORDERS</>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
