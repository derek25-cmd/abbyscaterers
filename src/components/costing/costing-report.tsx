
// @ts-nocheck
"use client";

import React, { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import CostingSummary from "./CostingSummary";
import IngredientCostTable from "./IngredientCostTable";
import { format, isWithinInterval, startOfMonth, endOfMonth, startOfDay, endOfDay, parse } from "date-fns";
import { useStockOutLogs } from "@/hooks/use-stock-out-log-storage";

export const CostingReport = ({ request, clients, orders, products, onBack, isLoading: externalLoading }) => {
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const { stockOutLogs, isLoading: stockLogsLoading } = useStockOutLogs();

  const isLoading = externalLoading || stockLogsLoading;

  const { title, dateRange, filteredEvents, ingredientCost, ingredientsUsedCount } = useMemo(() => {
    let title = "Costing Report";
    let dateRangeStr = "";
    let filteredEventsData = [];
    let calculatedIngredientCost = 0;
    let usedCount = 0;

    if (request && !isLoading) {
        const intervals = request.dates.map(date => {
            if (request.periodType === 'daily') {
                return { start: startOfDay(date), end: endOfDay(date) };
            }
            return { start: startOfMonth(date), end: endOfMonth(date) };
        });

      if (request.periodType === 'daily') {
        dateRangeStr = request.dates.map(d => format(d, "PPP")).join(', ');
      } else {
        dateRangeStr = request.dates.map(d => format(d, "MMMM yyyy")).join(', ');
      }

      const clientName = request.type === 'individual' && request.clientId
        ? clients.find(c => c.id === request.clientId)?.companyName 
        : 'Aggregate';
      title = `${clientName} Costing Report for ${dateRangeStr}`;
      
      const allClientEvents = orders.flatMap(order => order.clientEvents);
      
      filteredEventsData = allClientEvents.filter(event => {
        const eventDate = new Date(event.date);
        const inInterval = intervals.some(interval => isWithinInterval(eventDate, interval));
        if (request.type === 'individual') {
            return event.clientId === request.clientId && inInterval;
        }
        return inInterval;
      });

      const filteredLogs = stockOutLogs.filter(log => {
        // Correctly parse the "yyyy-MM-dd" date string without timezone issues
        const logDate = parse(log.date, 'yyyy-MM-dd', new Date());
        return intervals.some(interval => isWithinInterval(logDate, interval));
      });
      
      calculatedIngredientCost = filteredLogs.reduce((sum, log) => sum + (log.price || 0), 0);
      usedCount = filteredLogs.length;
    }
    
    return { title, dateRange: dateRangeStr, filteredEvents: filteredEventsData, ingredientCost: calculatedIngredientCost, ingredientsUsedCount: usedCount };

  }, [request, clients, orders, products, stockOutLogs, isLoading]);


  const totalIncome = filteredEvents.reduce((sum, event) => sum + (event.unitPrice * event.numberOfPeople), 0);
  const netProfitLoss = totalIncome - ingredientCost;

  const handlePdfExport = async () => {
    if (!printRef.current) return;
    setIsExporting(true);
    try {
      const canvas = await html2canvas(printRef.current, { scale: 2, useCORS: true, backgroundColor: null });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgProps = pdf.getImageProperties(imgData);
      const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;
      let heightLeft = imgHeight;
      let position = 0;
      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
      heightLeft -= pdfHeight;
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
        heightLeft -= pdfHeight;
      }
      pdf.save(`Costing_Report.pdf`);
      toast({ title: "Export Successful", description: "Report exported to PDF." });
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast({ variant: "destructive", title: "Error", description: "An error occurred while generating the PDF." });
    } finally {
      setIsExporting(false);
    }
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

      <div ref={printRef} className="space-y-6 bg-background p-4 rounded-lg">
        <div className="text-center hidden print:block pt-8">
            <h1 className="text-2xl font-bold">{title}</h1>
        </div>

        <CostingSummary 
          totalIngredientCost={ingredientCost}
          totalIncome={totalIncome}
          netProfitLoss={netProfitLoss}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
          <IngredientCostTable ingredientCost={ingredientCost} ingredientsUsedCount={ingredientsUsedCount} />
          <EventIncomeTable events={filteredEvents} />
        </div>
      </div>
    </div>
  );
};
