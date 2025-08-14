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
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

export function EditStockLogDialog({ isOpen, setIsOpen, log, onEditLog, products }) {
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  
  const stockInReasons = ["Vendor Delivery", "Internal Production", "Stock Transfer"];
  const stockOutReasons = ["Customer Order", "Internal Use", "Spoilage", "Breakage", "Stock Transfer"];
  const reasonOptions = log?.type === 'Stock In' ? stockInReasons : stockOutReasons;
  
  useEffect(() => {
    if (log) {
      setProductId(log.productId);
      setQuantity(log.quantity);
      setReason(log.reason);
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

  const handleSubmit = (e) => {
    e.preventDefault();
    if(!productId || !quantity || !reason) {
        alert("Please fill all fields");
        return;
    }

    const product = products.find(p => p.id === productId);

    onEditLog({
      ...log,
      productId,
      productName: product ? product.name : log.productName,
      quantity: Number(quantity),
      reason,
      price: product ? product.unitPrice * Number(quantity) : log.price,
    });

    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Stock Log</DialogTitle>
            <DialogDescription>
              Update the details for the stock log entry.
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
                onChange={(e) => setQuantity(e.target.value)}
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
