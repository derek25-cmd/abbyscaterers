
"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { FileText, Loader2, ArrowLeft, DollarSign, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useInvoiceStorage } from "@/hooks/use-invoice-storage";
import { useClientStorage } from "@/hooks/use-client-storage";
import jsPDF from "jspdf";
import "jspdf-autotable";
import type { Invoice } from "@/types";
import { format, parseISO } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";

const calculateTotal = (inv: Invoice) => {
    const subtotal = inv.items.reduce((sum, item) => sum + (item.total || 0), 0);
    const totalForDays = inv.multiplyByDays ? subtotal * (inv.numberOfDays || 1) : subtotal;
    const totalBeforeVat = totalForDays + (inv.serviceCharge || 0) + (inv.transportCosts || 0);
    const vat = inv.vatType === 'exclusive' ? totalBeforeVat * 0.18 : 0;
    return totalBeforeVat + vat;
}

export default function MonthlyInvoiceReportPage() {
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), 'yyyy-MM'));
  const { toast } = useToast();
  const { invoices, isLoading: invoicesLoading } = useInvoiceStorage();
  const { getClientById, isLoading: clientsLoading } = useClientStorage();
  const [isExporting, setIsExporting] = useState(false);

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    invoices.forEach(invoice => {
      months.add(format(parseISO(invoice.invoiceDate), 'yyyy-MM'));
    });
    return Array.from(months).sort().reverse();
  }, [invoices]);

  const monthlyInvoices = useMemo(() => {
    return invoices.filter(invoice => format(parseISO(invoice.invoiceDate), 'yyyy-MM') === selectedMonth);
  }, [selectedMonth, invoices]);

  const summary = useMemo(() => {
    const paidInvoices = monthlyInvoices.filter(inv => inv.status === 'paid');
    const outstandingInvoices = monthlyInvoices.filter(inv => inv.status === 'outstanding');

    return {
        totalInvoiced: monthlyInvoices.reduce((sum, inv) => sum + calculateTotal(inv), 0),
        totalPaid: paidInvoices.reduce((sum, inv) => sum + calculateTotal(inv), 0),
        totalOutstanding: outstandingInvoices.reduce((sum, inv) => sum + calculateTotal(inv), 0),
    }
  }, [monthlyInvoices]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS', currencyDisplay: 'code' }).format(amount);
  }

  const handlePdfExport = () => {
    setIsExporting(true);
    try {
      const doc = new jsPDF({ orientation: 'l' });
      const monthFormatted = format(parseISO(`${selectedMonth}-01`), 'MMMM yyyy');
      doc.text(`Monthly Invoice Report - ${monthFormatted}`, 14, 15);

      (doc as any).autoTable({
        head: [['Invoice No.', 'Client', 'Date', 'Status', 'Amount']],
        body: monthlyInvoices.map(invoice => {
          const client = getClientById(invoice.clientId || "");
          return [
            invoice.id,
            client?.companyName || "N/A",
            format(parseISO(invoice.invoiceDate), 'PPP'),
            invoice.status,
            formatCurrency(calculateTotal(invoice)),
          ];
        }),
        startY: 25,
        styles: { halign: 'right' },
        columnStyles: {
            0: { halign: 'left' },
            1: { halign: 'left' },
            2: { halign: 'left' },
            3: { halign: 'left' },
        }
      });

      doc.save(`Monthly_Invoice_Report_${selectedMonth}.pdf`);
      toast({ title: "Export Successful", description: "Report exported to PDF." });
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast({ variant: "destructive", title: "Export Failed", description: "An error occurred while generating the PDF." });
    } finally {
      setIsExporting(false);
    }
  };

  const isLoading = invoicesLoading || clientsLoading;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Monthly Invoice Report</h1>
          <p className="text-muted-foreground">Track financial status for a selected month.</p>
        </div>
        <div className="flex items-center space-x-3">
          <Select onValueChange={setSelectedMonth} value={selectedMonth}>
              <SelectTrigger className="w-[240px]">
                  <SelectValue placeholder="Select a month" />
              </SelectTrigger>
              <SelectContent>
                  {availableMonths.map(month => (
                      <SelectItem key={month} value={month}>{format(parseISO(`${month}-01`), 'MMMM yyyy')}</SelectItem>
                  ))}
              </SelectContent>
          </Select>
          <Button onClick={handlePdfExport} variant="outline" size="sm" disabled={isExporting}>
             {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
             {isExporting ? 'Exporting...' : 'Export PDF'}
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/reports"><ArrowLeft className="mr-2 h-4 w-4" />Back to Reports</Link>
          </Button>
        </div>
      </div>
      
      <div className="grid gap-4 md:grid-cols-3">
          <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Invoiced</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(summary.totalInvoiced)}</div></CardContent></Card>
          <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Paid</CardTitle><CheckCircle className="h-4 w-4 text-green-500" /></CardHeader><CardContent><div className="text-2xl font-bold text-green-600">{formatCurrency(summary.totalPaid)}</div></CardContent></Card>
          <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Outstanding</CardTitle><AlertCircle className="h-4 w-4 text-orange-500" /></CardHeader><CardContent><div className="text-2xl font-bold text-orange-600">{formatCurrency(summary.totalOutstanding)}</div></CardContent></Card>
      </div>

      <Card>
          <CardHeader>
          <CardTitle>Invoices for: {format(parseISO(`${selectedMonth}-01`), 'MMMM yyyy')}</CardTitle>
        </CardHeader>
        <CardContent>
           <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice No.</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center h-24"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
              ) : monthlyInvoices.length > 0 ? monthlyInvoices.map((invoice) => {
                const client = getClientById(invoice.clientId || "");
                return (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-mono text-xs">{invoice.id}</TableCell>
                    <TableCell className="font-medium">{client?.companyName || "N/A"}</TableCell>
                    <TableCell>{format(parseISO(invoice.invoiceDate), 'PPP')}</TableCell>
                    <TableCell>{invoice.status}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(calculateTotal(invoice))}</TableCell>
                  </TableRow>
                )
              }) : (
                <TableRow><TableCell colSpan={5} className="text-center h-24">No invoices found for this month.</TableCell></TableRow>
              )}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={4} className="text-right font-bold text-lg">Total for Month</TableCell>
                <TableCell className="text-right font-bold text-lg text-primary">{formatCurrency(summary.totalInvoiced)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
