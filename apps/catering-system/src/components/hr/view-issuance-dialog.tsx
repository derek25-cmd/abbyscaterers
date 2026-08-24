'use client';

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
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import jsPDF from 'jspdf';
import "jspdf-autotable";
import { Separator } from "@/components/ui/separator";
import type { Issuance, Order, Employee } from "@/types";

interface ViewIssuanceDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  logEntry: (Issuance & { order?: Order; employee?: Employee }) | null;
}

export function ViewIssuanceDialog({ isOpen, setIsOpen, logEntry }: ViewIssuanceDialogProps) {

  if (!logEntry) return null;

  const handlePrint = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    
    doc.text("Issuance Note", 14, 20);
    doc.setFontSize(10);
    doc.text(`Issue ID: ${logEntry.id}`, 14, 30);
    doc.text(`Date: ${logEntry.date}`, 14, 35);
    doc.text(`Issued To: ${logEntry.issuedTo}`, 150, 30);
    doc.text(`Client Order: ${logEntry.order?.name || 'N/A'} (${logEntry.orderId})`, 150, 35);
    
    const tableColumn = ["Asset Name", "Type", "Issued", "Returned", "Unit Price", "Total Value"];
    const tableRows = logEntry.items.map(item => [
        item.name,
        item.type,
        item.quantityIssued,
        item.quantityReturned || 0,
        formatCurrency(item.unitPrice),
        formatCurrency(item.unitPrice * item.quantityIssued)
    ]);
    
    (doc as any).autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 45,
        foot: [[
            { content: `Grand Total Value: ${formatCurrency(logEntry.totalValue)}`, colSpan: 6, styles: { halign: 'right', fontStyle: 'bold' } }
        ]],
        showFoot: 'lastPage'
    });

    let finalY = (doc as any).autoTable.previous.finalY;

    if (logEntry.notes) {
      doc.text("Notes:", 14, finalY + 10);
      doc.text(logEntry.notes, 14, finalY + 15, { maxWidth: 180 });
    }

    doc.save(`issuance-note-${logEntry.id}.pdf`);
  };
  
  const getFullName = (emp: Employee | undefined) => {
    if (!emp) return 'N/A';
    return [emp.firstName, emp.middleName, emp.lastName].filter(Boolean).join(' ');
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS' }).format(amount).replace('TZS', 'TZS ');
  }
  
  const items = logEntry.items || [];
  const missingItems = items.filter(item => (item.quantityReturned || 0) < item.quantityIssued)
    .map(item => ({...item, missingQty: item.quantityIssued - (item.quantityReturned || 0)}));
    
  const missingItemsValue = missingItems.length > 0 ? missingItems.reduce((total, item) => total + (item.missingQty * item.unitPrice), 0) : 0;

  const getStatusBadge = (status: Issuance['status']) => {
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
        <ScrollArea className="max-h-[80vh]">
          <div className="p-6">
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
              {(logEntry.status === 'Partially Returned' || logEntry.status === 'Incomplete') && missingItems.length > 0 && (
                <div className="mt-4 p-4 border-l-4 border-destructive bg-destructive/10">
                    <h4 className="font-bold text-destructive mb-2">Discrepancy Report</h4>
                    <p className="text-sm mb-2">The following items were not returned:</p>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Asset Name</TableHead>
                                <TableHead className="text-right">Missing Qty</TableHead>
                                <TableHead className="text-right">Value</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {missingItems.map(item => (
                                <TableRow key={item.assetId}>
                                    <TableCell>{item.name}</TableCell>
                                    <TableCell className="text-right">{item.missingQty}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(item.missingQty * item.unitPrice)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                        <TableFooter>
                            <TableRow>
                                <TableCell colSpan={2} className="text-right font-bold">Total Value of Missing Items</TableCell>
                                <TableCell className="text-right font-bold">{formatCurrency(missingItemsValue)}</TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
          <DialogFooter className="p-6 pt-0">
            <Button type="button" variant="outline" onClick={handlePrint}>Export as PDF</Button>
            <DialogClose asChild>
              <Button type="button">Close</Button>
            </DialogClose>
          </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
