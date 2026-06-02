
'use client';

import { useState, useMemo } from "react";
import { Search, ExternalLink, BookOpen, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { getInvoices } from "@/services/invoiceService";
import { Invoice } from "@/types";
import { useClientStorage } from "@/hooks/use-client-storage";
import Link from "next/link";
import { getDisplayItems } from "@/lib/utils";

function calcInvoiceTotals(inv: Invoice) {
  const subtotal = getDisplayItems(inv.items).reduce((sum, item) => sum + (item.total || 0), 0);
  const totalForDays = inv.multiplyByDays ? subtotal * (inv.numberOfDays || 1) : subtotal;
  const totalBeforeVAT = totalForDays + (inv.serviceCharge || 0) + (inv.transportCosts || 0);
  if (inv.vatType === 'exclusive') {
    const vatAmount = totalBeforeVAT * 0.18;
    return { netAmount: totalBeforeVAT, vatAmount, grandTotal: totalBeforeVAT + vatAmount };
  }
  const grandTotal = totalBeforeVAT;
  const netAmount = grandTotal / 1.18;
  return { netAmount, vatAmount: grandTotal - netAmount, grandTotal };
}

export default function SalesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const { clients } = useClientStorage();

  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({
    queryKey: ['invoices'],
    queryFn: getInvoices,
    staleTime: 5 * 60 * 1000,
  });

  const getClientName = (clientId: string | null) => {
    if (!clientId) return 'Walk-in / Direct';
    const client = clients.find(c => c.id === clientId);
    return client?.companyName || 'Unknown Client';
  };

  // Compute totals once in memo — avoids calling calcInvoiceTotals in the render loop
  const { rows, totals } = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const filtered = !searchQuery
      ? invoices
      : invoices.filter(inv =>
          inv.id.toLowerCase().includes(q) ||
          getClientName(inv.clientId).toLowerCase().includes(q) ||
          (inv.serviceDesc || '').toLowerCase().includes(q) ||
          (inv.selectedEventType || '').toLowerCase().includes(q) ||
          (inv.customEventType || '').toLowerCase().includes(q)
        );

    let net = 0, vat = 0, gross = 0;
    const rows = filtered.map(inv => {
      const t = calcInvoiceTotals(inv);
      net += t.netAmount;
      vat += t.vatAmount;
      gross += t.grandTotal;
      return { inv, ...t };
    });

    return { rows, totals: { net, vat, gross } };
  }, [invoices, searchQuery, clients]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS' }).format(amount);

  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text("ABBY'S CATERERS — SALES JOURNAL", 14, 18);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${format(new Date(), "PPP")}`, 14, 25);
    doc.text(`Total Records: ${rows.length}`, 14, 30);

    (doc as any).autoTable({
      startY: 36,
      theme: 'grid',
      head: [['Invoice Date', 'Customer', 'Description', 'Invoice #', 'Net Amount (TZS)', 'VAT 18% (TZS)', 'Gross Total (TZS)', 'Status']],
      body: rows.map(({ inv, netAmount, vatAmount, grandTotal }) => [
        format(new Date(inv.invoiceDate), "dd/MM/yyyy"),
        getClientName(inv.clientId),
        (inv.serviceDesc || inv.customEventType || inv.selectedEventType || 'Catering Services').slice(0, 40),
        inv.id,
        netAmount.toLocaleString('en-US', { maximumFractionDigits: 0 }),
        vatAmount.toLocaleString('en-US', { maximumFractionDigits: 0 }),
        grandTotal.toLocaleString('en-US', { maximumFractionDigits: 0 }),
        inv.status,
      ]),
      foot: [['', '', '', 'JOURNAL TOTALS',
        totals.net.toLocaleString('en-US', { maximumFractionDigits: 0 }),
        totals.vat.toLocaleString('en-US', { maximumFractionDigits: 0 }),
        totals.gross.toLocaleString('en-US', { maximumFractionDigits: 0 }),
        '',
      ]],
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
      footStyles: { fillColor: [241, 245, 249], textColor: [30, 30, 30], fontStyle: 'bold' },
      columnStyles: {
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' },
      },
    });

    doc.save(`sales-journal-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const getStatusBadge = (status: Invoice['status']) => {
    if (status === 'paid') return <Badge className="bg-green-600">Paid</Badge>;
    if (status === 'partially paid') return <Badge className="bg-blue-600">Part Paid</Badge>;
    return <Badge variant="outline">Outstanding</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Sales Journal
            </CardTitle>
            <CardDescription>
              Revenue ledger auto-populated from issued invoices. To record a new sale, create an invoice in the Invoicing module.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportPDF}>
              <FileDown className="mr-2 h-4 w-4" /> Export PDF
            </Button>
            <Link href="/invoicing/invoices">
              <Button variant="outline" size="sm">
                <ExternalLink className="mr-2 h-4 w-4" /> Invoicing Module
              </Button>
            </Link>
          </div>
        </div>
        <div className="pt-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by customer, invoice number, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg bg-background pl-8 md:w-[360px]"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Invoice #</TableHead>
              <TableHead className="text-right">Net Amount</TableHead>
              <TableHead className="text-right">VAT (18%)</TableHead>
              <TableHead className="text-right">Gross Total</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="h-24 text-center">Loading sales journal...</TableCell></TableRow>
            ) : rows.length > 0 ? (
              rows.map(({ inv, netAmount, vatAmount, grandTotal }) => {
                const description = inv.serviceDesc || inv.customEventType || inv.selectedEventType || 'Catering Services';
                return (
                  <TableRow key={inv.id}>
                    <TableCell className="whitespace-nowrap">{format(new Date(inv.invoiceDate), "PPP")}</TableCell>
                    <TableCell className="font-medium">{getClientName(inv.clientId)}</TableCell>
                    <TableCell className="max-w-[200px] truncate" title={description}>{description}</TableCell>
                    <TableCell className="font-mono text-sm">{inv.id}</TableCell>
                    <TableCell className="text-right">{formatCurrency(netAmount)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatCurrency(vatAmount)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(grandTotal)}</TableCell>
                    <TableCell>{getStatusBadge(inv.status)}</TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  No invoices found. Use the Invoicing module to create and issue sales invoices.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={4} className="text-right font-bold text-base">Journal Totals</TableCell>
              <TableCell className="text-right font-bold text-base">{formatCurrency(totals.net)}</TableCell>
              <TableCell className="text-right font-bold text-base text-purple-600">{formatCurrency(totals.vat)}</TableCell>
              <TableCell className="text-right font-bold text-base text-primary">{formatCurrency(totals.gross)}</TableCell>
              <TableCell />
            </TableRow>
          </TableFooter>
        </Table>
      </CardContent>
    </Card>
  );
}
