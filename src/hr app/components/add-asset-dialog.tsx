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

export function AddAssetDialog({ isOpen, setIsOpen, onAddAsset }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [unit, setUnit] = useState('pcs');
  const [unitPrice, setUnitPrice] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [status, setStatus] = useState('Available');
  const [lastMaintenance, setLastMaintenance] = useState('');
  const [nextMaintenance, setNextMaintenance] = useState('');

  const resetForm = () => {
    setName('');
    setType('');
    setUnit('pcs');
    setUnitPrice(0);
    setQuantity(1);
    setStatus('Available');
    setLastMaintenance('');
    setNextMaintenance('');
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    if(!name || !type) {
        alert("Please fill all required fields");
        return;
    }

    onAddAsset({
      name,
      type,
      unit,
      unitPrice: Number(unitPrice),
      quantity: Number(quantity),
      status,
      lastMaintenance: lastMaintenance || 'N/A',
      nextMaintenance: nextMaintenance || 'N/A',
    });

    resetForm();
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add New Asset</DialogTitle>
            <DialogDescription>
              Enter the details for the new asset.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="type" className="text-right">Type</Label>
               <Select onValueChange={setType} value={type}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select a type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Vehicle">Vehicle</SelectItem>
                  <SelectItem value="Kitchen Equipment">Kitchen Equipment</SelectItem>
                  <SelectItem value="Service Utensil">Service Utensil</SelectItem>
                  <SelectItem value="Event Equipment">Event Equipment</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
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
                  <SelectItem value="sets">sets</SelectItem>
                  <SelectItem value="kg">kg</SelectItem>
                  <SelectItem value="liters">liters</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="unitPrice" className="text-right">Unit Price (TZS)</Label>
              <Input id="unitPrice" type="number" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} className="col-span-3" min="0" />
            </div>
             <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="quantity" className="text-right">Quantity</Label>
              <Input id="quantity" type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="col-span-3" min="1" />
            </div>
             <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="status" className="text-right">Status</Label>
               <Select onValueChange={setStatus} value={status}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select a status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Available">Available</SelectItem>
                  <SelectItem value="In Use">In Use</SelectItem>
                  <SelectItem value="Under Maintenance">Under Maintenance</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="lastMaintenance" className="text-right">Last Maintenance</Label>
              <Input id="lastMaintenance" type="date" value={lastMaintenance} onChange={(e) => setLastMaintenance(e.target.value)} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="nextMaintenance" className="text-right">Next Maintenance</Label>
              <Input id="nextMaintenance" type="date" value={nextMaintenance} onChange={(e) => setNextMaintenance(e.target.value)} className="col-span-3" />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" onClick={() => resetForm()}>Cancel</Button>
            </DialogClose>
            <Button type="submit">Add Asset</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
