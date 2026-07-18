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
import {
  CalendarIcon, Loader2, Plus, Trash2, AlertTriangle, CheckCircle2,
  ChevronsUpDown, CreditCard, UserPlus, Package, Wrench, ShoppingBag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addPurchase, updatePurchase } from "@/services/purchaseService";
import { getSuppliers } from "@/services/supplierService";
import { getProducts, updateProduct } from "@/services/productService";
import { getAssets, addAsset, updateAsset } from "@/services/assetService";
import { addStockLog } from "@/services/stockLogService";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { BRANCH_KEYS } from "@/types";
import type { Purchase, Supplier, Product, Asset } from "@/types";

// ─── Types ───────────────────────────────────────────────────────────────────

type PurchaseType = 'general' | 'stock_in' | 'fixed_asset';
type BranchType = 'Dar es Salaam' | 'Arusha' | 'Dodoma';

interface StockItem {
  id: string;
  productId?: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  branch: BranchType;
}

interface AssetItem {
  id: string;
  assetId?: string;
  assetName: string;
  assetType: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  branch: BranchType;
}

// ─── Schema ──────────────────────────────────────────────────────────────────

const PurchaseSchema = z.object({
  date: z.date({ required_error: "A date is required." }),
  supplier: z.string().min(1, "Supplier name is required."),
  supplier_tin: z.string().max(9).optional().default(''),
  invoiceNumber: z.string().min(1, "Invoice / Receipt number is required."),
  efd_receipt: z.string().optional().default(''),
  description: z.string().optional().default(''),
  quantity: z.number().min(0).default(1),
  unitCost: z.number().min(0).default(0),
  taxAmount: z.number().min(0).default(0),
  amountPaid: z.number().min(0).default(0),
  paymentMethod: z.enum(['cash', 'bank', 'credit']),
  expenseCategory: z.string().optional().default('General'),
});

type PurchaseFormData = z.infer<typeof PurchaseSchema>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function newStockItem(overrides?: Partial<StockItem>): StockItem {
  return { id: crypto.randomUUID(), productId: undefined, productName: '', quantity: 1, unitPrice: 0, branch: 'Dar es Salaam', ...overrides };
}

function newAssetItem(overrides?: Partial<AssetItem>): AssetItem {
  return { id: crypto.randomUUID(), assetId: undefined, assetName: '', assetType: 'Equipment', unit: 'item', quantity: 1, unitPrice: 0, branch: 'Dar es Salaam', ...overrides };
}

function getBranchPrice(p: Product, branch: BranchType): number {
  if (branch === 'Dar es Salaam') return p.unitPrice_dar ?? p.unitPrice;
  if (branch === 'Arusha') return p.unitPrice_arusha ?? p.unitPrice;
  return p.unitPrice_dodoma ?? p.unitPrice;
}

function getBranchQty(p: Product, branch: BranchType): number {
  if (branch === 'Dar es Salaam') return p.quantity_dar ?? p.quantity;
  if (branch === 'Arusha') return p.quantity_arusha ?? p.quantity;
  return p.quantity_dodoma ?? p.quantity;
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS' }).format(n).replace('TZS', 'TZS ');
}

// ─── Picker sub-components ───────────────────────────────────────────────────
// Search state lives locally here so it's fresh on every popover open (PopoverContent
// unmounts on close, which resets useState automatically — no shared-state race conditions).

function StockPickerContent({ products, branch, onSelect }: {
  products: Product[];
  branch: BranchType;
  onSelect: (product: Product) => void;
}) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.category || '').toLowerCase().includes(q)
    );
  }, [search, products]);

  return (
    <Command shouldFilter={false}>
      <CommandInput placeholder="Search products..." value={search} onValueChange={setSearch} autoFocus />
      <CommandList>
        <CommandEmpty className="py-3 px-4 text-sm text-muted-foreground">
          No product found. Type a name and use the field below.
        </CommandEmpty>
        <CommandGroup heading="Product Catalog">
          {filtered.map(p => (
            <CommandItem key={p.id} value={p.id} onSelect={() => onSelect(p)} className="flex flex-col items-start gap-0.5">
              <div className="flex w-full justify-between">
                <span className="font-medium">{p.name}</span>
                <span className="text-xs text-muted-foreground">{p.unit}</span>
              </div>
              <div className="flex w-full justify-between text-xs text-muted-foreground">
                <span>{p.category}</span>
                <span>{formatCurrency(getBranchPrice(p, branch))}/{p.unit}</span>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}

function AssetPickerContent({ assets, onSelect }: {
  assets: Asset[];
  onSelect: (asset: Asset) => void;
}) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    if (!search.trim()) return assets;
    const q = search.toLowerCase();
    return assets.filter(a =>
      a.name.toLowerCase().includes(q) ||
      (a.type || '').toLowerCase().includes(q) ||
      (a.branch || '').toLowerCase().includes(q)
    );
  }, [search, assets]);

  return (
    <Command shouldFilter={false}>
      <CommandInput placeholder="Search assets..." value={search} onValueChange={setSearch} autoFocus />
      <CommandList>
        <CommandEmpty className="py-3 px-4 text-sm text-muted-foreground">
          No existing asset found — use the field below to add a new one.
        </CommandEmpty>
        <CommandGroup heading="Existing Assets">
          {filtered.map(a => (
            <CommandItem key={a.id} value={a.id} onSelect={() => onSelect(a)} className="flex flex-col items-start gap-0.5">
              <div className="flex w-full justify-between">
                <span className="font-medium">{a.name}</span>
                <Badge variant="outline" className="text-[10px] h-4 px-1">{a.branch}</Badge>
              </div>
              <div className="flex w-full justify-between text-xs text-muted-foreground">
                <span>{a.type} · Qty: {a.quantity}</span>
                <span>{formatCurrency(a.unitPrice)}/{a.unit}</span>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface AddPurchaseDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onSave: () => void;
  purchase: Purchase | null;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AddPurchaseDialog({ isOpen, setIsOpen, onSave, purchase }: AddPurchaseDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Purchase type
  const [purchaseType, setPurchaseType] = useState<PurchaseType>('general');

  // Supplier combobox
  const [supplierPopoverOpen, setSupplierPopoverOpen] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');

  // Stock-in items
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [openStockPickerId, setOpenStockPickerId] = useState<string | null>(null);

  // Fixed-asset items
  const [assetItems, setAssetItems] = useState<AssetItem[]>([]);
  const [openAssetPickerId, setOpenAssetPickerId] = useState<string | null>(null);

  // Remote data
  const { data: suppliers = [] } = useQuery<Supplier[]>({ queryKey: ['suppliers'], queryFn: getSuppliers, staleTime: 5 * 60 * 1000 });
  const { data: products = [] } = useQuery<Product[]>({ queryKey: ['products'], queryFn: getProducts, staleTime: 5 * 60 * 1000 });
  const { data: assets = [] } = useQuery<Asset[]>({ queryKey: ['assets'], queryFn: getAssets, staleTime: 5 * 60 * 1000 });

  const form = useForm<PurchaseFormData>({
    resolver: zodResolver(PurchaseSchema),
    defaultValues: { supplier: '', supplier_tin: '', invoiceNumber: '', efd_receipt: '', description: '', quantity: 1, unitCost: 0, taxAmount: 0, amountPaid: 0, paymentMethod: 'credit', expenseCategory: 'Food Ingredients' },
  });

  const taxAmount = form.watch('taxAmount') || 0;
  const paymentMethod = form.watch('paymentMethod');

  const stockItemsTotal = stockItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const assetItemsTotal = assetItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

  const totalCost =
    purchaseType === 'general'
      ? (form.watch('quantity') || 0) * (form.watch('unitCost') || 0) + taxAmount
      : purchaseType === 'stock_in'
      ? stockItemsTotal + taxAmount
      : assetItemsTotal + taxAmount;

  const itemsNetTotal = purchaseType === 'stock_in' ? stockItemsTotal : assetItemsTotal;
  const itemsDiff = totalCost - taxAmount - itemsNetTotal;
  const itemsBalanced = purchaseType === 'general' || Math.abs(itemsDiff) < 1;

  const amountPaid = form.watch('amountPaid') || 0;
  const creditBalance = Math.max(0, totalCost - amountPaid);
  const computedStatus: Purchase['paymentStatus'] =
    amountPaid >= totalCost && totalCost > 0 ? 'paid' : amountPaid > 0 ? 'partial' : 'unpaid';

  // Auto-sync amountPaid with paymentMethod
  useEffect(() => {
    if (paymentMethod === 'cash' || paymentMethod === 'bank') form.setValue('amountPaid', totalCost);
    else if (paymentMethod === 'credit') form.setValue('amountPaid', 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentMethod]);

  useEffect(() => {
    if (paymentMethod === 'cash' || paymentMethod === 'bank') form.setValue('amountPaid', totalCost);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalCost]);

  // Reset / populate on dialog open
  useEffect(() => {
    if (!isOpen) {
      setStockItems([]); setAssetItems([]);
      setSelectedSupplierId(''); setPurchaseType('general');
      return;
    }
    if (purchase) {
      const isFixed = (purchase.expenseCategory || '').toLowerCase().includes('fixed asset');
      setPurchaseType(isFixed ? 'fixed_asset' : 'general');
      form.reset({
        date: new Date(purchase.date),
        supplier: purchase.supplier,
        supplier_tin: purchase.supplier_tin || '',
        invoiceNumber: purchase.invoiceNumber,
        efd_receipt: purchase.efd_receipt || '',
        description: purchase.description,
        quantity: Number(purchase.quantity),
        unitCost: Number(purchase.unitCost),
        taxAmount: Number(purchase.taxAmount),
        amountPaid: Number(purchase.amountPaid ?? purchase.totalCost),
        paymentMethod: purchase.paymentMethod,
        expenseCategory: purchase.expenseCategory || 'General',
      });
      setSelectedSupplierId(purchase.supplierId || '');
    } else {
      form.reset({ date: new Date(), supplier: '', supplier_tin: '', invoiceNumber: '', efd_receipt: '', description: '', quantity: 1, unitCost: 0, taxAmount: 0, amountPaid: 0, paymentMethod: 'credit', expenseCategory: 'Food Ingredients' });
      setSelectedSupplierId(''); setPurchaseType('general');
    }
  }, [purchase, isOpen, form]);

  // Seed items when switching to stock_in / fixed_asset
  const handleTypeChange = useCallback((t: PurchaseType) => {
    setPurchaseType(t);
    if (t === 'stock_in' && stockItems.length === 0) setStockItems([newStockItem()]);
    if (t === 'fixed_asset' && assetItems.length === 0) setAssetItems([newAssetItem()]);
  }, [stockItems.length, assetItems.length]);

  // Supplier helpers
  const handleSelectSupplier = (s: Supplier) => {
    form.setValue('supplier', s.name, { shouldValidate: true });
    if (s.tin) form.setValue('supplier_tin', s.tin);
    setSelectedSupplierId(s.id);
    setSupplierPopoverOpen(false);
  };

  // Stock item helpers
  const updateStockItem = (id: string, field: keyof StockItem, value: string | number) =>
    setStockItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));

  const selectProduct = (itemId: string, product: Product, branch: BranchType) => {
    const price = getBranchPrice(product, branch);
    setStockItems(prev => prev.map(i =>
      i.id === itemId ? { ...i, productId: product.id, productName: product.name, unitPrice: price } : i
    ));
    setOpenStockPickerId(null);
  };

  const setBranchForAllStock = (branch: BranchType) =>
    setStockItems(prev => prev.map(i => ({ ...i, branch })));

  // Asset item helpers
  const updateAssetItem = (id: string, field: keyof AssetItem, value: string | number) =>
    setAssetItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));

  const selectAsset = (itemId: string, asset: Asset) => {
    setAssetItems(prev => prev.map(i =>
      i.id === itemId ? { ...i, assetId: asset.id, assetName: asset.name, assetType: asset.type, unit: asset.unit, unitPrice: asset.unitPrice, branch: asset.branch as BranchType } : i
    ));
    setOpenAssetPickerId(null);
  };

  // Submit
  const handleSubmit = async (values: PurchaseFormData) => {
    const dateStr = format(values.date, 'yyyy-MM-dd');

    // Determine description and amounts based on type
    let description = values.description || '';
    let finalQty = values.quantity || 1;
    let finalUnitCost = values.unitCost || 0;
    let finalCategory = values.expenseCategory || 'General';

    if (purchaseType === 'stock_in') {
      const names = stockItems.map(i => i.productName).filter(Boolean).join(', ');
      description = description || `Stock In: ${names}`;
      finalQty = 1;
      finalUnitCost = stockItemsTotal;
      finalCategory = 'Food Ingredients';
    } else if (purchaseType === 'fixed_asset') {
      const names = assetItems.map(i => i.assetName).filter(Boolean).join(', ');
      description = description || `Fixed Asset Purchase: ${names}`;
      finalQty = 1;
      finalUnitCost = assetItemsTotal;
      finalCategory = 'Fixed Asset Purchase';
    }

    const payload = {
      ...values,
      description,
      quantity: finalQty,
      unitCost: finalUnitCost,
      date: dateStr,
      totalCost,
      amountPaid: values.amountPaid,
      paymentStatus: computedStatus,
      supplierId: selectedSupplierId,
      supplier_tin: values.supplier_tin || '',
      efd_receipt: values.efd_receipt || '',
      expenseCategory: finalCategory,
    };

    if (purchase) {
      await updatePurchase(purchase.id, payload);
      toast({ title: 'Success', description: 'Purchase updated successfully.' });
    } else {
      await addPurchase(payload);

      // Stock-in side-effects: create stock logs AND update product quantities
      if (purchaseType === 'stock_in' && stockItems.length > 0) {
        for (const item of stockItems) {
          // Step 1 — write the stock log
          await addStockLog({
            productId: item.productId || '',
            productName: item.productName || description,
            type: 'Stock In',
            quantity: item.quantity,
            price: item.quantity * item.unitPrice,
            actual_unit_price: item.unitPrice,
            reason: `Purchased from ${values.supplier} — Invoice ${values.invoiceNumber}`,
            date: dateStr, status: 'Verified', branch: item.branch,
          });

          // Step 2 — update branch quantity in the products table (only for catalog products)
          if (item.productId) {
            const prod = products.find(p => p.id === item.productId);
            if (prod) {
              const branchKey = BRANCH_KEYS[item.branch];
              const currentQty = Number(prod[branchKey.qty as keyof Product]) || 0;
              await updateProduct(prod.id, {
                [branchKey.qty]: currentQty + item.quantity,
                [branchKey.price]: item.unitPrice,
              } as Partial<Product>);
            }
          }
        }
        // Refresh product catalog and stock logs so the UI reflects the new quantities immediately
        await queryClient.invalidateQueries({ queryKey: ['products'] });
        await queryClient.invalidateQueries({ queryKey: ['stock_logs'] });
        toast({ title: 'Stock In Recorded', description: `${stockItems.length} product(s) added to inventory.` });
      }

      // Fixed asset side-effects: update or create asset records
      else if (purchaseType === 'fixed_asset' && assetItems.length > 0) {
        await Promise.all(
          assetItems.map(async item => {
            if (item.assetId) {
              const existing = assets.find(a => a.id === item.assetId);
              if (existing) {
                await updateAsset(item.assetId, {
                  quantity: existing.quantity + item.quantity,
                  unitPrice: item.unitPrice,
                });
              }
            } else {
              await addAsset({
                name: item.assetName,
                type: item.assetType || 'Equipment',
                unit: item.unit || 'item',
                unitPrice: item.unitPrice,
                quantity: item.quantity,
                status: 'Active',
                branch: item.branch,
                lastMaintenance: dateStr,
                nextMaintenance: dateStr,
              });
            }
          })
        );
        await queryClient.invalidateQueries({ queryKey: ['assets'] });
        toast({ title: 'Assets Updated', description: `${assetItems.length} asset(s) recorded in Fixed Assets register.` });
      }

      else {
        toast({ title: 'Success', description: 'Purchase added successfully.' });
      }
    }

    onSave();
  };

  const statusColors: Record<Purchase['paymentStatus'], string> = {
    paid: 'bg-emerald-600', partial: 'bg-amber-500', unpaid: 'bg-red-500',
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[680px]">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <DialogHeader>
              <DialogTitle>{purchase ? 'Edit Purchase' : 'Add New Purchase'}</DialogTitle>
              <DialogDescription>Record a supplier invoice. All amounts in TZS.</DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4 max-h-[72vh] overflow-y-auto px-2">

              {/* ── Purchase Type (new only) ─────────────────── */}
              {!purchase && (
                <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Purchase Type</p>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { value: 'general', label: 'General / Services', icon: ShoppingBag, desc: 'Consumables, utilities, services' },
                      { value: 'stock_in', label: 'Current Assets', icon: Package, desc: 'Inventory & stocked goods' },
                      { value: 'fixed_asset', label: 'Fixed Assets', icon: Wrench, desc: 'Equipment & capital items' },
                    ] as const).map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleTypeChange(opt.value)}
                        className={cn(
                          'flex flex-col items-center gap-1.5 rounded-md border p-3 text-center text-sm transition-all',
                          purchaseType === opt.value
                            ? 'border-primary bg-primary/10 text-primary font-semibold shadow-sm'
                            : 'border-border bg-background hover:bg-muted/50 text-muted-foreground'
                        )}
                      >
                        <opt.icon className="h-5 w-5" />
                        <span className="font-medium text-xs leading-tight">{opt.label}</span>
                        <span className="text-[10px] leading-tight opacity-70">{opt.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Date ─────────────────────────────────────── */}
              <FormField control={form.control} name="date" render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Date of Purchase</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button variant="outline" className={cn('w-full pl-3 text-left font-normal', !field.value && 'text-muted-foreground')}>
                          {field.value ? format(field.value, 'PPP') : <span>Pick a date</span>}
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

              {/* ── Supplier combobox ─────────────────────────── */}
              <FormField control={form.control} name="supplier" render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Supplier / Vendor</FormLabel>
                  <Popover open={supplierPopoverOpen} onOpenChange={setSupplierPopoverOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button variant="outline" role="combobox" className={cn('w-full justify-between font-normal', !field.value && 'text-muted-foreground')}>
                          <span className="flex items-center gap-2 truncate">
                            {field.value || 'Search or type supplier name...'}
                            {selectedSupplierId && <Badge variant="secondary" className="text-[10px] h-4 px-1">linked</Badge>}
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[420px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search suppliers..." value={field.value} onValueChange={v => { field.onChange(v); setSelectedSupplierId(''); }} />
                        <CommandList>
                          <CommandEmpty className="py-3 px-4 text-sm">
                            <div className="text-muted-foreground">No saved supplier found.</div>
                            {field.value && <div className="mt-1 flex items-center gap-1.5 text-foreground"><UserPlus className="h-3.5 w-3.5" /><span>Using <strong>&quot;{field.value}&quot;</strong> as new supplier</span></div>}
                          </CommandEmpty>
                          {suppliers.length > 0 && (
                            <CommandGroup heading="Your Supplier Database">
                              {suppliers.map(s => (
                                <CommandItem key={s.id} value={s.name} onSelect={() => handleSelectSupplier(s)} className="justify-between">
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

              {/* ── TIN + Invoice + EFD ──────────────────────── */}
              <div className="grid grid-cols-3 gap-3">
                <FormField control={form.control} name="supplier_tin" render={({ field }) => (
                  <FormItem><FormLabel>TIN <span className="text-muted-foreground text-xs">(opt)</span></FormLabel><FormControl><Input placeholder="9-digit TIN" maxLength={9} {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="invoiceNumber" render={({ field }) => (
                  <FormItem><FormLabel>Invoice / Receipt #</FormLabel><FormControl><Input placeholder="e.g., INV-0012" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="efd_receipt" render={({ field }) => (
                  <FormItem><FormLabel>EFD Receipt <span className="text-muted-foreground text-xs">(opt)</span></FormLabel><FormControl><Input placeholder="TRA EFD" {...field} /></FormControl></FormItem>
                )} />
              </div>

              {/* ── Description ──────────────────────────────── */}
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Description
                    {purchaseType !== 'general' && <span className="ml-1 text-muted-foreground font-normal text-xs">(auto-filled if left blank)</span>}
                  </FormLabel>
                  <FormControl><Input placeholder={purchaseType === 'stock_in' ? 'e.g., Weekly ingredient restock' : purchaseType === 'fixed_asset' ? 'e.g., New kitchen equipment purchase' : 'e.g., Generator fuel — June 2026'} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* ── Qty + Unit Cost — General only ───────────── */}
              {purchaseType === 'general' && (
                <div className="grid grid-cols-3 gap-3">
                  <FormField control={form.control} name="quantity" render={({ field }) => (
                    <FormItem><FormLabel>Quantity</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(Number(e.target.value))} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="unitCost" render={({ field }) => (
                    <FormItem><FormLabel>Unit Cost (TZS)</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(Number(e.target.value))} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="taxAmount" render={({ field }) => (
                    <FormItem><FormLabel>Input VAT (TZS)</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(Number(e.target.value))} /></FormControl></FormItem>
                  )} />
                </div>
              )}

              {/* ── VAT for Stock-In / Fixed Asset ───────────── */}
              {purchaseType !== 'general' && (
                <FormField control={form.control} name="taxAmount" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Input VAT (TZS) <span className="text-muted-foreground font-normal text-xs">(on the whole invoice)</span></FormLabel>
                    <FormControl><Input type="number" {...field} onChange={e => field.onChange(Number(e.target.value))} /></FormControl>
                  </FormItem>
                )} />
              )}

              {/* ── Purchase total ───────────────────────────── */}
              <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Purchase Total</span>
                <span className="font-bold text-lg">{formatCurrency(totalCost)}</span>
              </div>

              {/* ── Category — General only ──────────────────── */}
              {purchaseType === 'general' && (
                <FormField control={form.control} name="expenseCategory" render={({ field }) => (
                  <FormItem><FormLabel>Category <span className="text-muted-foreground font-normal text-xs">(opt)</span></FormLabel><FormControl><Input placeholder="e.g., Kitchen Consumables, Utilities, Marketing" {...field} /></FormControl></FormItem>
                )} />
              )}

              {/* ── Payment ──────────────────────────────────── */}
              <div className="rounded-lg border bg-card p-4 space-y-3">
                <div className="flex items-center gap-2 font-semibold text-sm"><CreditCard className="h-4 w-4 text-primary" /> Payment</div>
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
                      </Select>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="amountPaid" render={({ field }) => (
                    <FormItem><FormLabel>Amount Paid (TZS)</FormLabel>
                      <FormControl><Input type="number" min={0} max={totalCost} {...field} onChange={e => field.onChange(Math.min(Number(e.target.value), totalCost))} /></FormControl>
                    </FormItem>
                  )} />
                </div>
                <div className={cn('rounded-md border px-3 py-2.5 text-sm space-y-1.5',
                  computedStatus === 'paid' ? 'border-emerald-400/40 bg-emerald-50/10' : computedStatus === 'partial' ? 'border-amber-400/40 bg-amber-50/10' : 'border-red-400/40 bg-red-50/10'
                )}>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Status</span>
                    <Badge className={cn('text-white capitalize', statusColors[computedStatus])}>{computedStatus}</Badge>
                  </div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Paid</span><span className="font-semibold text-emerald-600">{formatCurrency(amountPaid)}</span></div>
                  {creditBalance > 0 && (
                    <div className="flex justify-between border-t pt-1.5 mt-1">
                      <span className="font-semibold">Credit → Accounts Payable</span>
                      <span className="font-bold text-amber-600">{formatCurrency(creditBalance)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* ══════════════════════════════════════════════ */}
              {/* ── STOCK-IN ITEMS (product catalog) ─────────── */}
              {/* ══════════════════════════════════════════════ */}
              {purchaseType === 'stock_in' && !purchase && (
                <div className="rounded-lg border border-blue-400/30 bg-blue-50/5 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-blue-600" />
                      <span className="font-semibold text-sm">Inventory Items — Product Catalog</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{stockItems.length} item{stockItems.length !== 1 ? 's' : ''}</span>
                  </div>

                  {/* Shared branch */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">Receiving Branch:</span>
                    <Select value={stockItems[0]?.branch || 'Dar es Salaam'} onValueChange={val => setBranchForAllStock(val as BranchType)}>
                      <SelectTrigger className="h-8 w-[160px] text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Dar es Salaam">Dar es Salaam</SelectItem>
                        <SelectItem value="Arusha">Arusha</SelectItem>
                        <SelectItem value="Dodoma">Dodoma</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Column headers */}
                  <div className="grid grid-cols-[1fr_70px_90px_80px_28px] gap-1.5 text-xs font-semibold text-muted-foreground px-1">
                    <span>Product (from catalog)</span><span>Qty</span><span>Unit Price</span><span>Line Total</span><span />
                  </div>

                  {stockItems.map(item => (
                    <div key={item.id} className="grid grid-cols-[1fr_70px_90px_80px_28px] gap-1.5 items-center">
                      {/* Product combobox */}
                      <Popover
                        open={openStockPickerId === item.id}
                        onOpenChange={open => setOpenStockPickerId(open ? item.id : null)}
                      >
                        <PopoverTrigger asChild>
                          <Button variant="outline" className={cn('h-auto min-h-[2rem] py-1 w-full justify-between text-sm font-normal px-2', !item.productName && 'text-muted-foreground')}>
                            <div className="flex flex-col items-start min-w-0 flex-1 overflow-hidden">
                              <span className="truncate leading-tight w-full">{item.productName || 'Search product...'}</span>
                              {item.productId && (() => {
                                const prod = products.find(x => x.id === item.productId);
                                if (!prod) return null;
                                return (
                                  <span className="text-[10px] text-muted-foreground leading-tight">
                                    In stock: {getBranchQty(prod, item.branch)} {prod.unit}
                                  </span>
                                );
                              })()}
                            </div>
                            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50 ml-1 self-center" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[320px] p-0" align="start">
                          <StockPickerContent
                            products={products}
                            branch={item.branch}
                            onSelect={product => selectProduct(item.id, product, item.branch)}
                          />
                          {/* Allow typing a custom name */}
                          <div className="border-t p-2">
                            <Input
                              className="h-7 text-xs"
                              placeholder="Or type custom product name..."
                              value={item.productName}
                              onChange={e => { updateStockItem(item.id, 'productName', e.target.value); updateStockItem(item.id, 'productId', ''); }}
                            />
                          </div>
                        </PopoverContent>
                      </Popover>

                      <Input type="number" value={item.quantity} onChange={e => updateStockItem(item.id, 'quantity', Number(e.target.value))} className="h-8 text-sm" />
                      <Input type="number" value={item.unitPrice} onChange={e => updateStockItem(item.id, 'unitPrice', Number(e.target.value))} className="h-8 text-sm" />
                      <span className="text-sm font-medium text-right tabular-nums">
                        {(item.quantity * item.unitPrice).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </span>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setStockItems(p => p.filter(i => i.id !== item.id))} disabled={stockItems.length === 1}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}

                  <Button type="button" variant="outline" size="sm" className="w-full h-8 text-xs" onClick={() => setStockItems(p => [...p, newStockItem({ branch: stockItems[0]?.branch || 'Dar es Salaam' })])}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add Another Product
                  </Button>

                  <ReconciliationCard totalCost={totalCost} taxAmount={taxAmount} itemsNetTotal={stockItemsTotal} balanced={itemsBalanced} difference={itemsDiff} />
                </div>
              )}

              {/* ══════════════════════════════════════════════ */}
              {/* ── FIXED ASSET ITEMS (assets database) ──────── */}
              {/* ══════════════════════════════════════════════ */}
              {purchaseType === 'fixed_asset' && !purchase && (
                <div className="rounded-lg border border-purple-400/30 bg-purple-50/5 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-purple-600" />
                      <span className="font-semibold text-sm">Fixed Asset Items — Assets Register</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{assetItems.length} item{assetItems.length !== 1 ? 's' : ''}</span>
                  </div>

                  {/* Column headers */}
                  <div className="grid grid-cols-[1fr_100px_65px_90px_80px_28px] gap-1.5 text-xs font-semibold text-muted-foreground px-1">
                    <span>Asset (from register)</span><span>Type</span><span>Qty</span><span>Unit Price</span><span>Line Total</span><span />
                  </div>

                  {assetItems.map(item => (
                    <div key={item.id} className="grid grid-cols-[1fr_100px_65px_90px_80px_28px] gap-1.5 items-center">
                      {/* Asset combobox */}
                      <Popover
                        open={openAssetPickerId === item.id}
                        onOpenChange={open => setOpenAssetPickerId(open ? item.id : null)}
                      >
                        <PopoverTrigger asChild>
                          <Button variant="outline" className={cn('h-8 w-full justify-between text-sm font-normal px-2', !item.assetName && 'text-muted-foreground')}>
                            <span className="truncate">{item.assetName || 'Search asset...'}</span>
                            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50 ml-1" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[340px] p-0" align="start">
                          <AssetPickerContent
                            assets={assets}
                            onSelect={asset => selectAsset(item.id, asset)}
                          />
                          {/* New asset name input */}
                          <div className="border-t p-2 space-y-1.5">
                            <p className="text-[10px] text-muted-foreground px-1">Or describe a new asset:</p>
                            <Input className="h-7 text-xs" placeholder="Asset name..." value={item.assetName} onChange={e => { updateAssetItem(item.id, 'assetName', e.target.value); updateAssetItem(item.id, 'assetId', ''); }} />
                          </div>
                        </PopoverContent>
                      </Popover>

                      {/* Asset type */}
                      <Input value={item.assetType} onChange={e => updateAssetItem(item.id, 'assetType', e.target.value)} className="h-8 text-xs" placeholder="Equipment" />
                      <Input type="number" value={item.quantity} onChange={e => updateAssetItem(item.id, 'quantity', Number(e.target.value))} className="h-8 text-sm" />
                      <Input type="number" value={item.unitPrice} onChange={e => updateAssetItem(item.id, 'unitPrice', Number(e.target.value))} className="h-8 text-sm" />
                      <span className="text-sm font-medium text-right tabular-nums">
                        {(item.quantity * item.unitPrice).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </span>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setAssetItems(p => p.filter(i => i.id !== item.id))} disabled={assetItems.length === 1}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}

                  {/* Branch for new assets */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">Branch (new assets):</span>
                    <Select value={assetItems[0]?.branch || 'Dar es Salaam'} onValueChange={val => setAssetItems(p => p.map(i => ({ ...i, branch: val as BranchType })))}>
                      <SelectTrigger className="h-8 w-[160px] text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Dar es Salaam">Dar es Salaam</SelectItem>
                        <SelectItem value="Arusha">Arusha</SelectItem>
                        <SelectItem value="Dodoma">Dodoma</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button type="button" variant="outline" size="sm" className="w-full h-8 text-xs" onClick={() => setAssetItems(p => [...p, newAssetItem({ branch: assetItems[0]?.branch || 'Dar es Salaam' })])}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add Another Asset
                  </Button>

                  <ReconciliationCard totalCost={totalCost} taxAmount={taxAmount} itemsNetTotal={assetItemsTotal} balanced={itemsBalanced} difference={itemsDiff} />
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

// ─── Reconciliation card ──────────────────────────────────────────────────────

function ReconciliationCard({ totalCost, taxAmount, itemsNetTotal, balanced, difference }: {
  totalCost: number; taxAmount: number; itemsNetTotal: number; balanced: boolean; difference: number;
}) {
  return (
    <div className={cn('rounded-md border p-3 text-sm space-y-1', balanced ? 'border-emerald-400/50 bg-emerald-50/10' : 'border-amber-400/50 bg-amber-50/10')}>
      <div className="flex justify-between"><span className="text-muted-foreground">Items Net Total</span><span className="font-semibold tabular-nums">{formatCurrency(itemsNetTotal)}</span></div>
      <div className="flex justify-between"><span className="text-muted-foreground">Purchase Net (excl. VAT)</span><span className="font-semibold tabular-nums">{formatCurrency(totalCost - taxAmount)}</span></div>
      <div className="flex justify-between items-center border-t pt-1 mt-1">
        <span className="font-semibold">Difference</span>
        <div className="flex items-center gap-1.5">
          {balanced ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-amber-500" />}
          <span className={cn('font-bold tabular-nums', balanced ? 'text-emerald-600' : 'text-amber-600')}>
            {balanced ? 'Balanced ✓' : difference > 0 ? `−${formatCurrency(difference)} unallocated` : `+${formatCurrency(Math.abs(difference))} over`}
          </span>
        </div>
      </div>
    </div>
  );
}
