// @ts-nocheck
'use client'
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect, useMemo } from "react";
import { Check, ChevronsUpDown, ArrowRight, CalendarIcon, Loader2, ArrowRightLeft } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "../ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../ui/command";
import { cn } from "@/lib/utils";
import { Calendar } from "../ui/calendar";
import { format } from "date-fns";
import { BRANCHES, BRANCH_KEYS } from "@/types";

export function TransferStockDialog({ isOpen, setIsOpen, onTransfer, products }) {
  const [sourceBranch, setSourceBranch] = useState('Dar es Salaam');
  const [destBranch, setDestBranch] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [date, setDate] = useState(new Date());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState('form');

  useEffect(() => {
    if (isOpen) {
      setSourceBranch('Dar es Salaam');
      setDestBranch('');
      setProductId('');
      setQuantity(1);
      setDate(new Date());
      setStep('form');
    }
  }, [isOpen]);

  const product = products.find(p => p.id === productId);
  
  const sourceQty = useMemo(() => {
    if (!product || !sourceBranch) return 0;
    const key = BRANCH_KEYS[sourceBranch];
    return Number(product[key?.qty]) || 0;
  }, [product, sourceBranch]);

  const destQty = useMemo(() => {
    if (!product || !destBranch) return 0;
    const key = BRANCH_KEYS[destBranch];
    return Number(product[key?.qty]) || 0;
  }, [product, destBranch]);

  const sourcePrice = useMemo(() => {
    if (!product || !sourceBranch) return 0;
    const key = BRANCH_KEYS[sourceBranch];
    return Number(product[key?.price]) || 0;
  }, [product, sourceBranch]);

  const isValid = productId && sourceBranch && destBranch && sourceBranch !== destBranch && quantity > 0 && quantity <= sourceQty;

  const formatCurrency = (amount) => {
    if (typeof amount !== 'number') return 'TZS 0.00';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS' }).format(amount).replace('TZS', 'TZS ');
  };

  const handleSubmit = async () => {
    if (!isValid) return;
    setIsSubmitting(true);
    try {
      await onTransfer({
        productId,
        productName: product?.name || 'Unknown',
        sourceBranch,
        destBranch,
        quantity: Number(quantity),
        unitPrice: sourcePrice,
        date: format(date, 'yyyy-MM-dd'),
      });
      setStep('success');
    } catch (error) {
      console.error("Transfer failed:", error);
      alert("Transfer failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const availableDestBranches = BRANCHES.filter(b => b !== sourceBranch);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-lg" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
            Transfer Stock Between Branches
          </DialogTitle>
          <DialogDescription>
            {step === 'form' && "Move inventory from one branch to another. This will not affect your daily costing."}
            {step === 'success' && "Transfer completed successfully."}
          </DialogDescription>
        </DialogHeader>

        {step === 'form' && (
          <div className="space-y-5 py-4">
            {/* Branch selectors */}
            <div className="grid grid-cols-5 items-end gap-2">
              <div className="col-span-2">
                <Label className="font-semibold">From Branch</Label>
                <Select value={sourceBranch} onValueChange={(v) => { setSourceBranch(v); if (v === destBranch) setDestBranch(''); }}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BRANCHES.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-center pb-2">
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="col-span-2">
                <Label className="font-semibold">To Branch</Label>
                <Select value={destBranch} onValueChange={setDestBranch}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {availableDestBranches.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Product selector */}
            <div>
              <Label className="font-semibold">Product</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className={cn("w-full justify-between mt-1", !productId && "text-muted-foreground")}>
                    {productId ? products.find(p => p.id === productId)?.name : "Select product..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                  <Command>
                    <CommandInput placeholder="Search product..." />
                    <CommandList>
                      <CommandEmpty>No product found.</CommandEmpty>
                      <CommandGroup>
                        {products.map((p) => {
                          const key = BRANCH_KEYS[sourceBranch];
                          const qty = Number(p[key?.qty]) || 0;
                          return (
                            <CommandItem value={`${p.name} (${p.id})`} key={p.id} onSelect={() => setProductId(p.id)}>
                              <Check className={cn("mr-2 h-4 w-4", p.id === productId ? "opacity-100" : "opacity-0")} />
                              <span className="flex-1">{p.name}</span>
                              <span className="text-xs text-muted-foreground ml-2">Qty: {qty} {p.unit}</span>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Quantity */}
            <div>
              <Label className="font-semibold">Quantity to Transfer</Label>
              <Input type="number" step="any" value={quantity} onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)} min="0.01" className="mt-1" />
              {product && quantity > sourceQty && (
                <p className="text-[10px] text-destructive mt-1 font-semibold">Exceeds available stock in {sourceBranch} ({sourceQty} {product.unit})</p>
              )}
            </div>

            {/* Date */}
            <div>
              <Label className="font-semibold">Transfer Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal mt-1", !date && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} initialFocus />
                </PopoverContent>
              </Popover>
            </div>

            {/* Preview */}
            {product && destBranch && (
              <div className="p-4 border rounded-lg bg-muted/20 space-y-3">
                <p className="text-sm font-bold uppercase text-muted-foreground">Transfer Preview</p>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 border rounded-md bg-background">
                    <p className="text-[10px] uppercase text-muted-foreground font-bold">{sourceBranch}</p>
                    <p className="text-lg font-bold">{sourceQty} <span className="text-xs text-muted-foreground">{product.unit}</span></p>
                    <p className="text-xs text-destructive font-bold">→ {Math.max(0, sourceQty - quantity)}</p>
                  </div>
                  <div className="flex items-center justify-center">
                    <div className="text-center">
                      <ArrowRight className="h-6 w-6 mx-auto text-primary" />
                      <p className="text-sm font-bold text-primary">{quantity}</p>
                    </div>
                  </div>
                  <div className="p-3 border rounded-md bg-background">
                    <p className="text-[10px] uppercase text-muted-foreground font-bold">{destBranch}</p>
                    <p className="text-lg font-bold">{destQty} <span className="text-xs text-muted-foreground">{product.unit}</span></p>
                    <p className="text-xs text-green-600 font-bold">→ {destQty + quantity}</p>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground text-center italic">This transfer will NOT affect daily costing calculations.</p>
              </div>
            )}
          </div>
        )}

        {step === 'success' && (
          <div className="py-8 text-center space-y-4">
            <div className="w-16 h-16 bg-green-500/20 text-green-600 rounded-full flex items-center justify-center mx-auto">
              <Check className="h-10 w-10" />
            </div>
            <h3 className="text-2xl font-bold text-green-700">Transfer Complete!</h3>
            <p className="text-muted-foreground">
              {quantity} {product?.unit} of <strong>{product?.name}</strong> transferred from <strong>{sourceBranch}</strong> to <strong>{destBranch}</strong>.
            </p>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === 'form' && (
            <>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button>
              </DialogClose>
              <Button onClick={handleSubmit} disabled={!isValid || isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm Transfer
              </Button>
            </>
          )}
          {step === 'success' && (
            <Button className="w-full" onClick={() => setIsOpen(false)}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
