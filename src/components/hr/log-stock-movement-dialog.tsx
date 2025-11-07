
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
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { useOrderStorage } from "@/hooks/use-order-storage";
import { PlusCircle, Trash2, Check, ChevronsUpDown, ArrowRight } from "lucide-react";
import { ScrollArea } from "../ui/scroll-area";
import { Popover, PopoverTrigger, PopoverContent } from "../ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../ui/command";
import { cn } from "@/lib/utils";

export function LogStockMovementDialog({ isOpen, setIsOpen, logType, onLogMovement, products }) {
  const [items, setItems] = useState([{ productId: '', quantity: 1, reason: '', orderId: '', actual_unit_price: 0 }]);
  const { orders } = useOrderStorage();
  
  const stockInReasons = ["Vendor Delivery", "Internal Production", "Stock Transfer"];
  const stockOutReasons = ["Customer Order", "Internal Use", "Spoilage", "Breakage", "Stock Transfer"];
  const reasonOptions = logType === 'Stock In' ? stockInReasons : stockOutReasons;

  useEffect(() => {
    if (isOpen) {
        setItems([{ productId: '', quantity: 1, reason: '', orderId: '', actual_unit_price: 0 }]);
    }
  }, [isOpen]);

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    
    if (field === 'productId') {
        const product = getProduct(value);
        if (product) {
            newItems[index]['actual_unit_price'] = product.unitPrice;
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
  
  const handleSubmit = (e) => {
    e.preventDefault();
    
    const validItems = items.filter(item => item.productId && item.quantity > 0 && item.reason && item.actual_unit_price >= 0);
    if (validItems.length === 0) {
        alert("Please add at least one valid item to log.");
        return;
    }

    validItems.forEach(item => {
      let finalReason = item.reason;
      if (item.reason === 'Customer Order' && item.orderId) {
          finalReason = `Customer Order: ${item.orderId}`;
      }
      const product = getProduct(item.productId);
      onLogMovement({
        productId: item.productId,
        productName: product?.name || 'Unknown',
        type: logType,
        reason: finalReason,
        quantity: Number(item.quantity),
        price: Number(item.actual_unit_price) * Number(item.quantity),
        actual_unit_price: Number(item.actual_unit_price),
      });
    });

    setIsOpen(false);
  };
  
  const getProduct = (productId) => products.find(p => p.id === productId);

  const formatCurrency = (amount) => {
    if (typeof amount !== 'number') return 'TZS 0.00';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS' }).format(amount).replace('TZS', 'TZS ');
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent 
        className="sm:max-w-3xl"
        onInteractOutside={(e) => {
            e.preventDefault();
        }}
        >
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{logType}</DialogTitle>
            <DialogDescription>
              Log one or more stock movements into the inventory.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[60vh] p-1">
          <div className="space-y-4 py-4">
            {items.map((item, index) => {
                const product = getProduct(item.productId);
                const catalogPrice = product?.unitPrice || 0;
                const priceVariation = item.actual_unit_price - catalogPrice;

               return (
               <Card key={index} className="relative p-4 bg-muted/50">
                {items.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 text-destructive" onClick={() => removeItem(index)}>
                        <Trash2 className="h-4 w-4"/>
                    </Button>
                )}
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div>
                        <Label>Product</Label>
                         <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                variant="outline"
                                role="combobox"
                                className={cn(
                                    "w-full justify-between",
                                    !item.productId && "text-muted-foreground"
                                )}
                                >
                                {item.productId
                                    ? products.find(
                                        (p) => p.id === item.productId
                                    )?.name
                                    : "Select product"}
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
                                        {p.name} (Qty: {p.quantity})
                                        </CommandItem>
                                    ))}
                                    </CommandGroup>
                                </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                     </div>
                     <div>
                        <Label>Quantity</Label>
                        <Input type="number" step="any" value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', e.target.value)} min="0.01" max={logType === 'Stock Out' ? getProduct(item.productId)?.quantity : undefined } />
                     </div>
                 </div>
                 
                {product && (
                    <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div className="p-2 bg-background/50 rounded-md">
                            <p className="font-semibold text-muted-foreground">Type</p>
                            <p>{product.category}</p>
                        </div>
                         <div className="p-2 bg-background/50 rounded-md">
                            <p className="font-semibold text-muted-foreground">Stock Qty</p>
                            <p>{product.quantity} {product.unit}</p>
                        </div>
                        <div className="p-2 bg-background/50 rounded-md">
                            <p className="font-semibold text-muted-foreground">Catalog Price</p>
                            <p>{formatCurrency(product.unitPrice)}</p>
                        </div>
                         <div className="p-2 bg-background/50 rounded-md">
                            <p className="font-semibold text-muted-foreground">Total Value</p>
                            <p>{formatCurrency(item.actual_unit_price * item.quantity)}</p>
                        </div>
                    </div>
                )}


                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div>
                        <Label>Reason</Label>
                        <Select onValueChange={(value) => handleItemChange(index, 'reason', value)} value={item.reason}>
                          <SelectTrigger><SelectValue placeholder="Select a reason" /></SelectTrigger>
                          <SelectContent>
                            {reasonOptions.map(r => (<SelectItem key={r} value={r}>{r}</SelectItem>))}
                          </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label>Actual Price (per unit)</Label>
                        <Input type="number" value={item.actual_unit_price} onChange={(e) => handleItemChange(index, 'actual_unit_price', e.target.value)} min="0" step="any" />
                    </div>
                 </div>

                 {item.reason === 'Customer Order' && (
                     <div className="mt-4">
                        <Label>Customer Order</Label>
                        <Select onValueChange={(value) => handleItemChange(index, 'orderId', value)} value={item.orderId}>
                            <SelectTrigger><SelectValue placeholder="Select an order" /></SelectTrigger>
                            <SelectContent>
                                {orders.map(o => (<SelectItem key={o.id} value={o.id}>{o.name} ({o.id})</SelectItem>))}
                            </SelectContent>
                        </Select>
                     </div>
                 )}

                 {product && (
                    <div className="mt-4 p-2 bg-blue-500/10 rounded-md text-center">
                        <p className="text-sm font-semibold text-blue-800">
                            Price Variation: 
                            <span className={cn("ml-2 font-bold", priceVariation > 0 ? "text-destructive" : "text-green-600")}>
                                {priceVariation !== 0 && (priceVariation > 0 ? '+' : '')}{formatCurrency(priceVariation)}
                            </span>
                        </p>
                    </div>
                 )}
               </Card>
               )
            })}
             <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add Another Product
              </Button>
          </div>
          </ScrollArea>
          <DialogFooter className="pt-4">
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit">Log Movements</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
