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

export function ViewStockLogDialog({ isOpen, setIsOpen, log }) {
  if (!log) return null;

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS' }).format(amount).replace('TZS', 'TZS ');
  }
  
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Stock Log Details</DialogTitle>
            <DialogDescription>
              Viewing details for log entry {log.id}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-3 items-center gap-4">
              <Label className="text-right font-semibold">Stock Issue ID</Label>
              <span className="col-span-2">{log.id}</span>
            </div>
             <div className="grid grid-cols-3 items-center gap-4">
              <Label className="text-right font-semibold">Product</Label>
              <div className="col-span-2">
                <div className="font-medium">{log.productName}</div>
                <div className="text-sm text-muted-foreground">{log.productId}</div>
              </div>
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
              <Label className="text-right font-semibold">Type</Label>
              <span className="col-span-2">{log.type}</span>
            </div>
             <div className="grid grid-cols-3 items-center gap-4">
              <Label className="text-right font-semibold">Quantity</Label>
              <span className="col-span-2">{log.quantity}</span>
            </div>
             <div className="grid grid-cols-3 items-center gap-4">
              <Label className="text-right font-semibold">Price (TZS)</Label>
              <span className="col-span-2">{formatCurrency(log.price)}</span>
            </div>
             <div className="grid grid-cols-3 items-center gap-4">
              <Label className="text-right font-semibold">Reason</Label>
              <span className="col-span-2">{log.reason}</span>
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
              <Label className="text-right font-semibold">Date</Label>
              <span className="col-span-2">{log.date}</span>
            </div>
             <div className="grid grid-cols-3 items-center gap-4">
              <Label className="text-right font-semibold">Status</Label>
              <Badge variant={log.status === 'Stock In' ? 'default' : 'secondary'} className={`col-span-2 ${log.status === 'Stock In' ? 'bg-green-500/80' : 'bg-red-500/80'}`}>
                {log.status}
              </Badge>
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
