
"use client";

import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Loader2, Download, ArrowLeft, ArrowUp, ArrowDown, Search, ListFilter } from "lucide-react";
import DateSelector from "@/components/costing/DateSelector";
import { useToast } from "@/hooks/use-toast";
import { useStockLogStorage } from "@/hooks/use-stock-log-storage";
import jsPDF from "jspdf";
import "jspdf-autotable";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function DailyStockLogReportPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const { toast } = useToast();
  const { logs, isLoading } = useStockLogStorage();
  const [isExporting, setIsExporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("productName");
  const [branch, setBranch] = useState("All Branches");

  const dailyLogs = useMemo(() => {
    let filtered = logs;
    
    // Filter by branch
    if (branch !== "All Branches") {
      filtered = filtered.filter(log => (log.branch || 'Dar es Salaam') === branch);
    }
    if(selectedDate) {
        const targetDateStr = format(selectedDate, 'yyyy-MM-dd');
        filtered = filtered.filter(log => log.date === targetDateStr);
    }
    
    if(searchQuery) {
        const lowercasedQuery = searchQuery.toLowerCase();
        filtered = filtered.filter(log => {
            switch(filterType) {
                case 'productName': return log.productName.toLowerCase().includes(lowercasedQuery);
                case 'type': return log.type.toLowerCase().includes(lowercasedQuery);
                case 'reason': return log.reason.toLowerCase().includes(lowercasedQuery);
                default: return true;
            }
        });
    }

    return filtered;
  }, [selectedDate, logs, searchQuery, filterType, branch]);

  const summary = useMemo(() => {
    const stockIn = dailyLogs.filter(log => log.type === 'Stock In');
    const stockOut = dailyLogs.filter(log => log.type === 'Stock Out');
    return {
      stockInValue: stockIn.reduce((sum, log) => sum + log.price, 0),
      stockInItems: stockIn.reduce((sum, log) => sum + log.quantity, 0),
      stockOutValue: stockOut.reduce((sum, log) => sum + log.price, 0),
      stockOutItems: stockOut.reduce((sum, log) => sum + log.quantity, 0),
    }
  }, [dailyLogs]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS', currencyDisplay: 'code' }).format(amount);
  }

  const handlePdfExport = () => {
    setIsExporting(true);
    try {
      const doc = new jsPDF({ orientation: 'landscape' });
      doc.text(`Daily Stock Log Report - ${selectedDate ? format(selectedDate, 'PPP') : 'All Dates'} (${branch})`, 14, 15);
      
      const tableColumn = ["Log ID", "Product", "Type", "Reason", "Quantity", "Total Value"];
      const tableRows: (string | number)[][] = [];

      dailyLogs.forEach(log => {
        const logData = [
          log.id,
          log.productName,
          log.type,
          log.reason,
          log.quantity,
          formatCurrency(log.price)
        ];
        tableRows.push(logData);
      });

      (doc as any).autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 25,
      });
      
      doc.save(`Daily_Stock_Log_Report_${selectedDate ? format(selectedDate, "yyyy-MM-dd") : 'all_dates'}.pdf`);
      toast({ title: "Export Successful", description: "Report exported to PDF." });
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast({ variant: "destructive", title: "Export Failed", description: "An error occurred while generating the PDF." });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Daily Stock Log Report</h1>
          <p className="text-muted-foreground">Track all inventory movements for a selected day.</p>
        </div>
        <div className="flex items-center space-x-3">
          <Button asChild variant="outline" size="sm"><Link href="/reports"><ArrowLeft className="mr-2 h-4 w-4" />Back to Reports</Link></Button>
        </div>
      </div>

       <div className="grid gap-4 md:grid-cols-2">
          <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Value Stocked In</CardTitle><ArrowDown className="h-4 w-4 text-green-500" /></CardHeader><CardContent><div className="text-2xl font-bold text-green-600">{formatCurrency(summary.stockInValue)}</div><p className="text-xs text-muted-foreground">{summary.stockInItems} items</p></CardContent></Card>
          <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Value Stocked Out</CardTitle><ArrowUp className="h-4 w-4 text-red-500" /></CardHeader><CardContent><div className="text-2xl font-bold text-red-600">{formatCurrency(summary.stockOutValue)}</div><p className="text-xs text-muted-foreground">{summary.stockOutItems} items</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
            <CardTitle>Stock Movements for: {selectedDate ? format(selectedDate, 'PPP') : 'N/A'}</CardTitle>
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
                  <DropdownMenuCheckboxItem checked={filterType === 'productName'} onCheckedChange={() => setFilterType('productName')}>Product</DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={filterType === 'type'} onCheckedChange={() => setFilterType('type')}>Type</DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={filterType === 'reason'} onCheckedChange={() => setFilterType('reason')}>Reason</DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Select value={branch} onValueChange={setBranch}>
                 <SelectTrigger className="w-[180px]">
                     <SelectValue placeholder="Branch" />
                 </SelectTrigger>
                 <SelectContent>
                     <SelectItem value="All Branches">All Branches</SelectItem>
                     <SelectItem value="Dar es Salaam">Dar es Salaam</SelectItem>
                     <SelectItem value="Arusha">Arusha</SelectItem>
                     <SelectItem value="Dodoma">Dodoma</SelectItem>
                 </SelectContent>
              </Select>
              <DateSelector selectedDate={selectedDate} onDateChange={setSelectedDate} />
              <Button onClick={handlePdfExport} variant="outline" size="sm" disabled={isExporting}>
                 {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                 {isExporting ? 'Exporting...' : 'Export PDF'}
              </Button>
          </div>
        </CardHeader>
        <CardContent>
           <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Log ID</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Total Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center h-24"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
              ) : dailyLogs.length > 0 ? dailyLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-xs">{log.id}</TableCell>
                    <TableCell className="font-medium">{log.productName}</TableCell>
                    <TableCell>
                        <Badge variant={log.type === 'Stock In' ? 'secondary' : 'destructive'} className={log.type === 'Stock In' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>{log.type}</Badge>
                    </TableCell>
                    <TableCell>{log.reason}</TableCell>
                    <TableCell className="text-right">{log.quantity}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(log.price)}</TableCell>
                  </TableRow>
              )) : (
                <TableRow><TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                  {logs.length === 0 
                    ? 'No stock logs loaded from database. Check your Supabase connection.' 
                    : `No logs found for this date/branch. (${logs.length} total logs loaded — try "All Branches")`
                  }
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
