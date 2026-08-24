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
              Viewing details for log entry <span className="font-mono text-xs">{log.id}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
             <div className="grid grid-cols-3 items-center gap-4">
              <Label className="text-right font-semibold">Branch</Label>
              <Badge variant="outline" className="col-span-2 w-fit">{log.branch || 'Dar es Salaam'}</Badge>
            </div>
             <div className="grid grid-cols-3 items-center gap-4">
              <Label className="text-right font-semibold">Product</Label>
              <div className="col-span-2">
                <div className="font-medium">{log.productName}</div>
                <div className="text-xs font-mono text-muted-foreground">{log.productId}</div>
              </div>
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
              <Label className="text-right font-semibold">Type</Label>
              <span className="col-span-2">{log.type}</span>
            </div>
             <div className="grid grid-cols-3 items-center gap-4">
              <Label className="text-right font-semibold">Quantity</Label>
              <span className="col-span-2 font-bold">{log.quantity}</span>
            </div>
             <div className="grid grid-cols-3 items-center gap-4">
               <Label className="text-right font-semibold">Total Price</Label>
               <span className="col-span-2 font-semibold">{formatCurrency(log.price)}</span>
             </div>
             {log.actual_unit_price > 0 && (
               <div className="grid grid-cols-3 items-center gap-4">
                 <Label className="text-right font-semibold">Unit Price</Label>
                 <span className="col-span-2">{formatCurrency(log.actual_unit_price)}</span>
               </div>
             )}
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
              <Badge variant="default" className={`col-span-2 w-fit ${log.status === 'Stock In' ? 'bg-green-500/80' : 'bg-red-500/80'}`}>
                {log.status || log.type}
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
