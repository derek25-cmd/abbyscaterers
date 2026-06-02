
"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { FileText, FileSpreadsheet, Loader2, ArrowLeft, DollarSign, CheckCircle, AlertCircle, CalendarIcon, ChevronsUpDown, Check, X, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useInvoiceStorage } from "@/hooks/use-invoice-storage";
import { useClientStorage } from "@/hooks/use-client-storage";
import jsPDF from "jspdf";
import "jspdf-autotable";
import type { Invoice, Region } from "@/types";
import { format, parseISO, isWithinInterval, startOfDay, endOfDay, isAfter, isBefore, isSameDay } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";
import { DateRange } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { cn, calculateGrandTotal } from "@/lib/utils";
import { REGIONS } from "@/types";
import { InvoiceRegistryDialog } from "@/components/reports/invoice-registry-dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const calculateTotal = (inv: Invoice) => calculateGrandTotal(inv);

export default function MonthlyInvoiceReportPage() {
  const { toast } = useToast();
  const { invoices, isLoading: invoicesLoading } = useInvoiceStorage();
  const { clients, isLoading: clientsLoading } = useClientStorage();
  const [isExporting, setIsExporting] = useState(false);
  
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "outstanding">("all");
  const [regionFilter, setRegionFilter] = useState<Region | "all">("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false);
  const [registryInvoice, setRegistryInvoice] = useState<Invoice | null>(null);
  
  const [sortByClient, setSortByClient] = useState(false);
  const [oneClientPerPage, setOneClientPerPage] = useState(false);


  const filteredInvoices = useMemo(() => {
    let filtered = invoices;

    // Filter by Date Range
    if (dateRange?.from) {
        filtered = filtered.filter(invoice => {
            if (!invoice.invoiceDate) return false;
            const invoiceDate = startOfDay(parseISO(invoice.invoiceDate));
            const fromDate = startOfDay(dateRange.from!);
            
            if (dateRange.to) {
                const toDate = endOfDay(dateRange.to!);
                return isWithinInterval(invoiceDate, { start: fromDate, end: toDate });
            } else {
                // If only 'from' is selected, show all from that day onwards
                return isAfter(invoiceDate, fromDate) || isSameDay(invoiceDate, fromDate);
            }
        });
    } else if (dateRange?.to) {
        // If only 'to' is selected, show all up to that day
        filtered = filtered.filter(invoice => {
            if (!invoice.invoiceDate) return false;
            const invoiceDate = startOfDay(parseISO(invoice.invoiceDate));
            const toDate = endOfDay(dateRange.to!);
            return isBefore(invoiceDate, toDate) || isSameDay(invoiceDate, toDate);
        });
    }

    // Filter by selected Clients
    if (selectedClientIds.length > 0) {
        const clientSet = new Set(selectedClientIds);
        filtered = filtered.filter(inv => inv.clientId && clientSet.has(inv.clientId));
    }
    
    // Filter by Status
    if (statusFilter !== 'all') {
        filtered = filtered.filter(inv => inv.status === statusFilter);
    }

    // Filter by Region
    if (regionFilter !== 'all') {
        filtered = filtered.filter(inv => inv.region === regionFilter);
    }

    let result = [...filtered];
    if (sortByClient) {
        result.sort((a, b) => {
            const clientA = clients.find(c => c.id === a.clientId)?.companyName || "";
            const clientB = clients.find(c => c.id === b.clientId)?.companyName || "";
            if (clientA === clientB) {
                const dateA = a.invoiceDate ? new Date(a.invoiceDate).getTime() : 0;
                const dateB = b.invoiceDate ? new Date(b.invoiceDate).getTime() : 0;
                return dateB - dateA;
            }
            return clientA.localeCompare(clientB);
        });
    } else {
        result.sort((a, b) => {
            const dateA = a.invoiceDate ? new Date(a.invoiceDate).getTime() : 0;
            const dateB = b.invoiceDate ? new Date(b.invoiceDate).getTime() : 0;
            return dateB - dateA;
        });
    }

    return result;
  }, [invoices, dateRange, selectedClientIds, statusFilter, regionFilter, sortByClient, clients]);

  const summary = useMemo(() => {
    const totalInvoiced = filteredInvoices.reduce((sum, inv) => sum + calculateTotal(inv), 0);
    const totalPaid = filteredInvoices.reduce((sum, inv) => sum + (inv.amountPaid || 0), 0);
    const totalOutstanding = totalInvoiced - totalPaid;

    return {
      totalInvoiced,
      totalPaid,
      totalOutstanding,
    };
  }, [filteredInvoices]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  }
  
  const generateDynamicTitle = () => {
    let title = "Invoice Report";
    if (selectedClientIds.length > 0) {
      const clientName = clients.find(c => c.id === selectedClientIds[0])?.companyName;
      title = `For ${clientName}${selectedClientIds.length > 1 ? ` & ${selectedClientIds.length - 1} more` : ''}`;
    }
    if (dateRange?.from) {
      title += ` from ${format(dateRange.from, 'PPP')}`;
    }
    if (dateRange?.to) {
      title += ` to ${format(dateRange.to, 'PPP')}`;
    }
    if (statusFilter !== 'all') {
      title += ` | Status: ${statusFilter}`;
    }
    if (regionFilter !== 'all') {
      title += ` | Region: ${regionFilter}`;
    }
    return title;
  };

  const handlePdfExport = () => {
    setIsExporting(true);
    try {
      const doc = new jsPDF({ orientation: 'landscape' });
      let fileName = "Invoice_Report.pdf";
      
      if (oneClientPerPage) {
          const groupedInvoices: Record<string, Invoice[]> = {};
          filteredInvoices.forEach(inv => {
              const cid = inv.clientId || 'unknown';
              if (!groupedInvoices[cid]) groupedInvoices[cid] = [];
              groupedInvoices[cid].push(inv);
          });

          const clientIds = Object.keys(groupedInvoices);

          clientIds.forEach((clientId, index) => {
              if (index > 0) {
                  doc.addPage();
              }
              const client = clients.find(c => c.id === clientId);
              const clientName = client?.companyName || "N/A";
              
              let title = `Invoice Report - ${clientName}`;
              if (dateRange?.from) {
                  title += ` from ${format(dateRange.from, 'PPP')}`;
                  if (dateRange?.to) {
                      title += ` to ${format(dateRange.to, 'PPP')}`;
                  }
              }
              if (statusFilter !== 'all') title += ` | Status: ${statusFilter}`;
              if (regionFilter !== 'all') title += ` | Region: ${regionFilter}`;
              
              doc.setFontSize(14);
              doc.text(title, 14, 15);
              
              const tableColumns = ['S/N', 'Invoice No.', 'Status', 'Invoice Date', 'Total Amount', 'Paid', 'Outstanding'];
              const clientInvoices = groupedInvoices[clientId];
              
              let clientTotalInvoiced = 0;
              let clientTotalPaid = 0;
              let clientTotalOutstanding = 0;

              const tableRows = clientInvoices.map((invoice, idx) => {
                  const totalAmount = calculateTotal(invoice);
                  const amountPaid = invoice.amountPaid || 0;
                  const outstandingAmount = totalAmount - amountPaid;
                  
                  clientTotalInvoiced += totalAmount;
                  clientTotalPaid += amountPaid;
                  clientTotalOutstanding += outstandingAmount;

                  return [
                    idx + 1,
                    invoice.id,
                    invoice.status.toUpperCase(),
                    invoice.invoiceDate ? format(parseISO(invoice.invoiceDate), 'dd/MM/yyyy') : "N/A",
                    formatCurrency(totalAmount),
                    formatCurrency(amountPaid),
                    formatCurrency(outstandingAmount),
                  ];
              });

              (doc as any).autoTable({
                theme: 'grid',
                head: [tableColumns],
                body: tableRows,
                startY: 25,
                columnStyles: {
                    4: { halign: 'right' },
                    5: { halign: 'right' },
                    6: { halign: 'right' },
                },
                foot: [
                    ['', '', '', 'TOTAL (TZS):', formatCurrency(clientTotalInvoiced), formatCurrency(clientTotalPaid), formatCurrency(clientTotalOutstanding)],
                ],
                footStyles: { fontStyle: 'bold', halign: 'right' }
              });
          });
          
          fileName = "Invoice_Report_Per_Client";
          if (statusFilter !== 'all') fileName += `_${statusFilter}`;
          fileName += ".pdf";

      } else {
          const reportTitle = generateDynamicTitle();
          doc.setFontSize(14);
          doc.text(reportTitle, 14, 15);
          
          const tableColumns = ['S/N', 'Client', 'Invoice No.', 'Status', 'Invoice Date', 'Total Amount', 'Paid', 'Outstanding'];
          const tableRows = filteredInvoices.map((invoice, index) => {
              const client = clients.find(c => c.id === invoice.clientId);
              const totalAmount = calculateTotal(invoice);
              const amountPaid = invoice.amountPaid || 0;
              const outstandingAmount = totalAmount - amountPaid;
              return [
                index + 1,
                client?.companyName || "N/A",
                invoice.id,
                invoice.status.toUpperCase(),
                invoice.invoiceDate ? format(parseISO(invoice.invoiceDate), 'dd/MM/yyyy') : "N/A",
                formatCurrency(totalAmount),
                formatCurrency(amountPaid),
                formatCurrency(outstandingAmount),
              ];
            });

          (doc as any).autoTable({
            theme: 'grid',
            head: [tableColumns],
            body: tableRows,
            startY: 25,
            columnStyles: {
                5: { halign: 'right' },
                6: { halign: 'right' },
                7: { halign: 'right' },
            },
            foot: [
                ['', '', '', '', 'TOTAL (TZS):', formatCurrency(summary.totalInvoiced), formatCurrency(summary.totalPaid), formatCurrency(summary.totalOutstanding)],
            ],
            footStyles: { fontStyle: 'bold', halign: 'right' }
          });
          
          fileName = "Invoice_Report";
          if (selectedClientIds.length === 1) {
              const clientName = clients.find(c => c.id === selectedClientIds[0])?.companyName || 'Client';
              fileName = clientName.replace(/ /g, '_');
          }
          fileName += `_${statusFilter}.pdf`;
      }

      // --- Add Summary Page ---
      if (filteredInvoices.length > 0) {
          doc.addPage();
          doc.setFontSize(16);
          doc.setFont("helvetica", "bold");
          doc.text("Executive Summary", 14, 20);
          
          let servicePeriodText = "All Time";
          if (dateRange?.from) {
              servicePeriodText = format(dateRange.from, 'PPP');
              if (dateRange?.to) {
                  servicePeriodText += ` - ${format(dateRange.to, 'PPP')}`;
              }
          }

          const clientSummaryData: Record<string, { name: string, invoiced: number, paid: number, outstanding: number }> = {};
          
          filteredInvoices.forEach(inv => {
              const cid = inv.clientId || 'unknown';
              if (!clientSummaryData[cid]) {
                  const client = clients.find(c => c.id === cid);
                  clientSummaryData[cid] = {
                      name: client?.companyName || "Unknown Client",
                      invoiced: 0,
                      paid: 0,
                      outstanding: 0
                  };
              }
              const totalAmount = calculateTotal(inv);
              const amountPaid = inv.amountPaid || 0;
              clientSummaryData[cid].invoiced += totalAmount;
              clientSummaryData[cid].paid += amountPaid;
              clientSummaryData[cid].outstanding += (totalAmount - amountPaid);
          });

          const summaryTableRows = Object.values(clientSummaryData)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((data, idx) => [
                idx + 1,
                data.name,
                formatCurrency(data.invoiced),
                formatCurrency(data.paid),
                formatCurrency(data.outstanding)
            ]);
            
          const numClients = Object.keys(clientSummaryData).length;

          doc.setFontSize(11);
          doc.setFont("helvetica", "normal");
          doc.text(`Service Period: ${servicePeriodText}`, 14, 30);
          doc.text(`Total Clients: ${numClients}`, 14, 37);
          
          const summaryTableColumns = ['S/N', 'Client Name', 'Total Invoiced (TZS)', 'Total Paid (TZS)', 'Total Outstanding (TZS)'];

          (doc as any).autoTable({
            theme: 'grid',
            head: [summaryTableColumns],
            body: summaryTableRows,
            startY: 45,
            headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
            columnStyles: {
                2: { halign: 'right' },
                3: { halign: 'right' },
                4: { halign: 'right', fontStyle: 'bold', textColor: [192, 57, 43] },
            },
            foot: [
                ['', 'GRAND TOTAL:', formatCurrency(summary.totalInvoiced), formatCurrency(summary.totalPaid), formatCurrency(summary.totalOutstanding)],
            ],
            footStyles: { fontStyle: 'bold', halign: 'right', fillColor: [240, 240, 240], textColor: [0, 0, 0] }
          });
      }
      // ------------------------

      doc.save(fileName);
      toast({ title: "Export Successful", description: "Report exported to PDF." });
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast({ variant: "destructive", title: "Export Failed", description: "An error occurred while generating the PDF." });
    } finally {
      setIsExporting(false);
    }
  };

  const handleCsvExport = () => {
    try {
      const headers = ["S/N", "Client Name", "Invoice Date", "LPO No.", "Invoice No.", "Amount Outstanding", "Status"];
      const rows = filteredInvoices.map((invoice, index) => {
        const client = clients.find((c) => c.id === invoice.clientId);
        const totalAmount = calculateTotal(invoice);
        const outstandingAmount = totalAmount - (invoice.amountPaid || 0);
        return [
          index + 1,
          client?.companyName || "N/A",
          invoice.invoiceDate ? format(parseISO(invoice.invoiceDate), 'dd/MM/yyyy') : "N/A",
          invoice.lpoNumber || "",
          invoice.id,
          outstandingAmount,
          invoice.status.toUpperCase()
        ];
      });

      const csvContent = [
        headers.join(","),
        ...rows.map(row => row.map(val => {
          const str = String(val ?? '');
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        }).join(","))
      ].join("\n");

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      
      let fileName = "Invoice_Report";
      if (selectedClientIds.length === 1) {
        const clientName = clients.find(c => c.id === selectedClientIds[0])?.companyName || 'Client';
        fileName = clientName.replace(/ /g, '_');
      }
      fileName += `_${statusFilter}.csv`;

      link.setAttribute("href", url);
      link.setAttribute("download", fileName);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({ title: "Export Successful", description: "Report exported to CSV." });
    } catch (error) {
      console.error("Error exporting CSV:", error);
      toast({ variant: "destructive", title: "Export Failed", description: "An error occurred while generating the CSV." });
    }
  };

  const handleExcelExport = () => {
    try {
      const headers = ["S/N", "Client Name", "Invoice Date", "LPO No. (if available)", "Invoice No.", "Amount Outstanding", "Status"];
      const rows = filteredInvoices.map((invoice, index) => {
        const client = clients.find((c) => c.id === invoice.clientId);
        const totalAmount = calculateTotal(invoice);
        const outstandingAmount = totalAmount - (invoice.amountPaid || 0);
        return [
          index + 1,
          client?.companyName || "N/A",
          invoice.invoiceDate ? format(parseISO(invoice.invoiceDate), 'dd/MM/yyyy') : "N/A",
          invoice.lpoNumber || "-",
          invoice.id,
          formatCurrency(outstandingAmount),
          invoice.status.toUpperCase()
        ];
      });

      let excelHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">`;
      excelHtml += `<head><meta charset="utf-8" />`;
      excelHtml += `<style>`;
      excelHtml += `table { font-family: Arial, sans-serif; font-size: 12pt; border-collapse: collapse; }`;
      excelHtml += `th { font-family: Arial, sans-serif; font-size: 12pt; font-weight: bold; background-color: #f2f2f2; border: 1px solid #cccccc; padding: 6px; text-align: left; }`;
      excelHtml += `td { font-family: Arial, sans-serif; font-size: 12pt; border: 1px solid #cccccc; padding: 6px; }`;
      excelHtml += `.text-right { text-align: right; }`;
      excelHtml += `</style>`;
      excelHtml += `</head><body>`;
      excelHtml += `<table>`;
      
      // Header row
      excelHtml += `<tr>`;
      headers.forEach(h => {
        excelHtml += `<th>${h}</th>`;
      });
      excelHtml += `</tr>`;

      // Data rows
      rows.forEach(row => {
        excelHtml += `<tr>`;
        row.forEach((val, idx) => {
          if (idx === 5) {
            excelHtml += `<td class="text-right">${val}</td>`;
          } else {
            excelHtml += `<td>${val}</td>`;
          }
        });
        excelHtml += `</tr>`;
      });

      // Total row
      excelHtml += `<tr>`;
      excelHtml += `<td colspan="5" style="font-weight: bold; text-align: right; font-family: Arial, sans-serif; font-size: 12pt;">Total Outstanding (TZS):</td>`;
      excelHtml += `<td style="font-weight: bold; text-align: right; color: #d97706; font-family: Arial, sans-serif; font-size: 12pt;">${formatCurrency(summary.totalOutstanding)}</td>`;
      excelHtml += `<td></td>`;
      excelHtml += `</tr>`;

      excelHtml += `</table></body></html>`;

      const blob = new Blob([excelHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      
      let fileName = "Invoice_Report";
      if (selectedClientIds.length === 1) {
        const clientName = clients.find(c => c.id === selectedClientIds[0])?.companyName || 'Client';
        fileName = clientName.replace(/ /g, '_');
      }
      fileName += `_${statusFilter}.xls`;

      link.setAttribute("href", url);
      link.setAttribute("download", fileName);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({ title: "Export Successful", description: "Report exported to Excel (Arial 12pt)." });
    } catch (error) {
      console.error("Error exporting Excel:", error);
      toast({ variant: "destructive", title: "Export Failed", description: "An error occurred while generating the Excel export." });
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
          <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Invoiced (TZS)</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(summary.totalInvoiced)}</div></CardContent></Card>
          <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Paid (TZS)</CardTitle><CheckCircle className="h-4 w-4 text-green-500" /></CardHeader><CardContent><div className="text-2xl font-bold text-green-600">{formatCurrency(summary.totalPaid)}</div></CardContent></Card>
          <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Outstanding (TZS)</CardTitle><AlertCircle className="h-4 w-4 text-orange-500" /></CardHeader><CardContent><div className="text-2xl font-bold text-orange-600">{formatCurrency(summary.totalOutstanding)}</div></CardContent></Card>
      </div>

      <Card>
          <CardHeader>
            <CardTitle>{generateDynamicTitle()}</CardTitle>
             <div className="flex items-center gap-2 pt-4 flex-wrap">
              <Popover open={clientPopoverOpen} onOpenChange={setClientPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full md:w-[240px] justify-between">
                    Select Clients...
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0">
                  <Command>
                    <CommandInput placeholder="Search client..." />
                    <CommandList>
                      <CommandEmpty>No clients found.</CommandEmpty>
                      <CommandGroup>
                        {clients.map((client) => (
                          <CommandItem
                            key={client.id}
                            value={client.companyName}
                            onSelect={() => {
                              setSelectedClientIds((prev) =>
                                prev.includes(client.id)
                                  ? prev.filter((id) => id !== client.id)
                                  : [...prev, client.id]
                              );
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", selectedClientIds.includes(client.id) ? "opacity-100" : "opacity-0")} />
                            {client.companyName}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

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
               <Select onValueChange={(value: Region | "all") => setRegionFilter(value)} value={regionFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="Filter by Region" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Regions</SelectItem>
                    {REGIONS.map(region => (
                       <SelectItem key={region} value={region}>{region}</SelectItem>
                    ))}
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
              <Button onClick={handleExcelExport} variant="outline" size="sm">
                 <FileSpreadsheet className="mr-2 h-4 w-4" />
                 Export CSV
              </Button>
            </div>
            <div className="flex items-center gap-6 pt-4 flex-wrap text-sm text-muted-foreground">
                <div className="flex items-center space-x-2">
                    <Switch id="sort-client" checked={sortByClient} onCheckedChange={setSortByClient} />
                    <Label htmlFor="sort-client">Group by Client</Label>
                </div>
                <div className="flex items-center space-x-2">
                    <Switch id="one-client-page" checked={oneClientPerPage} onCheckedChange={setOneClientPerPage} />
                    <Label htmlFor="one-client-page">1 Client per Page (PDF Export)</Label>
                </div>
            </div>
             <div className="flex flex-wrap gap-2 pt-2">
                {selectedClientIds.map((id) => {
                    const client = clients.find((c) => c.id === id);
                    return (
                        <Badge key={id} variant="secondary" className="pl-2">
                            {client?.companyName}
                            <button
                                onClick={() => setSelectedClientIds(selectedClientIds.filter((cid) => cid !== id))}
                                className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </Badge>
                    )
                })}
             </div>
        </CardHeader>
        <CardContent>
           <Table>
            <TableHeader>
              <TableRow>
                <TableHead>S/N</TableHead>
                <TableHead>Client Name</TableHead>
                <TableHead>Invoice Date</TableHead>
                <TableHead>LPO No. (if available)</TableHead>
                <TableHead>Invoice No.</TableHead>
                <TableHead className="text-right">Amount Outstanding (TZS)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Registry</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center h-24"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
              ) : filteredInvoices.length > 0 ? filteredInvoices.map((invoice, index) => {
                const client = clients.find((c) => c.id === invoice.clientId);
                const totalAmount = calculateTotal(invoice);
                const outstandingAmount = totalAmount - (invoice.amountPaid || 0);
                return (
                  <TableRow key={invoice.id}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell className="font-medium">{client?.companyName || "N/A"}</TableCell>
                    <TableCell>{invoice.invoiceDate ? format(parseISO(invoice.invoiceDate), 'dd/MM/yyyy') : "N/A"}</TableCell>
                    <TableCell>{invoice.lpoNumber || "-"}</TableCell>
                    <TableCell className="font-mono text-xs">{invoice.id}</TableCell>
                    <TableCell className="font-bold text-right text-orange-600">{formatCurrency(outstandingAmount)}</TableCell>
                    <TableCell>
                        <Badge variant={invoice.status === 'paid' ? 'default' : invoice.status === 'partially paid' ? 'outline' : 'destructive'} className="uppercase text-[9px]">
                            {invoice.status}
                        </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => setRegistryInvoice(invoice)}>
                            <Info className="h-4 w-4 text-primary" />
                        </Button>
                    </TableCell>
                  </TableRow>
                )
              }) : (
                <TableRow><TableCell colSpan={8} className="text-center h-24">No invoices found for the selected criteria.</TableCell></TableRow>
              )}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={5} className="text-right font-bold text-sm">Total Outstanding (TZS)</TableCell>
                <TableCell className="font-bold text-sm text-primary text-right">{formatCurrency(summary.totalOutstanding)}</TableCell>
                <TableCell colSpan={2}></TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
      <InvoiceRegistryDialog 
        invoice={registryInvoice} 
        open={!!registryInvoice} 
        onOpenChange={(open) => !open && setRegistryInvoice(null)} 
      />
    </div>
  );
}
