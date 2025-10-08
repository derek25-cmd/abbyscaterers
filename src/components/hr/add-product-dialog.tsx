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

export function AddProductDialog({ isOpen, setIsOpen, onAddProduct }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState('');
  const [unitPrice, setUnitPrice] = useState(0);
  const [quantity, setQuantity] = useState(0);
  const [minStock, setMinStock] = useState(0);

  const resetForm = () => {
    setName('');
    setCategory('');
    setUnit('');
    setUnitPrice(0);
    setQuantity(0);
    setMinStock(0);
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
      unitPrice: Number(unitPrice),
      quantity: Number(quantity),
      minStock: Number(minStock),
    });

    resetForm();
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add New Product</DialogTitle>
            <DialogDescription>
              Enter the details for the new product.
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
              <Label htmlFor="unitPrice" className="text-right">Unit Price (TZS)</Label>
              <Input id="unitPrice" type="number" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} className="col-span-3" min="0" />
            </div>
             <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="quantity" className="text-right">Quantity</Label>
              <Input id="quantity" type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="col-span-3" min="0" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="minStock" className="text-right">Min. Stock</Label>
              <Input id="minStock" type="number" value={minStock} onChange={(e) => setMinStock(e.target.value)} className="col-span-3" min="0" />
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
