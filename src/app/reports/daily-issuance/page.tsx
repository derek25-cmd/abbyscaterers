
"use client";

import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { FileText, Loader2, Download, ArrowLeft, Search, ListFilter } from "lucide-react";
import DateSelector from "@/components/costing/DateSelector";
import { useToast } from "@/hooks/use-toast";
import { getIssuances } from "@/services/issuanceService";
import jsPDF from "jspdf";
import "jspdf-autotable";
import type { Issuance } from "@/types";
import { format, parseISO } from 'date-fns';
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";

export default function DailyIssuanceReportPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [logs, setLogs] = useState<Issuance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("issuedTo");

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
    let filteredLogs = logs;
    if (selectedDate) {
      const targetDateStr = format(selectedDate, 'yyyy-MM-dd');
      filteredLogs = filteredLogs.filter(log => log.date === targetDateStr);
    }
    
    if (searchQuery) {
        const lowercasedQuery = searchQuery.toLowerCase();
        filteredLogs = filteredLogs.filter(log => {
            switch(filterType) {
                case 'issuedTo': return log.issuedTo.toLowerCase().includes(lowercasedQuery);
                case 'orderId': return log.orderId.toLowerCase().includes(lowercasedQuery);
                case 'status': return log.status.toLowerCase().includes(lowercasedQuery);
                default: return true;
            }
        });
    }

    return filteredLogs;
  }, [selectedDate, logs, searchQuery, filterType]);

  const totalValueIssued = useMemo(() => {
    return dailyIssuances.reduce((sum, log) => sum + log.totalValue, 0);
  }, [dailyIssuances]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS', currencyDisplay: 'code' }).format(amount);
  }

  const handlePdfExport = () => {
    setIsExporting(true);
    try {
      const doc = new jsPDF({ orientation: 'landscape' });
      const reportTitle = `Daily Issuance Report - ${selectedDate ? format(selectedDate, "PPP") : 'All Dates'}`;
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
      
      (doc as any).autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 25,
        foot: [[
            { content: `Total Value Issued: ${formatCurrency(totalValueIssued)}`, colSpan: 5, styles: { halign: 'right', fontStyle: 'bold' } }
        ]],
        showFoot: 'lastPage'
      });

      doc.save(`Daily_Issuance_Report_${selectedDate ? format(selectedDate, "yyyy-MM-dd") : 'all_dates'}.pdf`);
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
          <Button asChild variant="outline" size="sm">
            <Link href="/reports"><ArrowLeft className="mr-2 h-4 w-4" />Back to Reports</Link>
          </Button>
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Issuances for: {selectedDate ? format(selectedDate, 'PPP') : 'All Dates'}</span>
            <div className="text-right">
                <p className="text-sm font-medium text-muted-foreground">Total Value Issued</p>
                <p className="text-xl font-bold text-primary">{formatCurrency(totalValueIssued)}</p>
            </div>
          </CardTitle>
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
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 gap-1">
                    <ListFilter className="h-3.5 w-3.5" />
                    <span className="sr-only sm:not-sr-only">Filter</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Filter by</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem checked={filterType === 'issuedTo'} onCheckedChange={() => setFilterType('issuedTo')}>Issued To</DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={filterType === 'orderId'} onCheckedChange={() => setFilterType('orderId')}>Order ID</DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={filterType === 'status'} onCheckedChange={() => setFilterType('status')}>Status</DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>
             <DateSelector selectedDate={selectedDate} onDateChange={setSelectedDate} />
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
