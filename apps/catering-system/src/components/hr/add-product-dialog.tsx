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
import { useState } from "react";
import { BRANCHES } from "@/types";

export function AddProductDialog({ isOpen, setIsOpen, onAddProduct }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState('');
  const [minStock, setMinStock] = useState(0);

  // Per-branch state
  const [qtyDar, setQtyDar] = useState(0);
  const [qtyArusha, setQtyArusha] = useState(0);
  const [qtyDodoma, setQtyDodoma] = useState(0);
  const [priceDar, setPriceDar] = useState(0);
  const [priceArusha, setPriceArusha] = useState(0);
  const [priceDodoma, setPriceDodoma] = useState(0);

  const resetForm = () => {
    setName('');
    setCategory('');
    setUnit('');
    setMinStock(0);
    setQtyDar(0);
    setQtyArusha(0);
    setQtyDodoma(0);
    setPriceDar(0);
    setPriceArusha(0);
    setPriceDodoma(0);
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    if(!name || !category || !unit) {
        alert("Please fill all required fields");
        return;
    }

    onAddProduct({
      name,
      category,
      unit,
      unitPrice: Number(priceDar),
      quantity: Number(qtyDar) + Number(qtyArusha) + Number(qtyDodoma),
      minStock: Number(minStock),
      quantity_dar: Number(qtyDar),
      quantity_arusha: Number(qtyArusha),
      quantity_dodoma: Number(qtyDodoma),
      unitPrice_dar: Number(priceDar),
      unitPrice_arusha: Number(priceArusha),
      unitPrice_dodoma: Number(priceDodoma),
    });

    resetForm();
    setIsOpen(false);
  };

  const branchFields = [
    { label: 'Dar es Salaam', qty: qtyDar, setQty: setQtyDar, price: priceDar, setPrice: setPriceDar },
    { label: 'Arusha', qty: qtyArusha, setQty: setQtyArusha, price: priceArusha, setPrice: setPriceArusha },
    { label: 'Dodoma', qty: qtyDodoma, setQty: setQtyDodoma, price: priceDodoma, setPrice: setPriceDodoma },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add New Product</DialogTitle>
            <DialogDescription>
              Enter the details for the new product. Set quantities and prices per branch.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="category" className="text-right">Type</Label>
               <Select onValueChange={setCategory} value={category}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select a type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Herbes & Spices">Herbes & Spices</SelectItem>
                  <SelectItem value="Fruits">Fruits</SelectItem>
                  <SelectItem value="Vegetables">Vegetables</SelectItem>
                  <SelectItem value="Starch">Starch</SelectItem>
                  <SelectItem value="Protein">Protein</SelectItem>
                  <SelectItem value="Ingredients">Ingredients</SelectItem>
                  <SelectItem value="Cereal">Cereal</SelectItem>
                  <SelectItem value="Packaging">Packaging</SelectItem>
                  <SelectItem value="Heating">Heating</SelectItem>
                  <SelectItem value="Cleaning">Cleaning</SelectItem>
                  <SelectItem value="Tableware">Tableware</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="unit" className="text-right">Unit</Label>
              <Select onValueChange={setUnit} value={unit}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select a unit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pcs">pcs</SelectItem>
                  <SelectItem value="kg">kg</SelectItem>
                  <SelectItem value="liters">liters</SelectItem>
                  <SelectItem value="packs">packs</SelectItem>
                  <SelectItem value="gallons">gallons</SelectItem>
                  <SelectItem value="buckets">buckets</SelectItem>
                  <SelectItem value="drums">drums</SelectItem>
                  <SelectItem value="bottles">bottles</SelectItem>
                  <SelectItem value="cartons">cartons</SelectItem>
                  <SelectItem value="packets">packets</SelectItem>
                  <SelectItem value="tins">tins</SelectItem>
                  <SelectItem value="bags">bags</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="minStock" className="text-right">Min. Stock</Label>
              <Input id="minStock" type="number" step="any" value={minStock} onChange={(e) => setMinStock(e.target.value)} className="col-span-3" min="0" />
            </div>

            {/* Per-branch quantities and prices */}
            <div className="border-t pt-4 mt-2">
              <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Branch Quantities & Prices</Label>
              <div className="mt-3 space-y-3">
                {branchFields.map((b) => (
                  <div key={b.label} className="grid grid-cols-5 items-center gap-2 p-3 bg-muted/30 rounded-lg border">
                    <Label className="text-xs font-bold col-span-1">{b.label}</Label>
                    <div className="col-span-2">
                      <Label className="text-[10px] text-muted-foreground">Quantity</Label>
                      <Input type="number" step="any" value={b.qty} onChange={(e) => b.setQty(e.target.value)} min="0" />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-[10px] text-muted-foreground">Unit Price (TZS)</Label>
                      <Input type="number" step="any" value={b.price} onChange={(e) => b.setPrice(e.target.value)} min="0" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" onClick={() => resetForm()}>Cancel</Button>
            </DialogClose>
            <Button type="submit">Add Product</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
