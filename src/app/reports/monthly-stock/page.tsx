
"use client";

import { useState, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { FileText, Loader2, Download, ArrowLeft, TrendingUp, Package, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { format, parseISO } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";
import { useStockLogStorage } from "@/hooks/use-stock-log-storage";
import { useProductStorage } from "@/hooks/use-product-storage";

export default function MonthlyStockReportPage() {
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), 'yyyy-MM'));
  const { toast } = useToast();
  const { logs, isLoading: logsLoading } = useStockLogStorage();
  const { products, isLoading: productsLoading } = useProductStorage();
  const [isExporting, setIsExporting] = useState(false);

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    logs.forEach(log => months.add(format(parseISO(log.date), 'yyyy-MM')));
    return Array.from(months).sort().reverse();
  }, [logs]);
  
  const reportData = useMemo(() => {
    const stockOutLogs = logs.filter(log => 
        log.type === 'Stock Out' && 
        log.date.startsWith(selectedMonth)
    );
    
    const usageMap = new Map<string, { quantity: number; value: number; unit: string }>();

    stockOutLogs.forEach(log => {
      const product = products.find(p => p.id === log.productId);
      const unit = product?.unit || 'N/A';
      
      const current = usageMap.get(log.productName) || { quantity: 0, value: 0, unit: unit };
      current.quantity += log.quantity;
      current.value += log.price;
      usageMap.set(log.productName, current);
    });

    return Array.from(usageMap.entries()).map(([productName, data]) => ({
      productName,
      ...data
    })).sort((a,b) => b.value - a.value);
  }, [selectedMonth, logs, products]);
  
  const summary = useMemo(() => {
      const totalValue = reportData.reduce((sum, item) => sum + item.value, 0);
      const mostUsed = reportData.length > 0 ? reportData.reduce((prev, current) => (prev.quantity > current.quantity) ? prev : current) : null;
      return { totalValue, mostUsed: mostUsed?.productName || 'N/A' };
  }, [reportData]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS', currencyDisplay: 'code' }).format(amount);
  }
  
  const handleCsvExport = () => {
    setIsExporting(true);
    const headers = ["Product Name", "Quantity Used", "Unit", "Total Value (TZS)"];
    const csvRows = [headers.join(',')];

    reportData.forEach(d => {
      csvRows.push([`"${d.productName}"`, d.quantity, d.unit, d.value].join(','));
    });
    
    csvRows.push(['', '', 'Total', summary.totalValue].join(','));
    
    const csvString = csvRows.join('\r\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Monthly_Stock_Usage_${selectedMonth}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast({ title: "Export Successful", description: "Report exported to CSV." });
    setIsExporting(false);
  };
  
  const isLoading = logsLoading || productsLoading;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Monthly Stock Usage Report</h1>
          <p className="text-muted-foreground">Analyze product consumption for a selected month.</p>
        </div>
        <div className="flex items-center space-x-3">
          <Select onValueChange={setSelectedMonth} value={selectedMonth}>
              <SelectTrigger className="w-[240px]"><SelectValue placeholder="Select a month" /></SelectTrigger>
              <SelectContent>{availableMonths.map(month => (<SelectItem key={month} value={month}>{format(parseISO(`${month}-01`), 'MMMM yyyy')}</SelectItem>))}</SelectContent>
          </Select>
          <Button onClick={handleCsvExport} variant="outline" size="sm" disabled={isExporting}>
             {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
             {isExporting ? 'Exporting...' : 'Export CSV'}
          </Button>
          <Button asChild variant="outline" size="sm"><Link href="/reports"><ArrowLeft className="mr-2 h-4 w-4" />Back to Reports</Link></Button>
        </div>
      </div>
      
       <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Value of Stock Used</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{formatCurrency(summary.totalValue)}</div>
              <p className="text-xs text-muted-foreground">Total cost of all items stocked out</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Most Used Product</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.mostUsed}</div>
              <p className="text-xs text-muted-foreground">Product with the highest quantity stocked out</p>
            </CardContent>
          </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Stock Usage for: {format(parseISO(`${selectedMonth}-01`), 'MMMM yyyy')}</CardTitle></CardHeader>
        <CardContent>
           <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Product Name</TableHead>
                    <TableHead className="text-center">Unit</TableHead>
                    <TableHead className="text-right">Quantity Used</TableHead>
                    <TableHead className="text-right">Total Value</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center h-24"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
              ) : reportData.map((data) => (
                  <TableRow key={data.productName}>
                    <TableCell className="font-medium">{data.productName}</TableCell>
                    <TableCell className="text-center">{data.unit}</TableCell>
                    <TableCell className="text-right">{data.quantity}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(data.value)}</TableCell>
                  </TableRow>
              ))}
            </TableBody>
            <TableFooter>
                <TableRow>
                    <TableCell colSpan={3} className="text-right font-bold text-lg">Total Value</TableCell>
                    <TableCell className="text-right font-bold text-lg text-destructive">{formatCurrency(summary.totalValue)}</TableCell>
                </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
