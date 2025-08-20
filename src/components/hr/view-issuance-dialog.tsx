

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
import { ScrollArea } from "./ui/scroll-area";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Separator } from "./ui/separator";

export function ViewIssuanceDialog({ isOpen, setIsOpen, logEntry }) {

  if (!logEntry) return null;

  const handlePrint = async () => {
    const printableArea = document.getElementById('printable-area');
    if(printableArea) {
      const canvas = await html2canvas(printableArea, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`issuance-note-${logEntry.id}.pdf`);
    }
  };
  
  const getFullName = (emp) => {
    if (!emp) return 'N/A';
    return [emp.firstName, emp.middleName, emp.lastName].filter(Boolean).join(' ');
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS' }).format(amount).replace('TZS', 'TZS ');
  }
  
  const missingItems = logEntry.items?.filter(item => (item.quantityReturned || 0) < item.quantityIssued)
    .map(item => ({...item, missingQty: item.quantityIssued - (item.quantityReturned || 0)}));
    
  const missingItemsValue = missingItems?.reduce((total, item) => total + (item.missingQty * item.unitPrice), 0);

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
        <ScrollArea className="max-h-[80vh]">
          <div id="printable-area" className="p-6">
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
