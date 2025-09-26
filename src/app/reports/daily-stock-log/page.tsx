
"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Loader2, Download, ArrowLeft, ArrowUp, ArrowDown } from "lucide-react";
import DateSelector from "@/components/costing/DateSelector";
import { useToast } from "@/hooks/use-toast";
import { useStockLogStorage } from "@/hooks/use-stock-log-storage";
import jsPDF from "jspdf";
import "jspdf-autotable";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export default function DailyStockLogReportPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const { toast } = useToast();
  const { logs, isLoading } = useStockLogStorage();
  const [isExporting, setIsExporting] = useState(false);

  const dailyLogs = useMemo(() => {
    const targetDateStr = selectedDate.toISOString().split('T')[0];
    return logs.filter(log => log.date === targetDateStr);
  }, [selectedDate, logs]);

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
      const doc = new jsPDF({ orientation: 'l' });
      doc.text(`Daily Stock Log Report - ${selectedDate.toLocaleDateString()}`, 14, 15);
      
      (doc as any).autoTable({
        head: [['Log ID', 'Product', 'Type', 'Reason', 'Quantity', 'Total Value']],
        body: dailyLogs.map(log => [
          log.id,
          log.productName,
          log.type,
          log.reason,
          log.quantity,
          formatCurrency(log.price)
        ]),
        startY: 25,
        styles: { halign: 'right' },
        columnStyles: {
            0: { halign: 'left' },
            1: { halign: 'left' },
            2: { halign: 'left' },
            3: { halign: 'left' },
            4: { halign: 'center' },
        }
      });
      
      doc.save(`Daily_Stock_Log_Report_${selectedDate.toISOString().split('T')[0]}.pdf`);
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
          <DateSelector selectedDate={selectedDate} onDateChange={setSelectedDate} />
          <Button onClick={handlePdfExport} variant="outline" size="sm" disabled={isExporting}>
             {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
             {isExporting ? 'Exporting...' : 'Export PDF'}
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/reports"><ArrowLeft className="mr-2 h-4 w-4" />Back to Reports</Link>
          </Button>
        </div>
      </div>

       <div className="grid gap-4 md:grid-cols-2">
          <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Value Stocked In</CardTitle><ArrowDown className="h-4 w-4 text-green-500" /></CardHeader><CardContent><div className="text-2xl font-bold text-green-600">{formatCurrency(summary.stockInValue)}</div><p className="text-xs text-muted-foreground">{summary.stockInItems} items</p></CardContent></Card>
          <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Value Stocked Out</CardTitle><ArrowUp className="h-4 w-4 text-red-500" /></CardHeader><CardContent><div className="text-2xl font-bold text-red-600">{formatCurrency(summary.stockOutValue)}</div><p className="text-xs text-muted-foreground">{summary.stockOutItems} items</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Stock Movements for: {selectedDate.toLocaleDateString()}</CardTitle>
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
                <TableRow><TableCell colSpan={6} className="text-center h-24">No stock logs found for this date.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
