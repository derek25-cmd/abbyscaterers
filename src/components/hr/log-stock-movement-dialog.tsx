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

export function LogStockMovementDialog({ isOpen, setIsOpen, logType, onLogMovement, products }) {
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [orderId, setOrderId] = useState('');
  const { orders } = useOrderStorage();
  
  const stockInReasons = ["Vendor Delivery", "Internal Production", "Stock Transfer"];
  const stockOutReasons = ["Customer Order", "Internal Use", "Spoilage", "Breakage", "Stock Transfer"];
  const reasonOptions = logType === 'Stock In' ? stockInReasons : stockOutReasons;
  
  useEffect(() => {
    if(productId) {
      const product = products.find(p => p.id === productId);
      setSelectedProduct(product);
    } else {
      setSelectedProduct(null);
    }
  }, [productId, products]);

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
        setProductId('');
        setQuantity(1);
        setReason('');
        setOrderId('');
        setSelectedProduct(null);
    }
  }, [isOpen]);
  
  const relevantOrders = useMemo(() => {
      if(reason !== 'Customer Order') return [];
      return orders; // In a real scenario, you might filter this more
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

    onLogMovement({
      productId,
      type: logType,
      reason: finalReason,
      quantity: Number(quantity),
    });

    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{logType}</DialogTitle>
            <DialogDescription>
              Log a new stock movement into the inventory.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="product" className="text-right">
                Product
              </Label>
              <Select onValueChange={setProductId} value={productId}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select a product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name} ({p.id})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedProduct && (
                <Card className="col-span-4 bg-muted/50 p-3 text-sm">
                    <CardHeader className="p-0 pb-2">
                        <CardTitle className="text-base">{selectedProduct.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <p><strong>Current Stock:</strong> {selectedProduct.quantity} {selectedProduct.unit}</p>
                        <p><strong>Unit Price:</strong> {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS' }).format(selectedProduct.unitPrice).replace('TZS', 'TZS ')}</p>
                    </CardContent>
                </Card>
            )}

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="quantity" className="text-right">
                Quantity
              </Label>
              <Input
                id="quantity"
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="col-span-3"
                min="1"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="reason" className="text-right">
                Reason
              </Label>
              <Select onValueChange={setReason} value={reason}>
                <SelectTrigger className="col-span-3">
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
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="order" className="text-right">
                        Order
                    </Label>
                    <Select onValueChange={setOrderId} value={orderId}>
                        <SelectTrigger className="col-span-3">
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
            <Button type="submit">Log Movement</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
