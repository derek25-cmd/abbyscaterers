
"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { FileText, Loader2, ArrowLeft, DollarSign, CheckCircle, AlertCircle, Search, ListFilter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useInvoiceStorage } from "@/hooks/use-invoice-storage";
import { useClientStorage } from "@/hooks/use-client-storage";
import jsPDF from "jspdf";
import "jspdf-autotable";
import type { Invoice } from "@/types";
import { format, parseISO } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("clientName");


  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    invoices.forEach(invoice => {
      if (invoice.invoiceDate) {
        months.add(format(parseISO(invoice.invoiceDate), 'yyyy-MM'));
      }
    });
    return Array.from(months).sort().reverse();
  }, [invoices]);

  const monthlyInvoices = useMemo(() => {
    let filtered = invoices.filter(invoice => invoice.invoiceDate && format(parseISO(invoice.invoiceDate), 'yyyy-MM') === selectedMonth);
    
    if (searchQuery) {
        const lowercasedQuery = searchQuery.toLowerCase();
        filtered = filtered.filter(inv => {
            const clientName = getClientById(inv.clientId || "")?.companyName.toLowerCase() || "";
            switch (filterType) {
                case 'clientName': return clientName.includes(lowercasedQuery);
                case 'id': return inv.id.toLowerCase().includes(lowercasedQuery);
                case 'status': return inv.status.toLowerCase().includes(lowercasedQuery);
                default: return true;
            }
        });
    }

    return filtered;
  }, [selectedMonth, invoices, searchQuery, filterType, getClientById]);

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
      const doc = new jsPDF({ orientation: 'landscape' });
      const monthFormatted = format(parseISO(`${selectedMonth}-01`), 'MMMM yyyy');
      doc.text(`Monthly Invoice Report - ${monthFormatted}`, 14, 15);

      (doc as any).autoTable({
        head: [['Invoice No.', 'Client', 'Date', 'Status', 'Amount']],
        body: monthlyInvoices.map(invoice => {
          const client = getClientById(invoice.clientId || "");
          return [
            invoice.id,
            client?.companyName || "N/A",
            invoice.invoiceDate ? format(parseISO(invoice.invoiceDate), 'PPP') : "N/A",
            invoice.status,
            formatCurrency(calculateTotal(invoice)),
          ];
        }),
        startY: 25,
        foot: [
            ['', '', '', 'Total Invoiced', formatCurrency(summary.totalInvoiced)],
            ['', '', '', 'Total Paid', formatCurrency(summary.totalPaid)],
            ['', '', '', 'Total Outstanding', formatCurrency(summary.totalOutstanding)],
        ],
        footStyles: { fontStyle: 'bold' }
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
             <div className="flex items-center gap-2 pt-4">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder={`Search by ${filterType}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg bg-background pl-8 md:w-[240px]"
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="h-9 gap-1"><ListFilter className="h-3.5 w-3.5" /><span className="sr-only sm:not-sr-only">Filter</span></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Filter by</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem checked={filterType === 'clientName'} onCheckedChange={() => setFilterType('clientName')}>Client Name</DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={filterType === 'id'} onCheckedChange={() => setFilterType('id')}>Invoice No.</DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={filterType === 'status'} onCheckedChange={() => setFilterType('status')}>Status</DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
            </div>
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
                    <TableCell>{invoice.invoiceDate ? format(parseISO(invoice.invoiceDate), 'PPP') : "N/A"}</TableCell>
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
