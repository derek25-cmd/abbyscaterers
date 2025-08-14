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

export function ViewIssuanceDialog({ isOpen, setIsOpen, logEntry }) {
  if (!logEntry) return null;

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS' }).format(amount).replace('TZS', 'TZS ');
  }

  const getStatusBadge = (status: string) => {
      switch (status) {
        case 'Issued':
          return <Badge className="col-span-2 bg-orange-500/20 text-orange-700 hover:bg-orange-500/30 dark:bg-orange-500/10 dark:text-orange-400">Issued</Badge>;
        case 'Returned':
          return <Badge className="col-span-2 bg-green-500/20 text-green-700 hover:bg-green-500/30 dark:bg-green-500/10 dark:text-green-400">Returned</Badge>;
        default:
          return <Badge className="col-span-2" variant="outline">{status}</Badge>;
      }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Issuance Details</DialogTitle>
            <DialogDescription>
              Viewing details for issuance {logEntry.id}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-3 items-center gap-4">
              <Label className="text-right font-semibold">Issue ID</Label>
              <span className="col-span-2">{logEntry.id}</span>
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
              <Label className="text-right font-semibold">Asset Name</Label>
              <span className="col-span-2">{logEntry.name}</span>
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
              <Label className="text-right font-semibold">Asset ID</Label>
              <span className="col-span-2 text-muted-foreground">{logEntry.assetId}</span>
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
              <Label className="text-right font-semibold">Issued To</Label>
              <span className="col-span-2">{logEntry.issuedTo}</span>
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
              <Label className="text-right font-semibold">Type</Label>
              <span className="col-span-2">{logEntry.type}</span>
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
              <Label className="text-right font-semibold">Unit</Label>
              <span className="col-span-2">{logEntry.unit}</span>
            </div>
             <div className="grid grid-cols-3 items-center gap-4">
              <Label className="text-right font-semibold">Unit Price</Label>
              <span className="col-span-2">{formatCurrency(logEntry.unitPrice)}</span>
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
              <Label className="text-right font-semibold">Quantity</Label>
              <span className="col-span-2">{logEntry.quantity}</span>
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
              <Label className="text-right font-semibold">Date</Label>
              <span className="col-span-2">{logEntry.date}</span>
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
              <Label className="text-right font-semibold">Status</Label>
              {getStatusBadge(logEntry.status)}
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
