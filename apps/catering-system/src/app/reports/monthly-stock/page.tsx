"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { FileText, Loader2, Download, ArrowLeft, TrendingUp, DollarSign, Search, PackageSearch, ArrowUpRight, ArrowDownRight, History } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import Link from "next/link";
import { useStockLogStorage } from "@/hooks/use-stock-log-storage";
import { useProductStorage } from "@/hooks/use-product-storage";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export default function MonthlyStockReportPage() {
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const { toast } = useToast();
  const { logs, isLoading: logsLoading } = useStockLogStorage();
  const { products, isLoading: productsLoading } = useProductStorage();
  const [activeTab, setActiveTab] = useState("overview");
  const [isExporting, setIsExporting] = useState(false);
  
  // Overview Tab State
  const [searchQuery, setSearchQuery] = useState("");
  
  // Movement Tab State
  const [selectedProductId, setSelectedProductId] = useState<string>("all");
  
  const reportData = useMemo(() => {
    const monthStr = format(selectedMonth, 'yyyy-MM');
    const stockOutLogs = logs.filter(log => 
        log.type === 'Stock Out' && 
        log.date.startsWith(monthStr)
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
    
    let data = Array.from(usageMap.entries()).map(([productName, data]) => ({
      productName,
      ...data
    })).sort((a,b) => b.value - a.value);

    if (searchQuery) {
        data = data.filter(item => item.productName.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    
    return data;
  }, [selectedMonth, logs, products, searchQuery]);
  
  const summary = useMemo(() => {
      const totalValue = reportData.reduce((sum, item) => sum + item.value, 0);
      const mostUsed = reportData.length > 0 ? reportData.reduce((prev, current) => (prev.quantity > current.quantity) ? prev : current) : null;
      return { totalValue, mostUsed: mostUsed?.productName || 'N/A' };
  }, [reportData]);

  // Movement Ledger Calculation 
  const movementData = useMemo(() => {
    if (selectedProductId === 'all') return null;
    
    const product = products.find(p => p.id === selectedProductId);
    if (!product) return null;

    const allLogs = [...logs].filter(l => l.productId === selectedProductId).sort((a,b) => {
        const timeDiff = parseISO(a.date).getTime() - parseISO(b.date).getTime();
        return timeDiff !== 0 ? timeDiff : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
    
    const monthStart = startOfMonth(selectedMonth);
    const monthEnd = endOfMonth(selectedMonth);
    
    let openingBal = 0;
    const historicalLogs = allLogs.filter(l => parseISO(l.date) < monthStart);
    historicalLogs.forEach(l => {
        if (l.type === 'Stock In') openingBal += l.quantity;
        else if (l.type === 'Stock Out') openingBal -= l.quantity;
    });

    let runningBal = openingBal;
    let totalIn = 0;
    let totalOut = 0;

    const currentMonthLogs = allLogs.filter(l => parseISO(l.date) >= monthStart && parseISO(l.date) <= monthEnd).map(l => {
        if (l.type === 'Stock In') {
            runningBal += l.quantity;
            totalIn += l.quantity;
        } else if (l.type === 'Stock Out') {
            runningBal -= l.quantity;
            totalOut += l.quantity;
        }
        return {
            ...l,
            runningBalance: runningBal
        };
    });

    return {
        product,
        openingBalance: openingBal,
        closingBalance: runningBal,
        totalIn,
        totalOut,
        ledgers: currentMonthLogs
    };
  }, [logs, selectedProductId, selectedMonth, products]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS', currencyDisplay: 'code' }).format(amount);
  }
  
  const handlePdfExport = () => {
    setIsExporting(true);
    try {
      const doc = new jsPDF({ orientation: 'landscape' });
      const monthFormatted = format(selectedMonth, 'MMMM yyyy');
      doc.text(`Monthly Stock Usage Overview - ${monthFormatted}`, 14, 15);
      
      const tableColumn = ["Product Name", "Quantity Used", "Unit", "Total Value"];
      const tableRows = reportData.map(d => [
        d.productName,
        d.quantity,
        d.unit,
        formatCurrency(d.value)
      ]);
      
      (doc as any).autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 25,
        foot: [[
            { content: `Total Value: ${formatCurrency(summary.totalValue)}`, colSpan: 4, styles: { halign: 'right', fontStyle: 'bold' } }
        ]],
        showFoot: 'lastPage'
      });

      doc.save(`Monthly_Stock_Usage_${format(selectedMonth, 'yyyy-MM')}.pdf`);
      toast({ title: "Export Successful", description: "Report exported to PDF." });
    } catch (error) {
      console.error("PDF export error:", error);
      toast({ variant: "destructive", title: "Export Failed", description: "There was an error generating the PDF." });
    } finally {
      setIsExporting(false);
    }
  };

  const handleLedgerPdfExport = () => {
      if (!movementData) return;
      setIsExporting(true);
      try {
        const doc = new jsPDF({ orientation: 'landscape' });
        const monthFormatted = format(selectedMonth, 'MMMM yyyy');
        doc.text(`Stock Movement Ledger - ${movementData.product.name} - ${monthFormatted}`, 14, 15);
        doc.setFontSize(10);
        doc.text(`Opening Balance: ${movementData.openingBalance} ${movementData.product.unit}`, 14, 22);
        
        const tableColumn = ["Date", "Type", "Reference", "Qty In", "Qty Out", "Balance"];
        const tableRows = movementData.ledgers.map(l => [
            format(parseISO(l.date), 'PPP'),
            l.type,
            l.reason || '-',
            l.type === 'Stock In' ? l.quantity : '-',
            l.type === 'Stock Out' ? l.quantity : '-',
            l.runningBalance
        ]);

        (doc as any).autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: 30,
            theme: 'grid',
            headStyles: { fillColor: [40, 40, 40] }
        });

        doc.save(`Stock_Ledger_${movementData.product.name.replace(/\s+/g, '_')}_${format(selectedMonth, 'yyyy-MM')}.pdf`);
        toast({ title: "Export Successful", description: "Ledger exported to PDF." });
      } catch (error) {
        console.error("PDF export error:", error);
        toast({ variant: "destructive", title: "Export Failed", description: "There was an error generating the PDF." });
      } finally {
        setIsExporting(false);
      }
  };
  
  const isLoading = logsLoading || productsLoading;

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Monthly Inventory Reports</h1>
          <p className="text-muted-foreground">Analyze macro usage or dig into product-level ledgers.</p>
        </div>
        <div className="flex items-center space-x-3">
          <Button asChild variant="ghost" size="sm" className="bg-muted/50"><Link href="/reports"><ArrowLeft className="mr-2 h-4 w-4" />Back to Reports</Link></Button>
        </div>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
         <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4 mb-6">
            <TabsList className="bg-muted/50 p-1">
                <TabsTrigger value="overview" className="gap-2 px-6">
                    <FileText className="h-4 w-4" /> Consumption Overview
                </TabsTrigger>
                <TabsTrigger value="movement" className="gap-2 px-6">
                    <History className="h-4 w-4" /> Product Ledgers
                </TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-2 bg-muted/20 p-1 rounded-lg border">
                <span className="text-xs font-medium text-muted-foreground uppercase px-2">Reporting Period</span>
                <DatePicker
                    selectedDate={selectedMonth}
                    onDateChange={setSelectedMonth}
                    labelFormat="MMMM yyyy"
                    isMonthPicker
                />
            </div>
         </div>

         <TabsContent value="overview" className="space-y-6 mt-0">
           <div className="grid gap-4 md:grid-cols-2">
              <Card className="border-l-4 border-l-destructive shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground text-destructive">Total Value Extracted</CardTitle>
                  <DollarSign className="h-4 w-4 text-destructive/50" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-black">{formatCurrency(summary.totalValue)}</div>
                  <p className="text-xs text-muted-foreground mt-1">Total cost of all items stocked out this month</p>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-primary shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Highest Consumption</CardTitle>
                  <TrendingUp className="h-4 w-4 text-primary/50" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-black">{summary.mostUsed}</div>
                  <p className="text-xs text-muted-foreground mt-1">Product heavily dispatched during {format(selectedMonth, 'MMM')}</p>
                </CardContent>
              </Card>
          </div>

          <Card className="shadow-md">
            <CardHeader className="bg-muted/10 border-b">
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                    <CardTitle className="text-lg">Stock Usage Analytics</CardTitle>
                    <div className="flex items-center gap-2">
                         <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                              type="search"
                              placeholder="Search over consumed products..."
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              className="w-full rounded-lg bg-background pl-8 md:w-[300px]"
                            />
                          </div>
                        <Button onClick={handlePdfExport} className="bg-primary hover:bg-primary/90" size="sm" disabled={isExporting}>
                            {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                            Extract PDF
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0">
               <Table>
                <TableHeader className="bg-muted/30">
                    <TableRow>
                        <TableHead className="py-4 pl-6">Product Catalog</TableHead>
                        <TableHead className="text-center">Packaging</TableHead>
                        <TableHead className="text-right">Quantity Consumed</TableHead>
                        <TableHead className="text-right pr-6">Cost Value</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={4} className="text-center h-48"><Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground/30" /></TableCell></TableRow>
                  ) : reportData.map((data) => (
                      <TableRow key={data.productName} className="hover:bg-accent/5">
                        <TableCell className="font-bold pl-6">{data.productName}</TableCell>
                        <TableCell className="text-center"><Badge variant="outline">{data.unit}</Badge></TableCell>
                        <TableCell className="text-right font-medium text-destructive">{data.quantity}</TableCell>
                        <TableCell className="text-right font-bold pr-6">{formatCurrency(data.value)}</TableCell>
                      </TableRow>
                  ))}
                  {reportData.length === 0 && !isLoading && (
                    <TableRow><TableCell colSpan={4} className="text-center h-32 text-muted-foreground">No stock usage identified.</TableCell></TableRow>
                  )}
                </TableBody>
                <TableFooter className="bg-background">
                    <TableRow className="border-t-2 border-primary/20">
                        <TableCell colSpan={3} className="text-right font-bold text-lg py-4">NET DISPATCH VALUE</TableCell>
                        <TableCell className="text-right font-black text-xl text-destructive pr-6">{formatCurrency(summary.totalValue)}</TableCell>
                    </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>
         </TabsContent>

         <TabsContent value="movement" className="space-y-6 mt-0 border rounded-lg p-6 bg-muted/5 shadow-inner min-h-[500px]">
            <div className="max-w-xl">
                 <h2 className="text-2xl font-black mb-2 flex items-center gap-2">
                    <PackageSearch className="h-6 w-6 text-primary" /> Target Product
                 </h2>
                 <p className="text-sm text-muted-foreground mb-6">Access micro-level ledger logic evaluating every single In/Out transaction and calculating the true chronological running balance.</p>
                 
                 <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                    <SelectTrigger className="h-14 text-lg border-2 bg-background font-bold shadow-sm">
                        <SelectValue placeholder="Select a product to map ledger..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                        <SelectItem value="all" className="font-bold text-muted-foreground">-- None Selected --</SelectItem>
                        {products.map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.name} ({p.sku})</SelectItem>
                        ))}
                    </SelectContent>
                 </Select>
            </div>

            {movementData && (
                <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 fade-in pt-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-4 rounded-xl border bg-background shadow-sm flex flex-col items-center text-center">
                            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mb-1">Opening</span>
                            <span className="text-3xl font-black">{movementData.openingBalance}</span>
                            <span className="text-xs text-muted-foreground">{movementData.product.unit}</span>
                        </div>
                        <div className="p-4 rounded-xl border bg-background shadow-sm flex flex-col items-center text-center">
                            <span className="text-[10px] uppercase font-bold text-green-600 tracking-widest mb-1 flex items-center gap-1"><ArrowUpRight className="h-3 w-3"/> Inflow</span>
                            <span className="text-3xl font-black text-green-600">+{movementData.totalIn}</span>
                        </div>
                        <div className="p-4 rounded-xl border bg-background shadow-sm flex flex-col items-center text-center">
                            <span className="text-[10px] uppercase font-bold text-rose-600 tracking-widest mb-1 flex items-center gap-1"><ArrowDownRight className="h-3 w-3"/> Outflow</span>
                            <span className="text-3xl font-black text-rose-600">-{movementData.totalOut}</span>
                        </div>
                        <div className="p-4 rounded-xl border-2 border-primary bg-primary/5 shadow-md flex flex-col items-center text-center">
                            <span className="text-[10px] uppercase font-black text-primary tracking-widest mb-1">Closing</span>
                            <span className="text-3xl font-black text-primary">{movementData.closingBalance}</span>
                            <span className="text-xs font-bold text-primary/70">{movementData.product.unit}</span>
                        </div>
                    </div>

                    <Card className="shadow-md overflow-hidden border">
                        <CardHeader className="bg-background flex flex-row items-center justify-between border-b px-6 py-4">
                            <div>
                                <CardTitle className="text-lg flex items-center gap-2">Chronological Ledger</CardTitle>
                            </div>
                            <Button onClick={handleLedgerPdfExport} variant="outline" size="sm" className="font-bold" disabled={isExporting}>
                                {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                                Extract Ledger
                            </Button>
                        </CardHeader>
                        <CardContent className="p-0 bg-background max-h-[600px] overflow-auto">
                            <Table>
                                <TableHeader className="bg-muted/30 sticky top-0 z-10 shadow-sm">
                                    <TableRow>
                                        <TableHead className="pl-6 w-[150px]">Record Date</TableHead>
                                        <TableHead>Reference / Reason</TableHead>
                                        <TableHead className="text-center w-[100px]">Stock In</TableHead>
                                        <TableHead className="text-center w-[100px]">Stock Out</TableHead>
                                        <TableHead className="text-right pr-6 w-[120px] font-black text-primary">Balance</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {movementData.ledgers.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="h-32 text-center text-muted-foreground font-medium">No movement detected for {format(selectedMonth, 'MMM yyyy')}</TableCell>
                                        </TableRow>
                                    ) : movementData.ledgers.map(l => (
                                        <TableRow key={l.id} className="hover:bg-muted/5 transition-colors">
                                            <TableCell className="pl-6 font-medium text-xs whitespace-nowrap">{format(parseISO(l.date), 'dd MMM yyyy')}</TableCell>
                                            <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]" title={l.reason}>{l.reason || '-'}</TableCell>
                                            <TableCell className="text-center font-bold text-green-600">{l.type === 'Stock In' ? l.quantity : '-'}</TableCell>
                                            <TableCell className="text-center font-bold text-rose-600">{l.type === 'Stock Out' ? l.quantity : '-'}</TableCell>
                                            <TableCell className="text-right pr-6 font-black text-lg">{l.runningBalance}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            )}
            
            {selectedProductId === 'all' && (
                <div className="flex flex-col items-center justify-center py-20 opacity-30">
                    <History className="h-20 w-20 mb-4" />
                    <p className="text-2xl font-black uppercase tracking-widest">Awaiting Selection</p>
                </div>
            )}
         </TabsContent>
      </Tabs>
      
    </div>
  );
}
