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
import { BRANCHES } from "@/types";

export function ViewProductDialog({ isOpen, setIsOpen, product }) {
  if (!product) return null;

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS' }).format(amount || 0).replace('TZS', 'TZS ');
  }

  const totalQty = (product.quantity_dar || 0) + (product.quantity_arusha || 0) + (product.quantity_dodoma || 0);

  const getStatusBadge = () => {
    if (totalQty === 0) {
      return <Badge variant="destructive" className="col-span-2">Out of Stock</Badge>;
    } else if (totalQty < product.minStock) {
      return <Badge variant="destructive" className="col-span-2 bg-orange-500/80">Low Stock</Badge>;
    } else {
      return <Badge className="col-span-2 bg-green-500/80">In Stock</Badge>;
    }
  }

  const branchData = [
    { name: 'Dar es Salaam', qty: product.quantity_dar || 0, price: product.unitPrice_dar || 0 },
    { name: 'Arusha', qty: product.quantity_arusha || 0, price: product.unitPrice_arusha || 0 },
    { name: 'Dodoma', qty: product.quantity_dodoma || 0, price: product.unitPrice_dodoma || 0 },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Product Details</DialogTitle>
            <DialogDescription>
              Viewing details for {product.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-3 items-center gap-4">
              <Label className="text-right font-semibold">Product ID</Label>
              <span className="col-span-2 font-mono text-xs">{product.id}</span>
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

            {/* Branch-level breakdown */}
            <div className="border-t pt-4 mt-2">
              <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Branch Stock & Pricing</Label>
              <div className="mt-3 rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-2 font-semibold">Branch</th>
                      <th className="text-right p-2 font-semibold">Quantity</th>
                      <th className="text-right p-2 font-semibold">Unit Price</th>
                      <th className="text-right p-2 font-semibold">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {branchData.map((b) => (
                      <tr key={b.name} className="border-t hover:bg-muted/20">
                        <td className="p-2 font-medium">{b.name}</td>
                        <td className="p-2 text-right font-bold">{b.qty}</td>
                        <td className="p-2 text-right">{formatCurrency(b.price)}</td>
                        <td className="p-2 text-right font-semibold">{formatCurrency(b.qty * b.price)}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 bg-primary/5 font-bold">
                      <td className="p-2">Total</td>
                      <td className="p-2 text-right">{totalQty}</td>
                      <td className="p-2 text-right">—</td>
                      <td className="p-2 text-right text-primary">
                        {formatCurrency(branchData.reduce((sum, b) => sum + b.qty * b.price, 0))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
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
