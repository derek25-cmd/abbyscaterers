
"use client";

import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, Loader2, DollarSign, PlusCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import "jspdf-autotable";
import CostingSummary from "./CostingSummary";
import StockLogTable from "./StockLogTable"; 
import { format, parseISO } from "date-fns";
import { useStockLogStorage } from "@/hooks/use-stock-log-storage";
import EventIncomeTable from "./EventIncomeTable";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

type CostingReportProps = {
    request: any;
    onBack: () => void;
    clients: any[];
    orders: any[];
    isLoading: boolean;
}

export const CostingReport = ({ request, onBack, clients, orders, isLoading: parentLoading }: CostingReportProps) => {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [miscIncome, setMiscIncome] = useState(0);
  const [miscExpenses, setMiscExpenses] = useState(0);
  
  const { logs: allLogs, isLoading: stockLogsLoading } = useStockLogStorage();

  const isLoading = parentLoading || stockLogsLoading;

  const { title, filteredEvents, filteredStockLogs, ingredientCost } = useMemo(() => {
    if (!request || isLoading) {
      return { title: "Loading Report...", filteredEvents: [], filteredStockLogs: [], ingredientCost: 0 };
    }

    const selectedDateStrings = new Set(request.dates);
    const dateRangeStr = request.dates.map((d: string) => format(parseISO(d), request.periodType === 'daily' ? "PPP" : "MMMM yyyy")).join(', ');
    const clientName = request.type === 'individual' && request.clientId
      ? clients.find(c => c.id === request.clientId)?.companyName 
      : 'Aggregate';
    const reportTitle = `${clientName} Costing Report for ${dateRangeStr}`;

    const allClientEvents = orders.flatMap(order => order.clientEvents);
    let eventsForReport = allClientEvents.filter(event => {
      const eventDateStr = event.date?.substring(0, request.periodType === 'daily' ? 10 : 7);
      return eventDateStr && selectedDateStrings.has(eventDateStr);
    });

    if (request.type === 'individual' && request.clientId) {
      eventsForReport = eventsForReport.filter((event: any) => event.clientId === request.clientId);
    }
    
    const stockLogsForReport = allLogs.filter(log => {
      if (!log.date) return false;
      const logDateStr = log.date.substring(0, request.periodType === 'daily' ? 10 : 7);
      return selectedDateStrings.has(logDateStr);
    });
    
    const stockOutLogs = stockLogsForReport.filter(log => log.type?.toLowerCase() === 'stock out');
    
    const calculatedIngredientCost = stockOutLogs.reduce((sum, log) => {
        return sum + (log.price || 0);
    }, 0);
    
    return { 
      title: reportTitle,
      filteredEvents: eventsForReport, 
      filteredStockLogs: stockLogsForReport,
      ingredientCost: calculatedIngredientCost 
    };

  }, [request, clients, orders, allLogs, isLoading]);

  const incomeFromEvents = filteredEvents.reduce((sum: number, event: any) => sum + (event.unitPrice * event.numberOfPeople), 0);
  const totalIncome = incomeFromEvents + miscIncome;
  const totalIngredientCost = ingredientCost + miscExpenses;
  const netProfitLoss = totalIncome - totalIngredientCost;

  const handlePdfExport = () => {
    setIsExporting(true);
    const doc = new jsPDF({ orientation: 'landscape' });

    doc.text(title, 14, 15);
    
    const profitMargin = totalIncome > 0 ? (netProfitLoss / totalIncome) * 100 : 0;

    // Summary Cards
    const summaryData = [
        ["Total Ingredient Cost", `${ingredientCost.toLocaleString()} TZS`],
        ["Miscellaneous Expenses", `${miscExpenses.toLocaleString()} TZS`],
        ["Total Costs", `${totalIngredientCost.toLocaleString()} TZS`],
        ["Total Income from Events", `${incomeFromEvents.toLocaleString()} TZS`],
        ["Miscellaneous Income", `${miscIncome.toLocaleString()} TZS`],
        ["Total Revenue", `${totalIncome.toLocaleString()} TZS`],
        ["Net Profit/Loss", `${netProfitLoss.toLocaleString()} TZS`],
        ["Profit Margin", `${profitMargin.toFixed(2)}%`],
    ];
    (doc as any).autoTable({
        body: summaryData,
        startY: 25,
        theme: 'plain',
        styles: { fontSize: 12 },
        columnStyles: { 0: { fontStyle: 'bold' } }
    });

    let lastY = (doc as any).autoTable.previous.finalY;

    // Expenses Appendix
    doc.text("Expenses Appendix", 14, lastY + 15);
    (doc as any).autoTable({
        head: [['Product', 'Type', 'Qty', 'Total Value']],
        body: filteredStockLogs.map(log => [
            log.productName,
            log.type,
            log.quantity,
            `${log.price.toLocaleString()} TZS`,
        ]),
        startY: lastY + 20,
        headStyles: { fillColor: [220, 38, 38] }, // Destructive color
    });

    lastY = (doc as any).autoTable.previous.finalY;
    
     // Income Appendix
    doc.text("Income Appendix", 14, lastY + 15);
    (doc as any).autoTable({
        head: [['Client', 'Meal Type', 'Total Price']],
        body: filteredEvents.map(event => {
            const client = clients.find(c => c.id === event.clientId)
            const totalPrice = event.unitPrice * event.numberOfPeople;
            return [client?.companyName || "N/A", event.mealType, `${totalPrice.toLocaleString()} TZS`];
        }),
        startY: lastY + 20,
        headStyles: { fillColor: [22, 163, 74] }, // Success color
    });


    doc.save(`Costing_Report.pdf`);
    toast({ title: "Export Successful", description: "Report exported to PDF." });
    setIsExporting(false);
  };
  
  if (isLoading) {
      return <div className="flex justify-center items-center h-64"><Loader2 className="mr-2 h-8 w-8 animate-spin" />Loading report data...</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0 print:hidden">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Costing Report</h1>
          <p className="text-muted-foreground">{title}</p>
        </div>
        <div className="flex items-center space-x-3">
            <Button onClick={onBack} variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Configuration
            </Button>
            <Button onClick={handlePdfExport} variant="outline" size="sm" disabled={isExporting}>
             {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
             {isExporting ? 'Exporting...' : 'Export PDF'}
          </Button>
        </div>
      </div>

      <div className="space-y-6 bg-background p-4 rounded-lg">
        <CostingSummary 
          totalIngredientCost={totalIngredientCost}
          totalIncome={totalIncome}
          netProfitLoss={netProfitLoss}
        />
        
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center"><PlusCircle className="mr-2 h-5 w-5 text-primary" />Additional Income & Expenses</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <Label htmlFor="misc-income" className="flex items-center gap-2"><DollarSign className="h-4 w-4 text-green-500" />Miscellaneous Income</Label>
                    <Input 
                        id="misc-income"
                        type="number"
                        value={miscIncome}
                        onChange={(e) => setMiscIncome(parseFloat(e.target.value) || 0)}
                        placeholder="e.g., Tips, Service Charges"
                    />
                </div>
                <div>
                    <Label htmlFor="misc-expenses" className="flex items-center gap-2"><DollarSign className="h-4 w-4 text-red-500" />Miscellaneous Expenses</Label>
                    <Input
                        id="misc-expenses"
                        type="number"
                        value={miscExpenses}
                        onChange={(e) => setMiscExpenses(parseFloat(e.target.value) || 0)}
                        placeholder="e.g., Transport, Utilities"
                    />
                </div>
            </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
          <StockLogTable logs={filteredStockLogs} totalCost={ingredientCost} />
          <EventIncomeTable events={filteredEvents} />
        </div>
      </div>
    </div>
  );
};
