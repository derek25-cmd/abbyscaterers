
// @ts-nocheck
"use client";

import React, { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import CostingSummary from "./CostingSummary";
import StockLogTable from "./StockLogTable"; 
import { format, parseISO } from "date-fns";
import { useStockLogStorage } from "@/hooks/use-stock-log-storage";
import EventIncomeTable from "./EventIncomeTable";

export const CostingReport = ({ request, clients, orders, products, onBack, isLoading: externalLoading }) => {
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const { logs: allLogs, isLoading: stockLogsLoading } = useStockLogStorage();

  const isLoading = externalLoading || stockLogsLoading;

  const { title, dateRange, filteredEvents, filteredStockOutLogs, ingredientCost } = useMemo(() => {
    let title = "Costing Report";
    let dateRangeStr = "";
    let filteredEventsData = [];
    let filteredLogsData = [];
    let calculatedIngredientCost = 0;

    if (request && !isLoading) {
      // Create a set of selected date strings in "yyyy-MM-dd" format for efficient lookup
      const selectedDateStrings = new Set(request.dates.map(d => {
          if (request.periodType === 'daily') {
              return format(parseISO(d), 'yyyy-MM-dd');
          }
          // For monthly, this will need a more complex range check
          return d;
      }));

      if (request.periodType === 'daily') {
        dateRangeStr = request.dates.map(d => format(parseISO(d), "PPP")).join(', ');
      } else {
        dateRangeStr = request.dates.map(d => format(parseISO(d), "MMMM yyyy")).join(', ');
      }

      const clientName = request.type === 'individual' && request.clientId
        ? clients.find(c => c.id === request.clientId)?.companyName 
        : 'Aggregate';
      title = `${clientName} Costing Report for ${dateRangeStr}`;
      
      const allClientEvents = orders.flatMap(order => order.clientEvents);
      
      // Filter events based on the date strings
      filteredEventsData = allClientEvents.filter(event => {
        const eventDateStr = format(parseISO(event.date), 'yyyy-MM-dd');
        return selectedDateStrings.has(eventDateStr);
      });
      
      if (request.type === 'individual' && request.clientId) {
          filteredEventsData = filteredEventsData.filter(event => event.clientId === request.clientId);
      }
      
      // Filter logs based on date strings and type
      filteredLogsData = allLogs.filter(log => {
        const logDateStr = format(parseISO(log.date), 'yyyy-MM-dd');
        return selectedDateStrings.has(logDateStr) && log.type === 'Stock Out';
      });
      
      calculatedIngredientCost = filteredLogsData.reduce((sum, log) => sum + (log.price || 0), 0);
    }
    
    return { title, dateRange: dateRangeStr, filteredEvents: filteredEventsData, filteredStockOutLogs: filteredLogsData, ingredientCost: calculatedIngredientCost };

  }, [request, clients, orders, allLogs, isLoading]);


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
          <StockLogTable logs={filteredStockOutLogs} />
          <EventIncomeTable events={filteredEvents} />
        </div>
      </div>
    </div>
  );
};
