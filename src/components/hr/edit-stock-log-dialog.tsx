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
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";


export function EditStockLogDialog({ isOpen, setIsOpen, log, onEditLog, products }) {
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState('');
  const [orderId, setOrderId] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [date, setDate] = useState('');
  const [actualUnitPrice, setActualUnitPrice] = useState(0);
  const { orders } = useOrderStorage();

  const stockInReasons = ["Vendor Delivery", "Internal Production", "Stock Transfer"];
  const stockOutReasons = ["Customer Order", "Internal Use", "Spoilage", "Breakage", "Stock Transfer"];
  const reasonOptions = log?.type === 'Stock In' ? stockInReasons : stockOutReasons;
  
  useEffect(() => {
    if (log) {
      setProductId(log.productId);
      setQuantity(log.quantity);
      setDate(log.date);
      setActualUnitPrice(log.actual_unit_price || 0);

      if (log.reason && log.reason.startsWith('Customer Order: ')) {
        const parts = log.reason.split(': ');
        setReason('Customer Order');
        setOrderId(parts[1] || '');
      } else {
        setReason(log.reason);
        setOrderId('');
      }
    }
  }, [log]);

  useEffect(() => {
    if(productId) {
      const product = products.find(p => p.id === productId);
      setSelectedProduct(product);
    } else {
      setSelectedProduct(null);
    }
  }, [productId, products]);

  const relevantOrders = useMemo(() => {
    if (reason !== 'Customer Order') return [];
    return orders;
  }, [reason, orders]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if(!productId || !quantity || !reason || (reason === 'Customer Order' && !orderId)) {
        alert("Please fill all fields");
        return;
    }

    let finalReason = reason;
    if (reason === 'Customer Order' && orderId) {
        finalReason = `Customer Order: ${orderId}`;
    }

    const product = products.find(p => p.id === productId);

    onEditLog({
      ...log,
      productId,
      productName: product ? product.name : log.productName,
      quantity: Number(quantity),
      reason: finalReason,
      actual_unit_price: Number(actualUnitPrice),
      date,
    });

    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-2xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Stock Log</DialogTitle>
            <DialogDescription>
              Update the details for the stock log entry.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
                <Label htmlFor="date">Date</Label>
                <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="product">
                Product
              </Label>
               <Popover>
                    <PopoverTrigger asChild>
                        <Button
                        variant="outline"
                        role="combobox"
                        className={cn(
                            "w-full justify-between",
                            !productId && "text-muted-foreground"
                        )}
                        >
                        {productId
                            ? products.find(
                                (p) => p.id === productId
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
                            {products.map((p) => (
                                <CommandItem
                                value={`${p.name} (${p.id})`}
                                key={p.id}
                                onSelect={() => setProductId(p.id)}
                                >
                                <Check
                                    className={cn(
                                    "mr-2 h-4 w-4",
                                    p.id === productId ? "opacity-100" : "opacity-0"
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

            {selectedProduct && (
                <Card className="bg-muted/50 p-3 text-sm">
                    <CardHeader className="p-0 pb-2">
                        <CardTitle className="text-base">{selectedProduct.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 grid grid-cols-2 gap-4">
                        <p><strong>Current Stock:</strong> {selectedProduct.quantity} {selectedProduct.unit}</p>
                        <p><strong>Catalog Price:</strong> {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS' }).format(selectedProduct.unitPrice).replace('TZS', 'TZS ')}</p>
                    </CardContent>
                </Card>
            )}

            <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                    <Label htmlFor="quantity">
                        Quantity
                    </Label>
                    <Input
                        id="quantity"
                        type="number"
                        step="any"
                        value={quantity}
                        onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                        min="0.01"
                    />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="actual_unit_price">
                        Unit Price
                    </Label>
                    <Input
                        id="actual_unit_price"
                        type="number"
                        value={actualUnitPrice}
                        onChange={(e) => setActualUnitPrice(Number(e.target.value))}
                        min="0"
                        step="any"
                    />
                </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="reason">
                Reason
              </Label>
              <Select onValueChange={setReason} value={reason}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  {reasonOptions.map(r => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

             {reason === 'Customer Order' && (
                <div className="grid gap-2">
                    <Label htmlFor="order">
                        Order
                    </Label>
                    <Select onValueChange={setOrderId} value={orderId}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select a customer order" />
                        </SelectTrigger>
                        <SelectContent>
                            {relevantOrders.map(o => (
                                <SelectItem key={o.id} value={o.id}>{o.name} ({o.id})</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit">Save Changes</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
