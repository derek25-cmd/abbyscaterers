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
import { Label } from "@/components/ui/label";
import { Badge } from "./ui/badge";

export function ViewProductDialog({ isOpen, setIsOpen, product }) {
  if (!product) return null;

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS' }).format(amount).replace('TZS', 'TZS ');
  }

  const getStatusBadge = () => {
    if (product.quantity === 0) {
      return <Badge variant="destructive" className="col-span-2">Out of Stock</Badge>;
    } else if (product.quantity < product.minStock) {
      return <Badge variant="destructive" className="col-span-2 bg-orange-500/80">Low Stock</Badge>;
    } else {
      return <Badge className="col-span-2 bg-green-500/80">In Stock</Badge>;
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Product Details</DialogTitle>
            <DialogDescription>
              Viewing details for {product.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-3 items-center gap-4">
              <Label className="text-right font-semibold">Product ID</Label>
              <span className="col-span-2">{product.id}</span>
            </div>
             <div className="grid grid-cols-3 items-center gap-4">
              <Label className="text-right font-semibold">SKU</Label>
              <span className="col-span-2">{product.sku}</span>
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
              <Label className="text-right font-semibold">Name</Label>
              <span className="col-span-2">{product.name}</span>
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
              <Label className="text-right font-semibold">Type</Label>
              <span className="col-span-2">{product.category}</span>
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
              <Label className="text-right font-semibold">Unit</Label>
              <span className="col-span-2">{product.unit}</span>
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
              <Label className="text-right font-semibold">Unit Price</Label>
              <span className="col-span-2">{formatCurrency(product.unitPrice)}</span>
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
              <Label className="text-right font-semibold">Quantity</Label>
              <span className="col-span-2">{product.quantity}</span>
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
              <Label className="text-right font-semibold">Min Stock</Label>
              <span className="col-span-2">{product.minStock}</span>
            </div>
             <div className="grid grid-cols-3 items-center gap-4">
              <Label className="text-right font-semibold">Status</Label>
              {getStatusBadge()}
            </div>
             <div className="grid grid-cols-3 items-center gap-4">
              <Label className="text-right font-semibold">Expiry Date</Label>
              <span className="col-span-2">{product.expiryDate || "N/A"}</span>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Close</Button>
            </DialogClose>
          </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
