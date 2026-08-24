"use client";

import { useForm } from "react-hook-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";

export interface PaymentStatusFormData {
    status: 'outstanding' | 'paid' | 'partially paid';
    amountPaid: number;
    paymentDate?: string;
}

interface PaymentStatusDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onSubmit: (data: PaymentStatusFormData) => Promise<void>;
  isUpdating: boolean;
  currentStatus: 'outstanding' | 'paid' | 'partially paid';
  currentAmountPaid: number;
  totalAmount: number;
}

export function PaymentStatusDialog({ isOpen, setIsOpen, onSubmit, isUpdating, currentStatus, currentAmountPaid, totalAmount }: PaymentStatusDialogProps) {
    const form = useForm<PaymentStatusFormData>({
        defaultValues: {
            status: currentStatus || 'outstanding',
            amountPaid: currentAmountPaid || 0,
            paymentDate: new Date().toISOString().split('T')[0]
        }
    });

    useEffect(() => {
        if(isOpen) {
            form.reset({
                status: currentStatus || 'outstanding',
                amountPaid: currentAmountPaid || 0,
                paymentDate: new Date().toISOString().split('T')[0]
            })
        }
    }, [isOpen, currentStatus, currentAmountPaid, form]);

    const statusValue = form.watch('status');

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Update Payment Status</DialogTitle>
                    <DialogDescription>Invoice Total: {totalAmount.toLocaleString('en-US', { style: 'currency', currency: 'TZS', currencyDisplay: 'code' })}</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField control={form.control} name="status" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Status</FormLabel>
                                <Select onValueChange={(val: any) => {
                                    field.onChange(val);
                                    if(val === 'paid') form.setValue('amountPaid', totalAmount);
                                    if(val === 'outstanding') form.setValue('amountPaid', 0);
                                }} defaultValue={field.value} value={field.value}>
                                    <FormControl>
                                        <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="outstanding">Outstanding</SelectItem>
                                        <SelectItem value="partially paid">Partially Paid</SelectItem>
                                        <SelectItem value="paid">Paid</SelectItem>
                                    </SelectContent>
                                </Select>
                            </FormItem>
                        )} />

                        {statusValue !== 'outstanding' && (
                            <>
                                <FormField control={form.control} name="amountPaid" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Amount Paid (TZS)</FormLabel>
                                        <FormControl>
                                            <Input type="number" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} />
                                        </FormControl>
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="paymentDate" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Payment Date</FormLabel>
                                        <FormControl>
                                            <Input type="date" {...field} />
                                        </FormControl>
                                    </FormItem>
                                )} />
                            </>
                        )}

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={isUpdating}>Cancel</Button>
                            <Button type="submit" disabled={isUpdating}>
                                {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Status
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
