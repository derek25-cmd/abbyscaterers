"use client";

import React, { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useInvoiceStorage } from "@/hooks/use-invoice-storage";
import { useProformaInvoiceStorage } from "@/hooks/use-proforma-invoice-storage";
import { useOrderStorage } from "@/hooks/use-order-storage";
import { useDeliveryNoteStorage } from "@/hooks/use-delivery-note-storage";
import { useIssuanceStorage } from "../../hooks/use-issuance-storage";
import { useClientStorage } from "@/hooks/use-client-storage";
import { calculateGrandTotal } from "@/lib/utils";
import { format, parseISO, isValid } from "date-fns";
import { Loader2, FileText, ShoppingCart, Truck, Package, Info, CheckCircle2, Clock, Download, Building } from "lucide-react";
import type { Invoice, Issuance } from "@/types";
import { cn } from "@/lib/utils";
import jsPDF from "jspdf";
import "jspdf-autotable";

interface InvoiceRegistryDialogProps {
  invoice: Invoice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InvoiceRegistryDialog({ invoice, open, onOpenChange }: InvoiceRegistryDialogProps) {
  const { proformaInvoices, isLoading: proformasLoading } = useProformaInvoiceStorage();
  const { orders, isLoading: ordersLoading } = useOrderStorage();
  const { deliveryNotes, isLoading: dnsLoading } = useDeliveryNoteStorage();
  const { issuances, isLoading: issuancesLoading } = useIssuanceStorage();
  const { clients, isLoading: clientsLoading } = useClientStorage();

  const isLoading = proformasLoading || ordersLoading || dnsLoading || issuancesLoading || clientsLoading;

  const registry = useMemo(() => {
    if (!invoice || isLoading) return null;

    const proforma = proformaInvoices.find(p => p.id === invoice.proformaId);
    const client = clients.find(c => c.id === invoice.clientId);
    
    // Links: Invoice -> Items (Order IDs) OR Proforma -> Orders
    const itemOrderIds = (invoice.items || [])
        .map(item => item.id)
        .filter(id => id && (id.startsWith('ORD-') || orders.some(o => o.id === id)));
    
    const proformaOrderIds = invoice.proformaId 
        ? orders.filter(o => o.proformaId === invoice.proformaId).map(o => o.id)
        : [];
        
    const allOrderIds = new Set([...itemOrderIds, ...proformaOrderIds]);
    const linkedOrders = orders.filter(o => allOrderIds.has(o.id));
    const orderIds = new Set(linkedOrders.map(o => o.id));

    // DNs linked to orders
    const linkedDNs = deliveryNotes.filter(dn => orderIds.has(dn.order_id));

    // Issuances linked to orders
    const linkedIssuances = issuances.filter((is: Issuance) => orderIds.has(is.orderId));

    const totalAmount = calculateGrandTotal(invoice);
    const amountPaid = invoice.amountPaid || 0;
    const balance = totalAmount - amountPaid;

    return {
      client,
      proforma,
      orders: linkedOrders,
      deliveryNotes: linkedDNs,
      issuances: linkedIssuances,
      financials: {
        total: totalAmount,
        paid: amountPaid,
        balance: balance
      }
    };
  }, [invoice, proformaInvoices, orders, deliveryNotes, issuances, clients, isLoading]);

  const handleExportPdf = () => {
    if (!invoice || !registry) return;

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Header
      doc.setFontSize(20);
      doc.setTextColor(79, 70, 229); // Indigo color
      doc.text("INVOICE REGISTRY REPORT", 14, 20);
      
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text(`Invoice No: ${invoice.id}`, 14, 30);
      doc.text(`Client Name: ${registry.client?.companyName || 'N/A'}`, 14, 37);
      doc.text(`Report Date: ${format(new Date(), 'PPP p')}`, 14, 44);
      
      // Status Badge (simulated)
      doc.setFontSize(12);
      doc.text(`Status: ${invoice.status.toUpperCase()}`, pageWidth - 14, 20, { align: 'right' });

      // Financials
      doc.setFontSize(14);
      doc.text("Financial Summary", 14, 55);
      (doc as any).autoTable({
        startY: 60,
        head: [['Total Amount', 'Amount Paid', 'Remaining Balance']],
        body: [[
          `${registry.financials.total.toLocaleString()} TZS`,
          `${registry.financials.paid.toLocaleString()} TZS`,
          `${registry.financials.balance.toLocaleString()} TZS`
        ]],
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229] }
      });

      // Proforma & Orders
      let currentY = (doc as any).lastAutoTable.finalY + 15;
      doc.text("Linked Information", 14, currentY);
      
      const linkedData = [
        ['Proforma ID', registry.proforma?.id || 'N/A'],
        ['Client', registry.client?.companyName || 'N/A']
      ];

      (doc as any).autoTable({
        startY: currentY + 5,
        body: linkedData,
        theme: 'plain',
        columnStyles: { 0: { fontStyle: 'bold', width: 40 } }
      });

      // Associated Orders Table
      currentY = (doc as any).lastAutoTable.finalY + 15;
      doc.text("Associated Orders", 14, currentY);
      
      const orderRows = registry.orders.map(o => {
        const totalPax = o.clientEvents?.reduce((sum, e) => sum + (e.numberOfPeople || 0), 0) || 0;
        return [
          o.id,
          o.name || 'N/A',
          o.startDate ? format(parseISO(o.startDate), 'MMM dd, yyyy') : 'N/A',
          o.endDate ? format(parseISO(o.endDate), 'MMM dd, yyyy') : 'N/A',
          o.clientEvents?.length.toString() || '0',
          totalPax.toString()
        ];
      });

      (doc as any).autoTable({
        startY: currentY + 5,
        head: [['Order ID', 'Description', 'Start', 'End', 'Events', 'Pax']],
        body: orderRows.length > 0 ? orderRows : [['No orders found', '', '', '', '', '']],
        theme: 'striped',
        headStyles: { fillColor: [100, 100, 100] }
      });

      // Delivery Notes
      currentY = (doc as any).lastAutoTable.finalY + 15;
      doc.text("Delivery Notes", 14, currentY);
      
      const dnRows = registry.deliveryNotes.map(dn => [
        dn.id,
        dn.delivery_date ? format(parseISO(dn.delivery_date), 'MMM dd, yyyy') : 'N/A',
        dn.delivered_by,
        dn.delivery_location
      ]);

      (doc as any).autoTable({
        startY: currentY + 5,
        head: [['DN No.', 'Date', 'Delivered By', 'Location']],
        body: dnRows.length > 0 ? dnRows : [['No delivery notes found', '', '', '']],
        theme: 'striped',
        headStyles: { fillColor: [100, 100, 100] }
      });

      // Asset Issuances
      currentY = (doc as any).lastAutoTable.finalY + 15;
      doc.text("Asset Issuances", 14, currentY);
      
      const issuanceRows = registry.issuances.map(is => [
        is.id,
        is.issuedTo,
        is.date ? format(parseISO(is.date), 'MMM dd, yyyy') : 'N/A',
        is.status,
        is.items.length.toString()
      ]);

      (doc as any).autoTable({
        startY: currentY + 5,
        head: [['Issuance ID', 'Issued To', 'Date', 'Status', 'Items']],
        body: issuanceRows.length > 0 ? issuanceRows : [['No issuances found', '', '', '', '']],
        theme: 'striped',
        headStyles: { fillColor: [100, 100, 100] }
      });

      doc.save(`Registry_${invoice.id}.pdf`);
    } catch (error) {
      console.error("PDF Export failed:", error);
    }
  };

  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-6 pb-2">
          <div className="flex justify-between items-center">
             <div className="flex flex-col">
                <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                    <FileText className="h-6 w-6 text-primary" />
                    Invoice Registry: {invoice.id}
                </DialogTitle>
                {registry?.client && (
                    <div className="text-sm text-muted-foreground mt-1 flex items-center gap-1 font-medium italic">
                        <Building className="h-3.5 w-3.5" />
                        {registry.client.companyName}
                    </div>
                )}
             </div>
             <Badge className={cn("text-sm", 
                invoice.status === 'paid' ? 'bg-green-100 text-green-800' : 
                invoice.status === 'partially paid' ? 'bg-orange-100 text-orange-800' :
                'bg-orange-100 text-orange-800' // Default for outstanding
              )}>
                {invoice.status === 'paid' ? <CheckCircle2 className="h-4 w-4 mr-1 inline" /> : <Clock className="h-4 w-4 mr-1 inline" />}
                {invoice.status.toUpperCase()}
             </Badge>
             <Button variant="outline" size="sm" onClick={handleExportPdf} className="ml-4">
                <Download className="h-4 w-4 mr-2" /> Export PDF
             </Button>
          </div>
        </DialogHeader>

        {isLoading ? (
            <div className="flex-1 flex justify-center items-center py-20 pb-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2">Loading registry data...</span>
            </div>
        ) : registry ? (
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Financial Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="bg-primary/5">
                        <CardHeader className="py-3"><CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Amount</CardTitle></CardHeader>
                        <CardContent><div className="text-xl font-bold">{registry.financials.total.toLocaleString()} TZS</div></CardContent>
                    </Card>
                    <Card className="bg-green-50">
                         <CardHeader className="py-3"><CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Amount Paid</CardTitle></CardHeader>
                        <CardContent><div className="text-xl font-bold text-green-700">{registry.financials.paid.toLocaleString()} TZS</div></CardContent>
                    </Card>
                    <Card className={cn(registry.financials.balance > 0 ? "bg-red-50" : "bg-green-50")}>
                         <CardHeader className="py-3"><CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Remaining Balance</CardTitle></CardHeader>
                        <CardContent><div className="text-xl font-bold text-red-700">{registry.financials.balance.toLocaleString()} TZS</div></CardContent>
                    </Card>
                </div>

                {/* Main Links */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Proforma Info */}
                    <Card>
                        <CardHeader className="bg-muted/50 py-3"><CardTitle className="text-sm font-bold flex items-center gap-2 px-2"><FileText className="h-4 w-4" /> Proforma Invoice</CardTitle></CardHeader>
                        <CardContent className="pt-4 space-y-2">
                            {registry.proforma ? (
                                <>
                                    <div className="flex justify-between text-sm"><span>Proforma ID:</span><span className="font-mono">{registry.proforma.id}</span></div>
                                    <div className="flex justify-between text-sm"><span>Date:</span><span>{format(parseISO(registry.proforma.invoiceDate), 'PPP')}</span></div>
                                    <div className="flex justify-between text-sm"><span>Client:</span><span>{registry.client?.companyName}</span></div>
                                </>
                            ) : <div className="text-muted-foreground text-sm italic">No proforma linked.</div>}
                        </CardContent>
                    </Card>

                    {/* Orders Info - Full Width Table */}
                    <Card className="md:col-span-2">
                        <CardHeader className="bg-muted/50 py-3"><CardTitle className="text-sm font-bold flex items-center gap-2 px-2"><ShoppingCart className="h-4 w-4" /> Associated Orders</CardTitle></CardHeader>
                        <CardContent className="p-0">
                             {registry.orders.length > 0 ? (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="py-2">Order ID</TableHead>
                                            <TableHead className="py-2">Description</TableHead>
                                            <TableHead className="py-2">Start Date</TableHead>
                                            <TableHead className="py-2">End Date</TableHead>
                                            <TableHead className="py-2 text-right">Events</TableHead>
                                            <TableHead className="py-2 text-right">Total Pax</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {registry.orders.map(order => {
                                            const totalPax = order.clientEvents?.reduce((sum, e) => sum + (e.numberOfPeople || 0), 0) || 0;
                                            return (
                                                <TableRow key={order.id}>
                                                    <TableCell className="font-mono text-xs">{order.id}</TableCell>
                                                    <TableCell className="text-xs">{order.name}</TableCell>
                                                    <TableCell className="text-xs">{order.startDate ? format(parseISO(order.startDate), 'MMM dd, yyyy') : 'N/A'}</TableCell>
                                                    <TableCell className="text-xs">{order.endDate ? format(parseISO(order.endDate), 'MMM dd, yyyy') : 'N/A'}</TableCell>
                                                    <TableCell className="text-right text-xs">{order.clientEvents?.length || 0}</TableCell>
                                                    <TableCell className="text-right text-xs font-semibold">{totalPax}</TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                             ) : <div className="p-6 text-muted-foreground text-sm italic">No orders found.</div>}
                        </CardContent>
                    </Card>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Delivery Notes */}
                <Card>
                    <CardHeader className="bg-muted/50 py-3"><CardTitle className="text-sm font-bold flex items-center gap-2 px-2"><Truck className="h-4 w-4" /> Delivery Notes</CardTitle></CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="py-2">DN No.</TableHead>
                                    <TableHead className="py-2">Date</TableHead>
                                    <TableHead className="py-2">Delivered By</TableHead>
                                    <TableHead className="py-2">Location</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {registry.deliveryNotes.map(dn => (
                                    <TableRow key={dn.id}>
                                        <TableCell className="font-mono text-xs">{dn.id}</TableCell>
                                        <TableCell className="text-xs">{format(parseISO(dn.delivery_date), 'MMM dd, yyyy')}</TableCell>
                                        <TableCell className="text-xs">{dn.delivered_by}</TableCell>
                                        <TableCell className="text-xs">{dn.delivery_location}</TableCell>
                                    </TableRow>
                                ))}
                                {registry.deliveryNotes.length === 0 && (
                                    <TableRow><TableCell colSpan={4} className="text-center py-4 text-muted-foreground text-xs italic">No delivery notes found.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Asset Issuances */}
                <Card>
                    <CardHeader className="bg-muted/50 py-3"><CardTitle className="text-sm font-bold flex items-center gap-2 px-2"><Package className="h-4 w-4" /> Asset Issuances</CardTitle></CardHeader>
                    <CardContent className="p-0">
                         <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="py-2">Issuance ID</TableHead>
                                    <TableHead className="py-2">Issued To</TableHead>
                                    <TableHead className="py-2">Date</TableHead>
                                    <TableHead className="py-2">Status</TableHead>
                                    <TableHead className="py-2 text-right">Items</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {registry.issuances.map((is: Issuance) => (
                                    <TableRow key={is.id}>
                                        <TableCell className="font-mono text-xs">{is.id}</TableCell>
                                        <TableCell className="text-xs">{is.issuedTo}</TableCell>
                                        <TableCell className="text-xs">{format(parseISO(is.date), 'MMM dd, yyyy')}</TableCell>
                                        <TableCell><Badge variant="outline" className="text-[10px] py-0">{is.status}</Badge></TableCell>
                                        <TableCell className="text-right text-xs">{is.items.length}</TableCell>
                                    </TableRow>
                                ))}
                                {registry.issuances.length === 0 && (
                                    <TableRow><TableCell colSpan={5} className="text-center py-4 text-muted-foreground text-xs italic">No asset issuances found.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
