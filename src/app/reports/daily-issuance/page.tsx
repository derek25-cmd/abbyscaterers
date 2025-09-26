
"use client";

import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { FileText, Loader2, Download, ArrowLeft } from "lucide-react";
import DateSelector from "@/components/costing/DateSelector";
import { useToast } from "@/hooks/use-toast";
import { getIssuances } from "@/services/issuanceService";
import jsPDF from "jspdf";
import "jspdf-autotable";
import type { Issuance } from "@/types";
import { format, parseISO } from 'date-fns';
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export default function DailyIssuanceReportPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [logs, setLogs] = useState<Issuance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const fetchIssuances = async () => {
      setIsLoading(true);
      const data = await getIssuances();
      setLogs(data);
      setIsLoading(false);
    };
    fetchIssuances();
  }, []);

  const dailyIssuances = useMemo(() => {
    if(!selectedDate) return [];
    const targetDateStr = format(selectedDate, 'yyyy-MM-dd');
    return logs.filter(log => log.date === targetDateStr);
  }, [selectedDate, logs]);

  const totalValueIssued = useMemo(() => {
    return dailyIssuances.reduce((sum, log) => sum + log.totalValue, 0);
  }, [dailyIssuances]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS', currencyDisplay: 'code' }).format(amount);
  }

  const handlePdfExport = () => {
    setIsExporting(true);
    try {
      const doc = new jsPDF();
      const reportTitle = `Daily Issuance Report - ${format(selectedDate, "PPP")}`;
      doc.text(reportTitle, 14, 15);

      const tableColumn = ["Issue ID", "Issued To", "Order ID", "Status", "Total Value"];
      const tableRows: (string | number)[][] = [];

      dailyIssuances.forEach(log => {
        const logData = [
          log.id,
          log.issuedTo,
          log.orderId,
          log.status,
          formatCurrency(log.totalValue)
        ];
        tableRows.push(logData);
      });
      
      tableRows.push(["", "", "", "Total", formatCurrency(totalValueIssued)]);

      (doc as any).autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 25,
        foot: [[
            { content: `Total Value Issued: ${formatCurrency(totalValueIssued)}`, colSpan: 5, styles: { halign: 'right', fontStyle: 'bold' } }
        ]],
        showFoot: 'lastPage'
      });

      doc.save(`Daily_Issuance_Report_${format(selectedDate, "yyyy-MM-dd")}.pdf`);
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
          <h1 className="text-3xl font-bold text-foreground">Daily Issuance Report</h1>
          <p className="text-muted-foreground">View all assets and items issued on a specific day.</p>
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

      <Card className="bg-card p-4 rounded-lg">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Issuances for: {selectedDate ? format(selectedDate, 'PPP') : 'N/A'}</span>
            <div className="text-right">
                <p className="text-sm font-medium text-muted-foreground">Total Value Issued</p>
                <p className="text-xl font-bold text-primary">{formatCurrency(totalValueIssued)}</p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
           <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Issue ID</TableHead>
                <TableHead>Issued To</TableHead>
                <TableHead>Order ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center h-24"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
              ) : dailyIssuances.length > 0 ? dailyIssuances.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-xs">{log.id}</TableCell>
                    <TableCell className="font-medium">{log.issuedTo}</TableCell>
                    <TableCell className="font-mono text-xs">{log.orderId}</TableCell>
                    <TableCell><Badge variant="outline">{log.status}</Badge></TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(log.totalValue)}</TableCell>
                  </TableRow>
              )) : (
                <TableRow><TableCell colSpan={5} className="text-center h-24">No issuances found for this date.</TableCell></TableRow>
              )}
            </TableBody>
            <TableFooter>
                <TableRow>
                    <TableCell colSpan={4} className="text-right font-bold">Total</TableCell>
                    <TableCell className="text-right font-bold">{formatCurrency(totalValueIssued)}</TableCell>
                </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
