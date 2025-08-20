
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "./ui/scroll-area";
import { useState, useEffect } from "react";

export function ReturnIssuanceDialog({ isOpen, setIsOpen, logEntry, onReturnIssuance }) {
    const [returnedItems, setReturnedItems] = useState({});

    useEffect(() => {
        if (logEntry?.items) {
            const initialReturns = {};
            logEntry.items.forEach(item => {
                // Initialize with the remaining quantity to be returned
                initialReturns[item.assetId] = 0;
            });
            setReturnedItems(initialReturns);
        }
    }, [logEntry]);

    const handleQuantityChange = (assetId, value) => {
        const item = logEntry.items.find(i => i.assetId === assetId);
        const maxReturnable = item.quantityIssued - (item.quantityReturned || 0);
        const returnedValue = Math.max(0, Math.min(Number(value), maxReturnable));
        
        setReturnedItems(prev => ({
            ...prev,
            [assetId]: returnedValue,
        }));
    };
    
    const handleSubmit = (e) => {
        e.preventDefault();
        onReturnIssuance(logEntry.id, returnedItems);
        setIsOpen(false);
    };

    if (!logEntry) return null;

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="sm:max-w-xl">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Return Assets</DialogTitle>
                        <DialogDescription>
                            Enter the quantity of each item being returned for issuance #{logEntry.id}.
                        </DialogDescription>
                    </DialogHeader>
                    <ScrollArea className="max-h-[60vh] p-4">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Asset Name</TableHead>
                                    <TableHead className="text-center">Issued</TableHead>
                                    <TableHead className="text-center">Already Returned</TableHead>
                                    <TableHead className="text-center">Qty to Return</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {logEntry.items.map(item => {
                                    const alreadyReturned = item.quantityReturned || 0;
                                    const maxReturnable = item.quantityIssued - alreadyReturned;
                                    return (
                                        <TableRow key={item.assetId}>
                                            <TableCell>{item.name}</TableCell>
                                            <TableCell className="text-center">{item.quantityIssued}</TableCell>
                                            <TableCell className="text-center">{alreadyReturned}</TableCell>
                                            <TableCell>
                                                <Input 
                                                    type="number" 
                                                    min="0"
                                                    max={maxReturnable}
                                                    value={returnedItems[item.assetId] || 0}
                                                    onChange={(e) => handleQuantityChange(item.assetId, e.target.value)}
                                                    className="text-center"
                                                    disabled={maxReturnable === 0}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                    <DialogFooter className="pt-4">
                        <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                        <Button type="submit">Submit Return</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
