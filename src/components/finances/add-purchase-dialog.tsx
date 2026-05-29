'use client';

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { CalendarIcon, Loader2, PackagePlus, Plus, Trash2, AlertTriangle, CheckCircle2, ChevronsUpDown, CreditCard, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useEffect, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { addPurchase, updatePurchase } from "@/services/purchaseService";
import { getSuppliers } from "@/services/supplierService";
import { addStockLog } from "@/services/stockLogService";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { Purchase, Supplier } from "@/types";

const PurchaseSchema = z.object({
  date: z.date({ required_error: "A date is required." }),
  supplier: z.string().min(1, "Supplier name is required."),
  supplier_tin: z.string().max(9).optional().default(''),
  invoiceNumber: z.string().min(1, "Invoice / Receipt number is required."),
  efd_receipt: z.string().optional().default(''),
  description: z.string().min(1, "Description is required."),
  quantity: z.number().min(0.01, "Quantity must be greater than 0."),
  unitCost: z.number().min(0, "Unit cost cannot be negative."),
  taxAmount: z.number().min(0).default(0),
  amountPaid: z.number().min(0).default(0),
  paymentMethod: z.enum(['cash', 'bank', 'credit']),
  expenseCategory: z.string().optional().default('General'),
});

type PurchaseFormData = z.infer<typeof PurchaseSchema>;

interface StockItem {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  branch: 'Dar es Salaam' | 'Arusha' | 'Dodoma';
}

function newStockItem(overrides?: Partial<StockItem>): StockItem {
  return { id: crypto.randomUUID(), productName: '', quantity: 1, unitPrice: 0, branch: 'Dar es Salaam', ...overrides };
}

interface AddPurchaseDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onSave: () => void;
  purchase: Purchase | null;
}

export function AddPurchaseDialog({ isOpen, setIsOpen, onSave, purchase }: AddPurchaseDialogProps) {
  const { toast } = useToast();
  const [recordStockIn, setRecordStockIn] = useState(false);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [supplierPopoverOpen, setSupplierPopoverOpen] = useState(false);

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ['suppliers'],
    queryFn: getSuppliers,
    staleTime: 5 * 60 * 1000,
  });

  const form = useForm<PurchaseFormData>({
    resolver: zodResolver(PurchaseSchema),
    defaultValues: {
      supplier: "", supplier_tin: "", invoiceNumber: "", efd_receipt: "",
      description: "", quantity: 1, unitCost: 0, taxAmount: 0, amountPaid: 0,
      paymentMethod: "credit", expenseCategory: "Food Ingredients",
    }
  });

  const quantity = form.watch("quantity") || 0;
  const unitCost = form.watch("unitCost") || 0;
  const taxAmount = form.watch("taxAmount") || 0;
  const amountPaid = form.watch("amountPaid") || 0;
  const paymentMethod = form.watch("paymentMethod");
  const totalCost = quantity * unitCost + taxAmount;
  const creditBalance = Math.max(0, totalCost - amountPaid);

  const computedStatus: Purchase['paymentStatus'] =
    amountPaid >= totalCost && totalCost > 0 ? 'paid'
    : amountPaid > 0 ? 'partial'
    : 'unpaid';

  // Auto-set amountPaid when paymentMethod changes
  useEffect(() => {
    if (paymentMethod === 'cash' || paymentMethod === 'bank') {
      form.setValue('amountPaid', totalCost);
    } else if (paymentMethod === 'credit') {
      form.setValue('amountPaid', 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentMethod]);

  // When totalCost changes and payment is cash/bank, keep amountPaid in sync
  useEffect(() => {
    if (paymentMethod === 'cash' || paymentMethod === 'bank') {
      form.setValue('amountPaid', totalCost);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalCost]);

  useEffect(() => {
    if (purchase) {
      form.reset({
        date: new Date(purchase.date),
        supplier: purchase.supplier,
        supplier_tin: purchase.supplier_tin || "",
        invoiceNumber: purchase.invoiceNumber,
        efd_receipt: purchase.efd_receipt || "",
        description: purchase.description,
        quantity: Number(purchase.quantity),
        unitCost: Number(purchase.unitCost),
        taxAmount: Number(purchase.taxAmount),
        amountPaid: Number(purchase.amountPaid ?? purchase.totalCost),
        paymentMethod: purchase.paymentMethod,
        expenseCategory: purchase.expenseCategory || "Food Ingredients",
      });
      setSelectedSupplierId(purchase.supplierId || '');
    } else {
      form.reset({
        date: new Date(), supplier: "", supplier_tin: "", invoiceNumber: "", efd_receipt: "",
        description: "", quantity: 1, unitCost: 0, taxAmount: 0, amountPaid: 0,
        paymentMethod: "credit", expenseCategory: "Food Ingredients",
      });
      setSelectedSupplierId('');
    }
    if (!isOpen) { setRecordStockIn(false); setStockItems([]); }
  }, [purchase, form, isOpen]);

  const handleSelectSupplier = (s: Supplier) => {
    form.setValue('supplier', s.name, { shouldValidate: true });
    if (s.tin) form.setValue('supplier_tin', s.tin);
    setSelectedSupplierId(s.id);
    setSupplierPopoverOpen(false);
  };

  const handleStockToggle = useCallback((enabled: boolean) => {
    setRecordStockIn(enabled);
    if (enabled && stockItems.length === 0) {
      const desc = form.getValues("description");
      const qty = form.getValues("quantity") || 1;
      const uc = form.getValues("unitCost") || 0;
      setStockItems([newStockItem({ productName: desc, quantity: qty, unitPrice: uc })]);
    }
  }, [stockItems.length, form]);

  const addItem = () => setStockItems(prev => [...prev, newStockItem()]);
  const removeItem = (id: string) => setStockItems(prev => prev.filter(i => i.id !== id));
  const updateItem = (id: string, field: keyof StockItem, value: string | number) =>
    setStockItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));

  const stockItemsTotal = stockItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const stockDiff = totalCost - stockItemsTotal;
  const totalsMatch = Math.abs(stockDiff) < 1;

  const handleSubmit = async (values: PurchaseFormData) => {
    const dateStr = format(values.date, "yyyy-MM-dd");
    const payload = {
      ...values,
      date: dateStr,
      totalCost,
      amountPaid: values.amountPaid,
      paymentStatus: computedStatus,
      supplierId: selectedSupplierId,
      supplier_tin: values.supplier_tin || '',
      efd_receipt: values.efd_receipt || '',
      expenseCategory: values.expenseCategory || 'General',
    };

    if (purchase) {
      await updatePurchase(purchase.id, payload);
      toast({ title: "Success", description: "Purchase updated successfully." });
    } else {
      await addPurchase(payload);

      if (recordStockIn && stockItems.length > 0) {
        await Promise.all(
          stockItems.map(item =>
            addStockLog({
              productId: crypto.randomUUID(),
              productName: item.productName || values.description,
              type: 'Stock In',
              quantity: item.quantity,
              price: item.quantity * item.unitPrice,
              actual_unit_price: item.unitPrice,
              reason: `Purchased from ${values.supplier} — Invoice ${values.invoiceNumber}`,
              date: dateStr, status: 'Verified', branch: item.branch,
            })
          )
        );
        toast({ title: "Stock In Recorded", description: `${stockItems.length} item(s) added to inventory.` });
      } else {
        toast({ title: "Success", description: "Purchase added successfully." });
      }
    }
    onSave();
  };

  const statusColors: Record<Purchase['paymentStatus'], string> = {
    paid: 'bg-emerald-600',
    partial: 'bg-amber-500',
    unpaid: 'bg-red-500',
  };

  const supplierName = form.watch('supplier');

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[660px]">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <DialogHeader>
              <DialogTitle>{purchase ? "Edit Purchase" : "Add New Purchase"}</DialogTitle>
              <DialogDescription>
                Record a supplier invoice or receipt. All amounts in Tanzanian Shillings (TZS).
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4 max-h-[72vh] overflow-y-auto px-2">

              {/* Date */}
              <FormField control={form.control} name="date" render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Date of Purchase</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
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
              )} />

              {/* Supplier combobox */}
              <FormField control={form.control} name="supplier" render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Supplier / Vendor</FormLabel>
                  <Popover open={supplierPopoverOpen} onOpenChange={setSupplierPopoverOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          className={cn("w-full justify-between font-normal", !field.value && "text-muted-foreground")}
                        >
                          <span className="flex items-center gap-2 truncate">
                            {field.value || "Search or type supplier name..."}
                            {selectedSupplierId && (
                              <Badge variant="secondary" className="text-[10px] h-4 px-1">linked</Badge>
                            )}
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0" align="start">
                      <Command>
                        <CommandInput
                          placeholder="Search suppliers or type new name..."
                          value={field.value}
                          onValueChange={(v) => {
                            field.onChange(v);
                            setSelectedSupplierId('');
                          }}
                        />
                        <CommandList>
                          <CommandEmpty className="py-3 px-4 text-sm text-muted-foreground">
                            <span>No saved supplier found.</span>
                            {field.value && (
                              <div className="mt-2 flex items-center gap-2 text-foreground">
                                <UserPlus className="h-3.5 w-3.5" />
                                <span>Using <strong>"{field.value}"</strong> as a new supplier</span>
                              </div>
                            )}
                          </CommandEmpty>
                          {suppliers.length > 0 && (
                            <CommandGroup heading="Your Supplier Database">
                              {suppliers.map(s => (
                                <CommandItem
                                  key={s.id}
                                  value={s.name}
                                  onSelect={() => handleSelectSupplier(s)}
                                  className="flex items-center justify-between"
                                >
                                  <span>{s.name}</span>
                                  {s.tin && <span className="text-xs text-muted-foreground">TIN: {s.tin}</span>}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          )}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )} />

              {/* TIN + Invoice + EFD */}
              <div className="grid grid-cols-3 gap-4">
                <FormField control={form.control} name="supplier_tin" render={({ field }) => (
                  <FormItem><FormLabel>Supplier TIN <span className="text-muted-foreground font-normal text-xs">(opt)</span></FormLabel><FormControl><Input placeholder="9-digit TIN" maxLength={9} {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="invoiceNumber" render={({ field }) => (
                  <FormItem><FormLabel>Invoice / Receipt #</FormLabel><FormControl><Input placeholder="e.g., MFF-7890" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="efd_receipt" render={({ field }) => (
                  <FormItem><FormLabel>EFD Receipt # <span className="text-muted-foreground font-normal text-xs">(opt)</span></FormLabel><FormControl><Input placeholder="TRA EFD" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              {/* Description */}
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem><FormLabel>Description of Goods / Services</FormLabel><FormControl><Input placeholder="e.g., 100kg Premium Beef Tenderloin" {...field} /></FormControl><FormMessage /></FormItem>
              )} />

              {/* Qty + Unit + Tax */}
              <div className="grid grid-cols-3 gap-4">
                <FormField control={form.control} name="quantity" render={({ field }) => (
                  <FormItem><FormLabel>Quantity</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(Number(e.target.value))} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="unitCost" render={({ field }) => (
                  <FormItem><FormLabel>Unit Cost (TZS)</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(Number(e.target.value))} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="taxAmount" render={({ field }) => (
                  <FormItem><FormLabel>Input VAT (TZS)</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(Number(e.target.value))} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              {/* Purchase total summary */}
              <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Purchase Total</span>
                <span className="font-bold text-lg text-foreground">{formatCurrency(totalCost)}</span>
              </div>

              {/* Category */}
              <FormField control={form.control} name="expenseCategory" render={({ field }) => (
                <FormItem><FormLabel>Category <span className="text-muted-foreground font-normal text-xs">(opt)</span></FormLabel><FormControl><Input placeholder="e.g., Food Ingredients, Consumables, Equipment" {...field} /></FormControl><FormMessage /></FormItem>
              )} />

              {/* ─── Payment section ─── */}
              <div className="rounded-lg border bg-card p-4 space-y-3">
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <CreditCard className="h-4 w-4 text-primary" />
                  Payment
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="paymentMethod" render={({ field }) => (
                    <FormItem><FormLabel>Payment Method</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="bank">Bank Transfer</SelectItem>
                          <SelectItem value="credit">Credit / Invoice</SelectItem>
                        </SelectContent>
                      </Select><FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="amountPaid" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount Paid (TZS)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          max={totalCost}
                          {...field}
                          onChange={e => field.onChange(Math.min(Number(e.target.value), totalCost))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                {/* Status + credit balance */}
                <div className={cn(
                  "rounded-md border px-3 py-2.5 text-sm space-y-1.5",
                  computedStatus === 'paid' ? "border-emerald-400/40 bg-emerald-50/10"
                    : computedStatus === 'partial' ? "border-amber-400/40 bg-amber-50/10"
                    : "border-red-400/40 bg-red-50/10"
                )}>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Payment Status</span>
                    <Badge className={cn("text-white capitalize", statusColors[computedStatus])}>
                      {computedStatus}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Amount Paid</span>
                    <span className="font-semibold text-emerald-600">{formatCurrency(amountPaid)}</span>
                  </div>
                  {creditBalance > 0 && (
                    <div className="flex items-center justify-between border-t pt-1.5 mt-1">
                      <span className="font-semibold">Credit Balance → Accounts Payable</span>
                      <span className="font-bold text-amber-600">{formatCurrency(creditBalance)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* ─── Stock-In Section ─── */}
              {!purchase && (
                <div className="rounded-lg border border-dashed border-amber-400/50 bg-amber-50/5 p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <PackagePlus className="h-4 w-4 text-amber-600" />
                      <Label htmlFor="stock-in-toggle" className="font-semibold text-sm cursor-pointer">
                        Record received goods into stock
                      </Label>
                    </div>
                    <Switch id="stock-in-toggle" checked={recordStockIn} onCheckedChange={handleStockToggle} />
                  </div>

                  {recordStockIn && (
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground">
                        Break down the purchased items. The stock total must equal the purchase total above.
                      </p>
                      <div className="grid grid-cols-[1fr_80px_90px_80px_28px] gap-1.5 text-xs font-semibold text-muted-foreground px-1">
                        <span>Product Name</span><span>Qty</span><span>Unit Price</span><span>Line Total</span><span />
                      </div>
                      {stockItems.map((item) => (
                        <div key={item.id} className="grid grid-cols-[1fr_80px_90px_80px_28px] gap-1.5 items-center">
                          <Input placeholder="Product name" value={item.productName} onChange={e => updateItem(item.id, 'productName', e.target.value)} className="h-8 text-sm" />
                          <Input type="number" value={item.quantity} onChange={e => updateItem(item.id, 'quantity', Number(e.target.value))} className="h-8 text-sm" />
                          <Input type="number" value={item.unitPrice} onChange={e => updateItem(item.id, 'unitPrice', Number(e.target.value))} className="h-8 text-sm" />
                          <span className="text-sm font-medium text-right tabular-nums">
                            {(item.quantity * item.unitPrice).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                          </span>
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeItem(item.id)} disabled={stockItems.length === 1}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                      {stockItems.length > 0 && (
                        <div className="flex items-center gap-2 pt-1">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">Receiving Branch:</span>
                          <Select value={stockItems[0].branch} onValueChange={val => setStockItems(prev => prev.map(i => ({ ...i, branch: val as StockItem['branch'] })))}>
                            <SelectTrigger className="h-8 w-[160px] text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Dar es Salaam">Dar es Salaam</SelectItem>
                              <SelectItem value="Arusha">Arusha</SelectItem>
                              <SelectItem value="Dodoma">Dodoma</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      <Button type="button" variant="outline" size="sm" className="w-full h-8 text-xs" onClick={addItem}>
                        <Plus className="h-3.5 w-3.5 mr-1" /> Add Another Product
                      </Button>
                      <div className={cn("rounded-md border p-3 text-sm space-y-1", totalsMatch ? "border-emerald-400/50 bg-emerald-50/10" : "border-amber-400/50 bg-amber-50/10")}>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Stock Items Total</span>
                          <span className="font-semibold tabular-nums">{formatCurrency(stockItemsTotal)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Purchase Total</span>
                          <span className="font-semibold tabular-nums">{formatCurrency(totalCost)}</span>
                        </div>
                        <div className="flex justify-between items-center border-t pt-1 mt-1">
                          <span className="font-semibold">Difference</span>
                          <div className="flex items-center gap-1.5">
                            {totalsMatch ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-amber-500" />}
                            <span className={cn("font-bold tabular-nums", totalsMatch ? "text-emerald-600" : "text-amber-600")}>
                              {stockDiff > 0 ? `−${formatCurrency(stockDiff)} unallocated` : stockDiff < 0 ? `+${formatCurrency(Math.abs(stockDiff))} over` : 'Balanced ✓'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
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
