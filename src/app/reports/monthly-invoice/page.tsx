
"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { FileText, Loader2, ArrowLeft, DollarSign, CheckCircle, AlertCircle, Search, ListFilter, CalendarIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useInvoiceStorage } from "@/hooks/use-invoice-storage";
import { useClientStorage } from "@/hooks/use-client-storage";
import jsPDF from "jspdf";
import "jspdf-autotable";
import type { Invoice } from "@/types";
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";
import { DateRange } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

const calculateTotal = (inv: Invoice) => {
    const subtotal = inv.items.reduce((sum, item) => sum + (item.total || 0), 0);
    const totalForDays = inv.multiplyByDays ? subtotal * (inv.numberOfDays || 1) : subtotal;
    const totalBeforeVat = totalForDays + (inv.serviceCharge || 0) + (inv.transportCosts || 0);
    const vat = inv.vatType === 'exclusive' ? totalBeforeVat * 0.18 : 0;
    return totalBeforeVat + vat;
}

export default function MonthlyInvoiceReportPage() {
  const { toast } = useToast();
  const { invoices, isLoading: invoicesLoading } = useInvoiceStorage();
  const { getClientById, isLoading: clientsLoading } = useClientStorage();
  const [isExporting, setIsExporting] = useState(false);
  
  const [clientSearch, setClientSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "outstanding">("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });


  const filteredInvoices = useMemo(() => {
    let filtered = invoices;

    // Filter by Date Range
    if (dateRange?.from && dateRange?.to) {
        filtered = filtered.filter(invoice => {
            if (!invoice.invoiceDate) return false;
            const invoiceDate = parseISO(invoice.invoiceDate);
            return isWithinInterval(invoiceDate, { start: dateRange.from!, end: dateRange.to! });
        });
    }

    // Filter by Client Name
    if (clientSearch) {
        const lowercasedQuery = clientSearch.toLowerCase();
        filtered = filtered.filter(inv => {
            const clientName = getClientById(inv.clientId || "")?.companyName.toLowerCase() || "";
            return clientName.includes(lowercasedQuery);
        });
    }
    
    // Filter by Status
    if (statusFilter !== 'all') {
        filtered = filtered.filter(inv => inv.status === statusFilter);
    }

    return filtered;
  }, [invoices, dateRange, clientSearch, statusFilter, getClientById]);

  const summary = useMemo(() => {
    const paidInvoices = filteredInvoices.filter(inv => inv.status === 'paid');
    const outstandingInvoices = filteredInvoices.filter(inv => inv.status === 'outstanding');

    return {
        totalInvoiced: filteredInvoices.reduce((sum, inv) => sum + calculateTotal(inv), 0),
        totalPaid: paidInvoices.reduce((sum, inv) => sum + calculateTotal(inv), 0),
        totalOutstanding: outstandingInvoices.reduce((sum, inv) => sum + calculateTotal(inv), 0),
    }
  }, [filteredInvoices]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS', currencyDisplay: 'code' }).format(amount);
  }

  const handlePdfExport = () => {
    setIsExporting(true);
    try {
      const doc = new jsPDF({ orientation: 'landscape' });
      const reportTitle = `Invoice Report: ${dateRange?.from ? format(dateRange.from, "PPP") : ''}${dateRange?.to ? ` - ${format(dateRange.to, "PPP")}`: ''}`;
      doc.text(reportTitle, 14, 15);

      (doc as any).autoTable({
        head: [['Invoice No.', 'Client', 'Date', 'Status', 'Amount']],
        body: filteredInvoices.map(invoice => {
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

      doc.save(`Invoice_Report.pdf`);
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
          <h1 className="text-3xl font-bold text-foreground">Invoice Report</h1>
          <p className="text-muted-foreground">Track financial status for a selected period.</p>
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
            <CardTitle>Invoices for: {dateRange?.from ? format(dateRange.from, "PPP") : ''}{dateRange?.to ? ` - ${format(dateRange.to, "PPP")}`: ''}</CardTitle>
             <div className="flex items-center gap-2 pt-4 flex-wrap">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search by client name..."
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  className="w-full rounded-lg bg-background pl-8 md:w-[240px]"
                />
              </div>
              <Select onValueChange={(value: "all" | "paid" | "outstanding") => setStatusFilter(value)} value={statusFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="Filter by Status" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="outstanding">Outstanding</SelectItem>
                </SelectContent>
              </Select>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="date"
                    variant={"outline"}
                    className={cn(
                      "w-full md:w-[300px] justify-start text-left font-normal",
                      !dateRange && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, "LLL dd, y")} -{" "}
                          {format(dateRange.to, "LLL dd, y")}
                        </>
                      ) : (
                        format(dateRange.from, "LLL dd, y")
                      )
                    ) : (
                      <span>Pick a date range</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
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
              ) : filteredInvoices.length > 0 ? filteredInvoices.map((invoice) => {
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
                <TableRow><TableCell colSpan={5} className="text-center h-24">No invoices found for the selected criteria.</TableCell></TableRow>
              )}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={4} className="text-right font-bold text-lg">Total for Period</TableCell>
                <TableCell className="text-right font-bold text-lg text-primary">{formatCurrency(summary.totalInvoiced)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
