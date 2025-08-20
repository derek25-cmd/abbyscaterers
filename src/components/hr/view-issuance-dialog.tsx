

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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { useReactToPrint } from 'react-to-print';
import { useRef } from 'react';

export function ViewIssuanceDialog({ isOpen, setIsOpen, logEntry, employee, order }) {
  const printRef = useRef();

  if (!logEntry) return null;

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `Issuance_Note_${logEntry.id}`,
  });
  
  const getFullName = (emp) => {
    if (!emp) return 'N/A';
    return [emp.firstName, emp.middleName, emp.lastName].filter(Boolean).join(' ');
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS' }).format(amount).replace('TZS', 'TZS ');
  }

  const getStatusBadge = (status) => {
      switch (status) {
        case 'Issued':
          return <Badge className="bg-orange-500/20 text-orange-700">{status}</Badge>;
        case 'Returned':
          return <Badge className="bg-green-500/20 text-green-700">{status}</Badge>;
        case 'Partially Returned':
            return <Badge variant="destructive" className="bg-yellow-500/20 text-yellow-700">{status}</Badge>;
        case 'Incomplete':
            return <Badge variant="destructive">{status}</Badge>;
        default:
          return <Badge variant="outline">{status}</Badge>;
      }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-2xl">
          <div ref={printRef} className="p-4 print-only:p-0">
            <DialogHeader>
              <DialogTitle className="text-2xl">Issuance Note</DialogTitle>
              <DialogDescription>
                Details for issuance {logEntry.id}.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <Label className="font-semibold">Issue ID:</Label>
                        <p>{logEntry.id}</p>
                    </div>
                    <div>
                        <Label className="font-semibold">Date:</Label>
                        <p>{logEntry.date}</p>
                    </div>
                    <div>
                        <Label className="font-semibold">Issued To:</Label>
                        <p>{logEntry.issuedTo}</p>
                    </div>
                    <div>
                        <Label className="font-semibold">Client Order:</Label>
                        <p>{logEntry.order?.name || 'N/A'} ({logEntry.orderId})</p>
                    </div>
                     <div>
                        <Label className="font-semibold">Status:</Label>
                        <div>{getStatusBadge(logEntry.status)}</div>
                    </div>
                </div>
              <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Asset Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Issued</TableHead>
                        <TableHead className="text-right">Returned</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead className="text-right">Total Value</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {logEntry.items?.map((item, index) => (
                        <TableRow key={index}>
                            <TableCell>{item.name}</TableCell>
                            <TableCell>{item.type}</TableCell>
                            <TableCell className="text-right">{item.quantityIssued}</TableCell>
                            <TableCell className="text-right">{item.quantityReturned || 0}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.unitPrice * item.quantityIssued)}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
                <TableFooter>
                    <TableRow>
                        <TableCell colSpan={5} className="text-right font-bold text-lg">Grand Total Value</TableCell>
                        <TableCell className="text-right font-bold text-lg">{formatCurrency(logEntry.totalValue)}</TableCell>
                    </TableRow>
                </TableFooter>
              </Table>
              {logEntry.notes && (
                <div>
                    <Label className="font-semibold">Notes:</Label>
                    <p className="text-sm p-2 border rounded-md bg-muted">{logEntry.notes}</p>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="print:hidden">
            <Button type="button" variant="outline" onClick={handlePrint}>Export as PDF</Button>
            <DialogClose asChild>
              <Button type="button">Close</Button>
            </DialogClose>
          </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
