
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
import { BRANCHES } from "@/types";

export function TransferAssetDialog({ isOpen, setIsOpen, assets, onTransferAsset }) {
  const [assetId, setAssetId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [toBranch, setToBranch] = useState('');
  const [selectedAsset, setSelectedAsset] = useState(null);

  useEffect(() => {
    if (assetId) {
        setSelectedAsset(assets.find(a => a.id === assetId));
    } else {
        setSelectedAsset(null);
    }
  }, [assetId, assets]);
  
  const resetForm = () => {
    setAssetId('');
    setQuantity(1);
    setToBranch('');
    setSelectedAsset(null);
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    if(!assetId || !toBranch || quantity <= 0) {
        alert("Please fill all required fields");
        return;
    }
    if (selectedAsset.branch === toBranch) {
        alert("Source and destination branches cannot be the same.");
        return;
    }
     if (quantity > selectedAsset.quantity) {
        alert("Transfer quantity cannot be greater than available quantity.");
        return;
    }

    onTransferAsset({
      assetId,
      quantity: Number(quantity),
      fromBranch: selectedAsset.branch,
      toBranch,
    });

    resetForm();
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Transfer Asset</DialogTitle>
            <DialogDescription>
              Move assets between branches.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="asset" className="text-right">Asset</Label>
               <Select onValueChange={setAssetId} value={assetId}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select an asset to transfer" />
                </SelectTrigger>
                <SelectContent>
                  {assets.map(asset => <SelectItem key={asset.id} value={asset.id}>{asset.name} ({asset.branch}) - Qty: {asset.quantity}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
             <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="quantity" className="text-right">Quantity</Label>
              <Input id="quantity" type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="col-span-3" min="1" max={selectedAsset?.quantity} />
            </div>
            {selectedAsset && (
                 <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="fromBranch" className="text-right">From</Label>
                  <Input id="fromBranch" value={selectedAsset.branch} disabled className="col-span-3" />
                </div>
            )}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="toBranch" className="text-right">To</Label>
               <Select onValueChange={setToBranch} value={toBranch}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select destination branch" />
                </SelectTrigger>
                <SelectContent>
                  {BRANCHES.filter(b => b !== selectedAsset?.branch).map(branch => <SelectItem key={branch} value={branch}>{branch}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" onClick={() => resetForm()}>Cancel</Button>
            </DialogClose>
            <Button type="submit">Transfer Asset</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
