"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { FileText, Loader2, Download, ArrowLeft, Search, ListFilter } from "lucide-react";
import DateSelector from "@/components/costing/DateSelector";
import { useToast } from "@/hooks/use-toast";
import { useOrderStorage } from "@/hooks/use-order-storage";
import { useClientStorage } from "@/hooks/use-client-storage";
import jsPDF from "jspdf";
import "jspdf-autotable";
import type { ClientEvent, Order } from "@/types";
import { format } from 'date-fns';
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";

interface DailyEventInfo extends ClientEvent {
  orderId: string;
  proformaId?: string;
  clientId: string;
}

export default function DailyOrderReportPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const { toast } = useToast();
  const { orders, isLoading: ordersLoading } = useOrderStorage();
  const { getClientById, isLoading: clientsLoading } = useClientStorage();
  const [isExporting, setIsExporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("customerName");
  const [showUnlinkedOnly, setShowUnlinkedOnly] = useState(false);

  const dailyEvents: DailyEventInfo[] = useMemo(() => {
    let eventsForDate: DailyEventInfo[] = [];
    if (selectedDate) {
        const targetDateStr = format(selectedDate, 'yyyy-MM-dd');
        eventsForDate = orders.flatMap((order: Order) =>
            order.clientEvents
                .filter(event => event.date?.startsWith(targetDateStr))
                .map(event => ({
                    ...event,
                    orderId: order.id,
                    proformaId: order.proformaId,
                    clientId: order.clientId, // Pull customer ID from the top-level order
                }))
        );
    }
    
    if (showUnlinkedOnly) {
        eventsForDate = eventsForDate.filter(event => !event.proformaId);
    }

    if (searchQuery) {
        const lowercasedQuery = searchQuery.toLowerCase();
        return eventsForDate.filter(event => {
            const client = getClientById(event.clientId);
            const clientName = client?.companyName.toLowerCase() || "unknown";
            switch (filterType) {
                case 'orderId': return event.orderId.toLowerCase().includes(lowercasedQuery);
                case 'proformaId': return event.proformaId?.toLowerCase().includes(lowercasedQuery) ?? false;
                case 'mealType': return event.mealType?.toLowerCase().includes(lowercasedQuery) ?? false;
                case 'customerName':
                default:
                    return clientName.includes(lowercasedQuery);
            }
        });
    }

    return eventsForDate;
  }, [selectedDate, orders, searchQuery, filterType, getClientById, showUnlinkedOnly]);

  const calculateGrandTotal = (event: ClientEvent) => {
    const total = (event.unitPrice || 0) * (event.numberOfPeople || 0);
    return total;
  };
  
  const totalSales = useMemo(() => {
    return dailyEvents.reduce((sum, event) => sum + calculateGrandTotal(event), 0);
  }, [dailyEvents]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS', currencyDisplay: 'code' }).format(amount);
  }

  const handlePdfExport = () => {
    setIsExporting(true);
    try {
        const doc = new jsPDF({ orientation: 'landscape' });
        doc.text(`Daily Order Report - ${selectedDate ? format(selectedDate, "PPP") : 'All Dates'}`, 14, 15);

        const tableColumn = ["S/No", "Order ID", "Customer Name", "Proforma No.", "Type of Meal", "No. of People", "Unit Price", "VAT", "Grand Total"];
        const tableRows: (string | number)[][] = [];
        
        dailyEvents.forEach((event, index) => {
          const client = getClientById(event.clientId);
          tableRows.push([
              index + 1,
              event.orderId,
              client?.companyName || 'N/A',
              event.proformaId || 'N/A',
              event.mealType || 'N/A',
              event.numberOfPeople || 0,
              formatCurrency(event.unitPrice || 0),
              event.vatType || 'N/A',
              formatCurrency(calculateGrandTotal(event)),
          ]);
        });
        
        (doc as any).autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: 25,
            foot: [[
                { content: `Total Sales for the Day: ${formatCurrency(totalSales)}`, colSpan: 9, styles: { halign: 'right', fontStyle: 'bold' } }
            ]],
            showFoot: 'lastPage'
        });
        
        doc.save(`Daily_Order_Report_${selectedDate ? format(selectedDate, 'yyyy-MM-dd') : 'all_dates'}.pdf`);
        toast({ title: "Export Successful", description: "Report exported to PDF." });
    } catch (error) {
        console.error("Error exporting PDF:", error);
        toast({ variant: "destructive", title: "Export Failed", description: "An error occurred while generating the PDF." });
    } finally {
        setIsExporting(false);
    }
  };

  const handleCsvExport = () => {
    const headers = ["S/No", "Order ID", "Customer Name", "Proforma No.", "Type of Meal", "No. of People", "Unit Price", "VAT", "Grand Total"];
    const csvRows = [headers.join(',')];

    dailyEvents.forEach((event, index) => {
      const client = getClientById(event.clientId);
      const row = [
        index + 1,
        event.orderId,
        `"${client?.companyName.replace(/"/g, '""') || 'N/A'}"`,
        event.proformaId || 'N/A',
        event.mealType || 'N/A',
        event.numberOfPeople || 0,
        event.unitPrice || 0,
        event.vatType || 'N/A',
        calculateGrandTotal(event),
      ];
      csvRows.push(row.join(','));
    });
    
    csvRows.push(['', '', '', '', '', '', '', 'Total Sales', totalSales].join(','));

    const csvString = csvRows.join('\r\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `Daily_Order_Report_${selectedDate ? format(selectedDate, 'yyyy-MM-dd'): 'all_dates'}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      toast({ title: "Export Successful", description: "Report exported to CSV." });
    } else {
       toast({ variant: "destructive", title: "Export Failed", description: "Your browser doesn't support this feature." });
    }
  };

  const isLoading = ordersLoading || clientsLoading;

  return (
    <div className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center mb-6">
            <div>
                <h1 className="text-3xl font-bold text-foreground">Daily Order Report</h1>
                <p className="text-muted-foreground">View a comprehensive summary of all orders for a specific day.</p>
            </div>
            <Button asChild variant="outline">
                <Link href="/reports">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Reports
                </Link>
            </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Orders for: {selectedDate ? format(selectedDate, 'PPP') : 'N/A'}</CardTitle>
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
                        <DropdownMenuCheckboxItem checked={filterType === 'customerName'} onCheckedChange={() => setFilterType('customerName')}>Customer</DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem checked={filterType === 'orderId'} onCheckedChange={() => setFilterType('orderId')}>Order ID</DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem checked={filterType === 'proformaId'} onCheckedChange={() => setFilterType('proformaId')}>Proforma No.</DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem checked={filterType === 'mealType'} onCheckedChange={() => setFilterType('mealType')}>Meal Type</DropdownMenuCheckboxItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuCheckboxItem checked={showUnlinkedOnly} onCheckedChange={setShowUnlinkedOnly}>Unlinked to Proforma</DropdownMenuCheckboxItem>
                    </DropdownMenuContent>
                </DropdownMenu>
                <DateSelector selectedDate={selectedDate} onDateChange={setSelectedDate} />
                <div className="flex items-center space-x-2">
                    <Button onClick={handleCsvExport} variant="outline" size="sm" disabled={isExporting}><Download className="mr-2 h-4 w-4" />CSV</Button>
                    <Button onClick={handlePdfExport} variant="outline" size="sm" disabled={isExporting}>{isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}{isExporting ? '...' : 'PDF'}</Button>
                </div>
            </div>
          </CardHeader>
          <CardContent>
             <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">S/No</TableHead>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Customer Name</TableHead>
                  <TableHead>Proforma No.</TableHead>
                  <TableHead>Type of Meal</TableHead>
                  <TableHead className="text-center">No. of People</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead>VAT</TableHead>
                  <TableHead className="text-right">Grand Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center h-24">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                    </TableCell>
                  </TableRow>
                ) : dailyEvents.length > 0 ? dailyEvents.map((event, index) => {
                  const client = getClientById(event.clientId);
                  const grandTotal = calculateGrandTotal(event);
                  return (
                    <TableRow key={`${event.orderId}-${index}`}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell className="font-mono text-xs">{event.orderId}</TableCell>
                      <TableCell className="font-medium">{client?.companyName || "N/A"}</TableCell>
                      <TableCell className="font-mono text-xs">{event.proformaId || "N/A"}</TableCell>
                      <TableCell>{event.mealType || 'N/A'}</TableCell>
                      <TableCell className="text-center">{event.numberOfPeople || 0}</TableCell>
                      <TableCell className="text-right">{formatCurrency(event.unitPrice || 0)}</TableCell>
                      <TableCell className="capitalize">{event.vatType || 'N/A'}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(grandTotal)}</TableCell>
                    </TableRow>
                  )
                }) : (
                  <TableRow>
                      <TableCell colSpan={9} className="text-center h-24">No orders found for this date.</TableCell>
                  </TableRow>
                )}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={8} className="text-right font-bold text-lg">Total Sales for the Day</TableCell>
                  <TableCell className="text-right font-bold text-lg text-primary">{formatCurrency(totalSales)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </CardContent>
        </Card>
    </div>
  );
}