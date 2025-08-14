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

export function ViewAssetDialog({ isOpen, setIsOpen, asset }) {
  if (!asset) return null;
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS' }).format(amount).replace('TZS', 'TZS ');
  }
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'In Use':
        return <Badge className="col-span-2 bg-blue-500/20 text-blue-700 hover:bg-blue-500/30 dark:bg-blue-500/10 dark:text-blue-400">In Use</Badge>;
      case 'Available':
        return <Badge className="col-span-2 bg-green-500/20 text-green-700 hover:bg-green-500/30 dark:bg-green-500/10 dark:text-green-400">Available</Badge>;
      case 'Under Maintenance':
        return <Badge className="col-span-2 bg-orange-500/20 text-orange-700 hover:bg-orange-500/30 dark:bg-orange-500/10 dark:text-orange-400">Under Maintenance</Badge>;
      default:
        return <Badge className="col-span-2" variant="outline">{status}</Badge>;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Asset Details</DialogTitle>
            <DialogDescription>
              Viewing details for {asset.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-3 items-center gap-4">
              <Label className="text-right font-semibold">Asset ID</Label>
              <span className="col-span-2">{asset.id}</span>
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
              <Label className="text-right font-semibold">Name</Label>
              <span className="col-span-2">{asset.name}</span>
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
              <Label className="text-right font-semibold">Type</Label>
              <span className="col-span-2">{asset.type}</span>
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
              <Label className="text-right font-semibold">Unit</Label>
              <span className="col-span-2">{asset.unit}</span>
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
              <Label className="text-right font-semibold">Unit Price</Label>
              <span className="col-span-2">{formatCurrency(asset.unitPrice)}</span>
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
              <Label className="text-right font-semibold">Quantity</Label>
              <span className="col-span-2">{asset.quantity}</span>
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
              <Label className="text-right font-semibold">Status</Label>
              {getStatusBadge(asset.status)}
            </div>
             <div className="grid grid-cols-3 items-center gap-4">
              <Label className="text-right font-semibold">Last Maintenance</Label>
              <span className="col-span-2">{asset.lastMaintenance}</span>
            </div>
             <div className="grid grid-cols-3 items-center gap-4">
              <Label className="text-right font-semibold">Next Maintenance</Label>
              <span className="col-span-2">{asset.nextMaintenance}</span>
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
