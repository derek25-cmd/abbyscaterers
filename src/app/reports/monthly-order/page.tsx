
"use client";

import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { FileText, Loader2, Download, ArrowLeft, DollarSign, ShoppingCart, User, Search, ListFilter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useOrderStorage } from "@/hooks/use-order-storage";
import { useClientStorage } from "@/hooks/use-client-storage";
import jsPDF from "jspdf";
import "jspdf-autotable";
import type { ClientEvent, Order } from "@/types";
import { format, parseISO } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

const calculateTotal = (events: ClientEvent[]) => {
    return events.reduce((sum, event) => sum + (event.unitPrice * event.numberOfPeople), 0);
};

export default function MonthlyOrderReportPage() {
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), 'yyyy-MM'));
  const { toast } = useToast();
  const { orders, isLoading: ordersLoading } = useOrderStorage();
  const { getClientById, isLoading: clientsLoading } = useClientStorage();
  const [isExporting, setIsExporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("customerName");
  
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    orders.forEach(order => {
        if(order.createdAt) {
            months.add(format(parseISO(order.createdAt), 'yyyy-MM'));
        }
    });
    return Array.from(months).sort().reverse();
  }, [orders]);


  const monthlyOrders = useMemo(() => {
    let filtered = orders.filter(order => order.createdAt && format(parseISO(order.createdAt), 'yyyy-MM') === selectedMonth);
    
    if (searchQuery) {
        const lowercasedQuery = searchQuery.toLowerCase();
        filtered = filtered.filter(order => {
            const clientName = order.clientEvents.length > 0 ? getClientById(order.clientEvents[0].clientId)?.companyName.toLowerCase() || "" : "";
            switch (filterType) {
                case 'id': return order.id.toLowerCase().includes(lowercasedQuery);
                case 'customerName': return clientName.includes(lowercasedQuery);
                default: return true;
            }
        });
    }

    return filtered;
  }, [selectedMonth, orders, searchQuery, filterType, getClientById]);

  const summary = useMemo(() => {
    const totalSales = monthlyOrders.reduce((sum, order) => sum + calculateTotal(order.clientEvents), 0);
    const totalOrders = monthlyOrders.length;
    const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;
    
    const clientOrderCounts = monthlyOrders.reduce((acc, order) => {
        if (order.clientEvents.length > 0) {
            const clientId = order.clientEvents[0].clientId;
            acc[clientId] = (acc[clientId] || 0) + 1;
        }
        return acc;
    }, {} as Record<string, number>);

    const busiestClientId = Object.keys(clientOrderCounts).reduce((a, b) => clientOrderCounts[a] > clientOrderCounts[b] ? a : b, '');
    const busiestClient = getClientById(busiestClientId)?.companyName || "N/A";

    return { totalSales, totalOrders, averageOrderValue, busiestClient };
  }, [monthlyOrders, getClientById]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS', currencyDisplay: 'code' }).format(amount);
  }

  const handlePdfExport = () => {
    setIsExporting(true);
    try {
      const doc = new jsPDF({ orientation: 'landscape' });
      const monthFormatted = format(parseISO(`${selectedMonth}-01`), 'MMMM yyyy');
      doc.text(`Monthly Order Report - ${monthFormatted}`, 14, 15);

      (doc as any).autoTable({
        head: [['Order ID', 'Customer Name', 'Date', 'Amount']],
        body: monthlyOrders.map(order => {
          const client = order.clientEvents.length > 0 ? getClientById(order.clientEvents[0].clientId) : null;
          return [
            order.id,
            client?.companyName || "N/A",
            order.createdAt ? format(parseISO(order.createdAt), 'PPP') : "N/A",
            formatCurrency(calculateTotal(order.clientEvents)),
          ];
        }),
        startY: 25,
        foot: [
            ['', '', 'Total Sales', formatCurrency(summary.totalSales)],
        ],
        footStyles: { fontStyle: 'bold' }
      });

      doc.save(`Monthly_Order_Report_${selectedMonth}.pdf`);
      toast({ title: "Export Successful", description: "Report exported to PDF." });
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast({ variant: "destructive", title: "Export Failed", description: "An error occurred while generating the PDF." });
    } finally {
      setIsExporting(false);
    }
  };

  const isLoading = ordersLoading || clientsLoading;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Monthly Order Report</h1>
          <p className="text-muted-foreground">Analyze sales and order volumes for a selected month.</p>
        </div>
        <div className="flex items-center space-x-3">
          <Button asChild variant="outline" size="sm">
            <Link href="/reports"><ArrowLeft className="mr-2 h-4 w-4" />Back to Reports</Link>
          </Button>
        </div>
      </div>
      
       <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Sales</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(summary.totalSales)}</div></CardContent></Card>
          <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Orders</CardTitle><ShoppingCart className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{summary.totalOrders}</div></CardContent></Card>
          <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Average Order Value</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(summary.averageOrderValue)}</div></CardContent></Card>
          <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Busiest Client</CardTitle><User className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold truncate">{summary.busiestClient}</div></CardContent></Card>
      </div>

      <Card>
          <CardHeader>
            <CardTitle>Orders for: {format(parseISO(`${selectedMonth}-01`), 'MMMM yyyy')}</CardTitle>
             <div className="flex items-center gap-2 pt-4">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder={`Search by ${filterType === 'id' ? 'Order ID' : 'Customer Name'}...`}
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
                  <DropdownMenuCheckboxItem checked={filterType === 'customerName'} onCheckedChange={() => setFilterType('customerName')}>Customer Name</DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={filterType === 'id'} onCheckedChange={() => setFilterType('id')}>Order ID</DropdownMenuCheckboxItem>
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
                <TableHead>Order ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center h-24"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
              ) : monthlyOrders.length > 0 ? monthlyOrders.map((order) => {
                const client = order.clientEvents.length > 0 ? getClientById(order.clientEvents[0].clientId) : null;
                const total = calculateTotal(order.clientEvents);
                return (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-xs">{order.id}</TableCell>
                    <TableCell className="font-medium">{client?.companyName || "N/A"}</TableCell>
                    <TableCell>{order.createdAt ? format(parseISO(order.createdAt), 'PPP') : "N/A"}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(total)}</TableCell>
                  </TableRow>
                )
              }) : (
                <TableRow><TableCell colSpan={4} className="text-center h-24">No orders found for this month.</TableCell></TableRow>
              )}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3} className="text-right font-bold text-lg">Total Sales for Month</TableCell>
                <TableCell className="text-right font-bold text-lg text-primary">{formatCurrency(summary.totalSales)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
