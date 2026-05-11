"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileText, Loader2, ArrowLeft, DollarSign, ShoppingCart, User, Search, ListFilter, ChevronsUpDown, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useOrderStorage } from "@/hooks/use-order-storage";
import { useClientStorage } from "@/hooks/use-client-storage";
import jsPDF from "jspdf";
import "jspdf-autotable";
import type { ClientEvent } from "@/types";
import { format } from 'date-fns';
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";
import { DatePicker } from "@/components/ui/date-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

const calculateTotal = (events: ClientEvent[]) => {
    return events.reduce((sum, event) => sum + (event.unitPrice * event.numberOfPeople), 0);
};

export default function MonthlyOrderReportPage() {
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const { toast } = useToast();
  const { orders, isLoading: ordersLoading } = useOrderStorage();
  const { clients, getClientById, isLoading: clientsLoading } = useClientStorage();
  const [isExporting, setIsExporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("customerName");
  const [showUnlinkedOnly, setShowUnlinkedOnly] = useState(false);
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false);

  const monthlyOrders = useMemo(() => {
    const monthStr = format(selectedMonth, 'yyyy-MM');
    let filtered = orders.filter(order => {
        const start = order.startDate?.substring(0, 7);
        const end = order.endDate?.substring(0, 7);
        return (start && start <= monthStr) && (end && end >= monthStr);
    });

    if (selectedClientIds.length > 0) {
        const set = new Set(selectedClientIds);
        filtered = filtered.filter(order => order.clientId && set.has(order.clientId));
    }

    if (showUnlinkedOnly) {
        filtered = filtered.filter(order => !order.proformaId);
    }

    if (searchQuery) {
        const lowercasedQuery = searchQuery.toLowerCase();
        filtered = filtered.filter(order => {
            const clientName = getClientById(order.clientId)?.companyName.toLowerCase() || "";
            switch (filterType) {
                case 'id': return order.id.toLowerCase().includes(lowercasedQuery);
                case 'customerName': return clientName.includes(lowercasedQuery);
                default: return true;
            }
        });
    }

    return filtered;
  }, [selectedMonth, orders, searchQuery, filterType, getClientById, showUnlinkedOnly, selectedClientIds]);

  const summary = useMemo(() => {
    const totalSales = monthlyOrders.reduce((sum, order) => sum + calculateTotal(order.clientEvents), 0);
    const totalOrders = monthlyOrders.length;
    const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

    const clientOrderCounts = monthlyOrders.reduce((acc, order) => {
        const clientId = order.clientId;
        acc[clientId] = (acc[clientId] || 0) + 1;
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
      const monthFormatted = format(selectedMonth, 'MMMM yyyy');
      doc.text(`Monthly Order Report - ${monthFormatted}`, 14, 15);

      (doc as any).autoTable({
        head: [['Order ID', 'Customer Name', 'Period', 'Amount']],
        body: monthlyOrders.map(order => {
          const client = getClientById(order.clientId);
          return [
            order.id,
            client?.companyName || "N/A",
            `${order.startDate} - ${order.endDate}`,
            formatCurrency(calculateTotal(order.clientEvents)),
          ];
        }),
        startY: 25,
        foot: [
            ['', '', 'Total Sales', formatCurrency(summary.totalSales)],
        ],
        footStyles: { fontStyle: 'bold' }
      });

      doc.save(`Monthly_Order_Report_${format(selectedMonth, 'yyyy-MM')}.pdf`);
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
            <CardTitle>Orders for: {format(selectedMonth, 'MMMM yyyy')}</CardTitle>
            <div className="flex items-center gap-2 pt-4 flex-wrap">

              {/* Client multi-select */}
              <Popover open={clientPopoverOpen} onOpenChange={setClientPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full md:w-[200px] justify-between">
                    {selectedClientIds.length > 0 ? `${selectedClientIds.length} client(s)` : "All Clients"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[280px] p-0">
                  <Command>
                    <CommandInput placeholder="Search client..." />
                    <CommandList>
                      <CommandEmpty>No clients found.</CommandEmpty>
                      <CommandGroup>
                        {clients
                          .slice()
                          .sort((a, b) => a.companyName.localeCompare(b.companyName))
                          .map(client => (
                            <CommandItem
                              key={client.id}
                              value={client.companyName}
                              onSelect={() =>
                                setSelectedClientIds(prev =>
                                  prev.includes(client.id)
                                    ? prev.filter(id => id !== client.id)
                                    : [...prev, client.id]
                                )
                              }
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

              {/* Text search + field filter */}
              <div className="relative flex-1 min-w-[160px]">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder={`Search by ${filterType === 'id' ? 'Order ID' : 'Customer Name'}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg bg-background pl-8"
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="h-9 gap-1"><ListFilter className="h-3.5 w-3.5" /><span className="sr-only sm:not-sr-only">Filter</span></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Filter by</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem checked={filterType === 'customerName'} onCheckedChange={() => setFilterType('customerName')}>Customer Name</DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={filterType === 'id'} onCheckedChange={() => setFilterType('id')}>Order ID</DropdownMenuCheckboxItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem checked={showUnlinkedOnly} onCheckedChange={setShowUnlinkedOnly}>Unlinked to Proforma</DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <DatePicker
                selectedDate={selectedMonth}
                onDateChange={setSelectedMonth}
                labelFormat="MMMM yyyy"
                isMonthPicker
              />
              <Button onClick={handlePdfExport} variant="outline" size="sm" disabled={isExporting}>
                 {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                 {isExporting ? 'Exporting...' : 'Export PDF'}
              </Button>
            </div>

            {/* Active client filter badges */}
            {selectedClientIds.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {selectedClientIds.map(id => {
                  const client = clients.find(c => c.id === id);
                  return (
                    <Badge key={id} variant="secondary" className="pl-2">
                      {client?.companyName}
                      <button
                        onClick={() => setSelectedClientIds(prev => prev.filter(cid => cid !== id))}
                        className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  );
                })}
                <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground" onClick={() => setSelectedClientIds([])}>
                  Clear all
                </Button>
              </div>
            )}
        </CardHeader>
        <CardContent>
           <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center h-24"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
              ) : monthlyOrders.length > 0 ? monthlyOrders.map((order) => {
                const client = getClientById(order.clientId);
                const total = calculateTotal(order.clientEvents);
                return (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-xs">{order.id}</TableCell>
                    <TableCell className="font-medium">{client?.companyName || "N/A"}</TableCell>
                    <TableCell className="text-xs">{order.startDate} to {order.endDate}</TableCell>
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
