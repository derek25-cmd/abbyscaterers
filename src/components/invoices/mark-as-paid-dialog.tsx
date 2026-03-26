"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useInvoiceStorage } from "@/hooks/use-invoice-storage";
import { useToast } from "@/hooks/use-toast";
import { calculateGrandTotal } from "@/lib/utils";
import type { Invoice } from "@/types";
import { Loader2 } from "lucide-react";

interface MarkAsPaidDialogProps {
  invoice: Invoice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MarkAsPaidDialog({ invoice, open, onOpenChange }: MarkAsPaidDialogProps) {
  const { updateInvoice } = useInvoiceStorage();
  const { toast } = useToast();
  const [amount, setAmount] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalAmount = invoice ? calculateGrandTotal(invoice) : 0;
  const currentPaid = invoice?.amountPaid || 0;
  const balance = totalAmount - currentPaid;

  useEffect(() => {
    if (open && invoice) {
        // Default to the full remaining balance
        setAmount(balance.toString());
    }
  }, [open, invoice, balance]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice) return;

    const paidNow = parseFloat(amount);
    if (isNaN(paidNow) || paidNow <= 0) {
      toast({ variant: "destructive", title: "Invalid Amount", description: "Please enter a valid amount greater than zero." });
      return;
    }

    if (paidNow > balance) {
        toast({ variant: "destructive", title: "Overpayment", description: `Amount exceeds the remaining balance of ${balance.toLocaleString()} TZS.` });
        return;
    }

    setIsSubmitting(true);
    try {
      const newAmountPaid = currentPaid + paidNow;
      const isFullyPaid = newAmountPaid >= totalAmount;
      const isPartiallyPaid = newAmountPaid > 0 && !isFullyPaid;
      
      const success = await updateInvoice(invoice.id, {
        amountPaid: newAmountPaid,
        status: isFullyPaid ? 'paid' : (isPartiallyPaid ? 'partially paid' : 'outstanding'),
        paymentDate: isFullyPaid ? new Date().toISOString() : invoice.paymentDate,
      });

      if (success) {
        toast({ title: "Payment Recorded", description: `Recorded payment of ${paidNow.toLocaleString()} TZS. Status: ${isFullyPaid ? 'Paid' : 'Partially Paid'}.` });
        onOpenChange(false);
      } else {
        toast({ variant: "destructive", title: "Error", description: "Failed to update invoice payment." });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "An unexpected error occurred." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Mark as Paid</DialogTitle>
            <DialogDescription>
              Record a payment for invoice <strong>{invoice?.id}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Total Amount</Label>
              <div className="col-span-3 font-medium">{totalAmount.toLocaleString()} TZS</div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Already Paid</Label>
              <div className="col-span-3 text-muted-foreground">{currentPaid.toLocaleString()} TZS</div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4 border-t pt-4">
              <Label className="text-right font-semibold">Remaining</Label>
              <div className="col-span-3 font-semibold text-primary">{balance.toLocaleString()} TZS</div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="amount" className="text-right">Pay Amount</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                max={balance}
                className="col-span-3"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {parseFloat(amount) >= balance ? "Mark as Fully Paid" : "Record Partial Payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
