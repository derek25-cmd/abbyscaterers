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
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { useOrderStorage } from "@/hooks/use-order-storage";
import { PlusCircle, Trash2, Check, ChevronsUpDown, ArrowRight, CalendarIcon } from "lucide-react";
import { ScrollArea } from "../ui/scroll-area";
import { Popover, PopoverTrigger, PopoverContent } from "../ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../ui/command";
import { cn } from "@/lib/utils";
import { Calendar } from "../ui/calendar";
import { format } from "date-fns";
import { BRANCHES, BRANCH_KEYS } from "@/types";

export function LogStockMovementDialog({ isOpen, setIsOpen, logType, onLogMovement, products }) {
  const [items, setItems] = useState([{ productId: '', quantity: 1, reason: '', orderId: '', actual_unit_price: 0 }]);
  const [date, setDate] = useState(new Date());
  const [branch, setBranch] = useState('Dar es Salaam');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState('form');
  const [currentProgress, setCurrentProgress] = useState(0);
  const [currentItemName, setCurrentItemName] = useState('');
  const [results, setResults] = useState({ success: 0, failed: 0, errors: [] });
  const { orders } = useOrderStorage();
  
  const stockInReasons = ["Vendor Delivery", "Internal Production", "Stock Transfer"];
  const stockOutReasons = ["Customer Order", "Internal Use", "Spoilage", "Breakage", "Stock Transfer", "Training costs"];
  const reasonOptions = logType === 'Stock In' ? stockInReasons : stockOutReasons;

  const summary = useMemo(() => {
    const validItems = items.filter(item => item.productId && item.quantity > 0);
    const totalValue = validItems.reduce((acc, item) => acc + (Number(item.actual_unit_price) * Number(item.quantity)), 0);
    const totalQuantity = validItems.reduce((acc, item) => acc + Number(item.quantity), 0);
    return { totalValue, totalQuantity, itemCount: validItems.length };
  }, [items]);

  useEffect(() => {
    if (isOpen) {
        setItems([{ productId: '', quantity: 1, reason: '', orderId: '', actual_unit_price: 0 }]);
        setDate(new Date());
        setStep('form');
        setCurrentProgress(0);
        setCurrentItemName('');
        setResults({ success: 0, failed: 0, errors: [] });
    }
  }, [isOpen]);

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    const numericValue = parseFloat(value);

    if (field === 'quantity' || field === 'actual_unit_price') {
      newItems[index][field] = isNaN(numericValue) ? 0 : numericValue;
    } else {
      newItems[index][field] = value;
    }
    
    if (field === 'productId') {
        const product = getProduct(value);
        if (product && branch) {
            const branchKey = BRANCH_KEYS[branch];
            newItems[index]['actual_unit_price'] = Number(product[branchKey?.price]) || product.unitPrice || 0;
        }
    }

    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, { productId: '', quantity: 1, reason: '', orderId: '', actual_unit_price: 0 }]);
  };

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };
  
  const handleReview = (e) => {
    if (e) e.preventDefault();
    const validItems = items.filter(item => item.productId && item.quantity > 0 && item.reason && item.actual_unit_price >= 0);
    
    if (validItems.length < items.length) {
        if (!confirm("Some items are incomplete or invalid and will be skipped. Continue to review?")) {
            return;
        }
    }

    if (validItems.length === 0) {
        alert("Please add at least one valid item to log.");
        return;
    }
    setStep('review');
  };

  const handleSubmit = async () => {
    const validItems = items.filter(item => item.productId && item.quantity > 0 && item.reason && item.actual_unit_price >= 0);
    setStep('progress');
    setIsSubmitting(true);
    let successCount = 0;
    let failCount = 0;
    const errors = [];
    
    for (let i = 0; i < validItems.length; i++) {
        const item = validItems[i];
        const product = getProduct(item.productId);
        setCurrentItemName(product?.name || 'Unknown Item');
        
        try {
            let finalReason = item.reason;
            if (item.reason === 'Customer Order' && item.orderId) {
                finalReason = `Customer Order: ${item.orderId}`;
            }
            
            const result = await onLogMovement({
                productId: item.productId,
                productName: product?.name || 'Unknown',
                type: logType,
                reason: finalReason,
                quantity: Number(item.quantity),
                price: Number(item.actual_unit_price) * Number(item.quantity),
                actual_unit_price: Number(item.actual_unit_price),
                date: format(date, 'yyyy-MM-dd'),
                branch: branch,
            });

            if (result === null) throw new Error("Service returned failure");
            
            successCount++;
        } catch (error) {
            console.error(`Failed to log ${product?.name}:`, error);
            failCount++;
            errors.push(`${product?.name || 'Unknown'}: ${error.message || 'Unknown error'}`);
        }
        
        setCurrentProgress(Math.round(((i + 1) / validItems.length) * 100));
        await new Promise(resolve => setTimeout(resolve, 200)); 
    }
    
    setResults({ success: successCount, failed: failCount, errors });
    setStep('success');
    setIsSubmitting(false);
  };

  
  const getProduct = (productId) => products.find(p => p.id === productId);

  const formatCurrency = (amount) => {
    if (typeof amount !== 'number') return 'TZS 0.00';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS' }).format(amount).replace('TZS', 'TZS ');
  }

  const getBranchQty = (product) => {
    if (!product || !branch) return product?.quantity || 0;
    const branchKey = BRANCH_KEYS[branch];
    return Number(product[branchKey?.qty]) || 0;
  };

  const getBranchPrice = (product) => {
    if (!product || !branch) return product?.unitPrice || 0;
    const branchKey = BRANCH_KEYS[branch];
    return Number(product[branchKey?.price]) || 0;
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent 
        className="sm:max-w-3xl"
        onInteractOutside={(e) => {
            e.preventDefault();
        }}
        >
        <form onSubmit={handleReview}>
          <DialogHeader>
            <DialogTitle>{logType}</DialogTitle>
            <DialogDescription>
              {step === 'form' && "Log one or more stock movements into the inventory."}
              {step === 'review' && "Carefully review the movements before confirming."}
              {step === 'progress' && `Processing item ${Math.ceil((currentProgress / 100) * summary.itemCount)} of ${summary.itemCount}...`}
              {step === 'success' && "Batch processing complete."}
            </DialogDescription>
          </DialogHeader>

          {step === 'form' && (
          <>
          <ScrollArea className="h-[60vh] p-1">
          <div className="space-y-4 py-4">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-2 border rounded-md bg-muted/30">
                <div>
                  <Label className="block mb-2 font-semibold">Branch <span className="text-destructive">*</span></Label>
                  <Select value={branch} onValueChange={setBranch}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {BRANCHES.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="block mb-2 font-semibold">Date of Movement</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                    <Button
                        variant={"outline"}
                        className={cn(
                        "w-full justify-start text-left font-normal",
                        !date && "text-muted-foreground"
                        )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date ? format(date, "PPP") : <span>Pick a date</span>}
                    </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                    <Calendar
                        mode="single"
                        selected={date}
                        onSelect={(d) => d && setDate(d)}
                        initialFocus
                    />
                    </PopoverContent>
                  </Popover>
                </div>
             </div>
            {items.map((item, index) => {
                const product = getProduct(item.productId);
                const catalogPrice = getBranchPrice(product);
                const priceVariation = item.actual_unit_price - catalogPrice;

               return (
               <Card key={index} className="relative p-4 border-2 border-muted hover:border-primary/20 transition-colors">
                {items.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 text-destructive hover:bg-destructive/10" onClick={() => removeItem(index)}>
                        <Trash2 className="h-4 w-4"/>
                    </Button>
                )}
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div>
                        <Label>Product <span className="text-destructive">*</span></Label>
                         <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                variant="outline"
                                role="combobox"
                                className={cn(
                                    "w-full justify-between mt-1",
                                    !item.productId && "text-muted-foreground"
                                )}
                                >
                                {item.productId
                                    ? products.find(
                                        (p) => p.id === item.productId
                                    )?.name
                                    : "Select product..."}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                <Command>
                                <CommandInput placeholder="Search product..." />
                                <CommandList>
                                    <CommandEmpty>No product found.</CommandEmpty>
                                    <CommandGroup>
                                    {(products || []).map((p) => (
                                        <CommandItem
                                        value={`${p.name} (${p.id})`}
                                        key={p.id}
                                        onSelect={() => handleItemChange(index, 'productId', p.id)}
                                        >
                                        <Check
                                            className={cn(
                                            "mr-2 h-4 w-4",
                                            p.id === item.productId ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        <span className="flex-1">{p.name}</span>
                                        <span className="text-xs text-muted-foreground ml-2">Qty: {getBranchQty(p)}</span>
                                        </CommandItem>
                                    ))}
                                    </CommandGroup>
                                </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                     </div>
                     <div>
                        <Label>Quantity <span className="text-destructive">*</span></Label>
                        <Input type="number" step="any" className="mt-1" value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', e.target.value)} min="0.01" />
                        {logType === 'Stock Out' && product && item.quantity > getBranchQty(product) && (
                            <p className="text-[10px] text-destructive mt-1 font-semibold">Exceeds current stock in {branch}!</p>
                        )}
                     </div>
                 </div>
                 
                {product && (
                    <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
                         <div className="p-2 bg-muted/50 rounded-md border">
                            <p className="text-muted-foreground">In Stock ({branch})</p>
                            <p className="font-bold">{getBranchQty(product)} {product.unit}</p>
                        </div>
                        <div className="p-2 bg-muted/50 rounded-md border">
                            <p className="text-muted-foreground">Branch Price</p>
                            <p className="font-bold">{formatCurrency(catalogPrice)}</p>
                        </div>
                        <div className="p-2 bg-muted/50 rounded-md border">
                            <p className="text-muted-foreground">Actual Unit Price</p>
                            <p className="font-bold">{formatCurrency(item.actual_unit_price)}</p>
                        </div>
                         <div className="p-2 bg-primary/5 rounded-md border border-primary/20">
                            <p className="text-primary font-semibold">Line Total</p>
                            <p className="font-bold">{formatCurrency(item.actual_unit_price * item.quantity)}</p>
                        </div>
                    </div>
                )}


                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div>
                        <Label>Reason <span className="text-destructive">*</span></Label>
                        <Select onValueChange={(value) => handleItemChange(index, 'reason', value)} value={item.reason}>
                          <SelectTrigger className="mt-1"><SelectValue placeholder="Select a reason" /></SelectTrigger>
                          <SelectContent>
                            {reasonOptions.map(r => (<SelectItem key={r} value={r}>{r}</SelectItem>))}
                          </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label>Actual Price (per unit)</Label>
                        <Input type="number" className="mt-1" value={item.actual_unit_price} onChange={(e) => handleItemChange(index, 'actual_unit_price', e.target.value)} min="0" step="any" />
                    </div>
                 </div>

                 {item.reason === 'Customer Order' && (
                     <div className="mt-4">
                        <Label>Customer Order <span className="text-destructive">*</span></Label>
                        <Select onValueChange={(value) => handleItemChange(index, 'orderId', value)} value={item.orderId}>
                            <SelectTrigger className="mt-1"><SelectValue placeholder="Select an order" /></SelectTrigger>
                            <SelectContent>
                                {orders.map(o => (<SelectItem key={o.id} value={o.id}>{o.name} ({o.id})</SelectItem>))}
                            </SelectContent>
                        </Select>
                     </div>
                 )}

                 {product && (
                    <div className="mt-3 p-2 bg-blue-500/5 border border-blue-500/20 rounded-md">
                        <p className="text-[10px] md:text-xs font-semibold text-blue-800 flex justify-between">
                            <span>Price Variation (vs Branch Price):</span>
                            <span className={cn("font-bold", priceVariation > 0 ? "text-destructive" : priceVariation < 0 ? "text-green-600" : "text-muted-foreground")}>
                                {priceVariation !== 0 && (priceVariation > 0 ? '+' : '')}{formatCurrency(priceVariation)}
                            </span>
                        </p>
                    </div>
                 )}
               </Card>
               )
            })}
             <Button type="button" variant="outline" size="sm" className="w-full h-12 border-dashed border-2 hover:bg-primary/5" onClick={addItem}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add Another Product
              </Button>
          </div>
          </ScrollArea>
          <div className="mt-4 p-4 border rounded-lg bg-primary/5 grid grid-cols-4 gap-4">
              <div className="text-center border-r">
                <p className="text-[10px] text-muted-foreground uppercase font-bold">Branch</p>
                <p className="text-sm font-bold">{branch}</p>
              </div>
              <div className="text-center border-r">
                <p className="text-[10px] text-muted-foreground uppercase font-bold">Total Items</p>
                <p className="text-xl font-bold">{summary.itemCount}</p>
              </div>
              <div className="text-center border-r">
                <p className="text-[10px] text-muted-foreground uppercase font-bold">Total Quantity</p>
                <p className="text-xl font-bold">{summary.totalQuantity.toFixed(2)}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground uppercase font-bold">Total Value</p>
                <p className="text-xl font-bold text-primary">{formatCurrency(summary.totalValue)}</p>
              </div>
          </div>
          </>
          )}

          {step === 'review' && (
              <div className="space-y-6 py-4">
                  <div className="p-3 bg-muted/30 rounded-md border text-sm">
                    <span className="font-semibold">Branch:</span> {branch} &nbsp;|&nbsp; <span className="font-semibold">Date:</span> {format(date, "PPP")}
                  </div>
                  <div className="border rounded-md overflow-hidden">
                      <table className="w-full text-xs">
                          <thead className="bg-muted">
                              <tr>
                                  <th className="p-2 text-left">Product</th>
                                  <th className="p-2 text-right">Qty</th>
                                  <th className="p-2 text-right">Unit Price</th>
                                  <th className="p-2 text-right">Total</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y">
                              {items.filter(i => i.productId && i.quantity > 0).map((item, idx) => {
                                  const p = getProduct(item.productId);
                                  return (
                                      <tr key={idx} className="hover:bg-muted/30">
                                          <td className="p-2 font-medium">{p?.name}</td>
                                          <td className="p-2 text-right">{item.quantity} {p?.unit}</td>
                                          <td className="p-2 text-right">{formatCurrency(item.actual_unit_price)}</td>
                                          <td className="p-2 text-right font-bold">{formatCurrency(item.actual_unit_price * item.quantity)}</td>
                                      </tr>
                                  )
                              })}
                          </tbody>
                          <tfoot className="bg-muted/50 font-bold">
                              <tr>
                                  <td className="p-2">TOTAL</td>
                                  <td className="p-2 text-right">{summary.totalQuantity.toFixed(2)}</td>
                                  <td className="p-2"></td>
                                  <td className="p-2 text-right text-primary">{formatCurrency(summary.totalValue)}</td>
                              </tr>
                          </tfoot>
                      </table>
                  </div>

                  <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                      <h4 className="text-sm font-bold text-yellow-800 flex items-center mb-1">
                          <Check className="h-4 w-4 mr-2" /> Accuracy Check
                      </h4>
                      <p className="text-xs text-yellow-700">
                          Please verify all quantities and prices above. Once confirmed, these stock movements will be irreversibly logged for <strong>{branch}</strong> on {format(date, "PPP")}.
                      </p>
                  </div>
              </div>
          )}

          {step === 'progress' && (
              <div className="py-12 space-y-6 text-center">
                  <div className="relative w-32 h-32 mx-auto">
                    <div className="absolute inset-0 flex items-center justify-center text-2xl font-bold">
                        {currentProgress}%
                    </div>
                    <svg className="w-full h-full transform -rotate-90">
                        <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-muted" />
                        <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={364.4} strokeDashoffset={364.4 - (364.4 * currentProgress) / 100} className="text-primary transition-all duration-300" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{currentItemName}</h3>
                    <p className="text-muted-foreground animate-pulse">Processing movement...</p>
                  </div>
                  <Progress value={currentProgress} className="w-full h-2" />
              </div>
          )}

          {step === 'success' && (
              <div className="py-8 space-y-6">
                  <div className="flex flex-col items-center justify-center text-center space-y-4">
                      <div className="w-16 h-16 bg-green-500/20 text-green-600 rounded-full flex items-center justify-center">
                          <Check className="h-10 w-10" />
                      </div>
                      <div>
                          <h3 className="text-2xl font-bold text-green-700">Successfully Processed!</h3>
                          <p className="text-muted-foreground">
                              {results.success} items logged successfully to <strong>{branch}</strong>.
                              {results.failed > 0 && <span className="text-destructive font-bold ml-1"> {results.failed} failed.</span>}
                          </p>
                      </div>
                  </div>

                  {results.errors.length > 0 && (
                      <div className="p-4 bg-destructive/5 border border-destructive/20 rounded-md">
                          <p className="text-xs font-bold text-destructive mb-2 uppercase">Error Report:</p>
                          <ScrollArea className="h-24">
                              <ul className="text-xs space-y-1">
                                  {results.errors.map((err, i) => (
                                      <li key={i} className="flex items-start">
                                          <span className="text-destructive mr-2">•</span>
                                          {err}
                                      </li>
                                  ))}
                              </ul>
                          </ScrollArea>
                      </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 pt-4">
                      <div className="p-3 border rounded-md text-center">
                          <p className="text-[10px] text-muted-foreground uppercase">Success</p>
                          <p className="text-xl font-bold text-green-600">{results.success}</p>
                      </div>
                      <div className="p-3 border rounded-md text-center">
                          <p className="text-[10px] text-muted-foreground uppercase">Failed</p>
                          <p className="text-xl font-bold text-destructive">{results.failed}</p>
                      </div>
                  </div>
              </div>
          )}

          <DialogFooter className="pt-4 gap-2">
            {step === 'form' && (
                <>
                <DialogClose asChild>
                    <Button type="button" variant="outline" disabled={isSubmitting}>Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={isSubmitting || summary.itemCount === 0}>
                    Review Movements
                </Button>
                </>
            )}

            {step === 'review' && (
                <>
                <Button type="button" variant="outline" onClick={() => setStep('form')} disabled={isSubmitting}>
                    Back to Edit
                </Button>
                <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
                    {isSubmitting ? "Processing..." : "Confirm & Log All"}
                </Button>
                </>
            )}

            {step === 'progress' && (
                <div className="text-xs text-muted-foreground italic w-full text-center">
                    Processing batch... please do not close this window.
                </div>
            )}

            {step === 'success' && (
                <Button type="button" className="w-full" onClick={() => setIsOpen(false)}>
                    Close
                </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
