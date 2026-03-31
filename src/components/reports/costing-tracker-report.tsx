"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Loader2, Download, ArrowLeft, BrainCircuit, TrendingDown, TrendingUp, AlertCircle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useOrderStorage } from "@/hooks/use-order-storage";
import { useStockLogStorage } from "@/hooks/use-stock-log-storage";
import { useProductStorage } from "@/hooks/use-product-storage";
import { useClientStorage } from "@/hooks/use-client-storage";
import { getCostingReportsByDate } from "@/services/costingService";
import jsPDF from "jspdf";
import "jspdf-autotable";
import html2canvas from "html2canvas";
import { format, subDays, eachDayOfInterval, isSameDay, parseISO, isWithinInterval } from "date-fns";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from "recharts";
import { generateCostingAnalysisAction, CostingAnalysisOutput } from "@/ai/flows/costing-analysis-flow";
import Link from "next/link";
import { DateRange } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export default function CostingTrackerReport() {
  const { toast } = useToast();
  const { orders, isLoading: ordersLoading } = useOrderStorage();
  const { logs: allLogs, isLoading: stockLogsLoading } = useStockLogStorage();
  const { products, isLoading: productsLoading } = useProductStorage();
  const { getClientById, isLoading: clientsLoading } = useClientStorage();

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date()
  });
  const [isExporting, setIsExporting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<CostingAnalysisOutput | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const isLoading = ordersLoading || stockLogsLoading || productsLoading || clientsLoading;

  const { trendData, topIngredients } = useMemo(() => {
    if (isLoading || !dateRange?.from || !dateRange?.to) return { trendData: [], topIngredients: [] };

    const interval = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
    
    // 1. Calculate Daily Trend Data
    const dailyData = interval.map(date => {
      const dateStr = format(date, 'yyyy-MM-dd');
      
      // Filter logs for this date
      const daysLogs = allLogs.filter(log => log.date?.startsWith(dateStr) && log.type?.toLowerCase() === 'stock out');
      
      const actualCost = daysLogs.reduce((sum, log) => {
        const qty = log.actual_quantity ?? log.quantity;
        return sum + (qty * (log.actual_unit_price || 0));
      }, 0);

      const forecastCost = daysLogs.reduce((sum, log) => {
        return sum + (log.quantity * (log.actual_unit_price || 0));
      }, 0);

      // Filter events for this date
      const daysEvents = orders.flatMap(order => 
        order.clientEvents.filter(event => event.date?.startsWith(dateStr))
      );

      const totalIncome = daysEvents.reduce((sum, event) => sum + (event.unitPrice * event.numberOfPeople), 0);
      
      const actualPercentage = totalIncome > 0 ? (actualCost / totalIncome) * 100 : 0;
      const forecastPercentage = totalIncome > 0 ? (forecastCost / totalIncome) * 100 : 0;

      return {
        date: format(date, 'MMM dd'),
        fullDate: dateStr,
        actual: parseFloat(actualPercentage.toFixed(2)),
        forecast: parseFloat(forecastPercentage.toFixed(2)),
        income: totalIncome,
        cost: actualCost
      };
    });

    // 2. Calculate Top Ingredients by Quantity
    const ingredientUsage: Record<string, { quantity: number, unit: string }> = {};
    
    allLogs.forEach(log => {
      const logDate = parseISO(log.date || "");
      if (dateRange.from && dateRange.to && isWithinInterval(logDate, { start: dateRange.from, end: dateRange.to }) && log.type?.toLowerCase() === 'stock out') {
        const product = products.find(p => p.id === log.productId);
        const name = log.productName || "Unknown Ingredient";
        if (!ingredientUsage[name]) {
          ingredientUsage[name] = { quantity: 0, unit: product?.unit || 'qty' };
        }
        ingredientUsage[name].quantity += (log.actual_quantity ?? log.quantity);
      }
    });

    const topIngredientsList = Object.entries(ingredientUsage)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    return { trendData: dailyData, topIngredients: topIngredientsList };
  }, [isLoading, allLogs, orders, products, dateRange]);

  const handleAiAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const input = {
        trendData: trendData.map(d => ({
          date: d.fullDate,
          actualPercentage: d.actual,
          forecastPercentage: d.forecast
        })),
        topIngredients: topIngredients.map(i => ({
          name: i.name,
          quantity: i.quantity,
          unit: i.unit
        }))
      };
      
      const analysis = await generateCostingAnalysisAction(input);
      setAiAnalysis(analysis);
      toast({ title: "Analysis Complete", description: "AI analysis has been generated." });
    } catch (error) {
      console.error("AI Analysis failed:", error);
      toast({ variant: "destructive", title: "Analysis Failed", description: "Failed to generate AI analysis." });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handlePdfExport = async () => {
    if (!chartRef.current) return;
    setIsExporting(true);

    try {
      const canvas = await html2canvas(chartRef.current);
      const imgData = canvas.toDataURL("image/png");
      const doc = new jsPDF("p", "mm", "a4");
      const pageWidth = doc.internal.pageSize.getWidth();
      let currentY = 10;

      const checkPageSpace = (height: number) => {
        if (currentY + height > 280) {
          doc.addPage();
          currentY = 15;
          return true;
        }
        return false;
      };

      const addSectionTitle = (title: string, color = [41, 128, 185]) => {
        checkPageSpace(15);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(color[0], color[1], color[2]);
        doc.text(title, 14, currentY + 10);
        doc.line(14, currentY + 12, 196, currentY + 12);
        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "normal");
        currentY += 15;
      };

      // Header
      doc.setFontSize(10);
      doc.text("Abby's Legendary Caterers Limited", 105, currentY, { align: "center" });
      currentY += 5;
      doc.setFontSize(8);
      doc.text("Form Code: ALC-FIN-TRK-01", 105, currentY, { align: "center" });
      currentY += 10;
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text("Costing Tracker Report", 105, currentY, { align: "center" });
      currentY += 10;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      const fromStr = dateRange?.from ? format(dateRange.from, 'PPP') : 'N/A';
      const toStr = dateRange?.to ? format(dateRange.to, 'PPP') : 'N/A';
      doc.text(`Period: ${fromStr} - ${toStr}`, 14, currentY);
      doc.text(`Export Date: ${format(new Date(), 'PPP')}`, 150, currentY);
      currentY += 10;

      // Add Chart
      addSectionTitle("1. Costing Performance Chart");
      const chartWidth = pageWidth - 28;
      const chartHeight = (canvas.height * chartWidth) / canvas.width;
      
      checkPageSpace(chartHeight + 5);
      doc.addImage(imgData, "PNG", 14, currentY, chartWidth, chartHeight);
      currentY += chartHeight + 15;

      // Add Top Ingredients Table
      addSectionTitle("2. Top Ingredients by Usage");
      (doc as any).autoTable({
        startY: currentY,
        head: [['Ingredient', 'Quantity', 'Unit']],
        body: topIngredients.map(i => [i.name, i.quantity.toFixed(2), i.unit]),
        theme: 'striped',
        headStyles: { fillColor: [41, 128, 185] },
        styles: { fontSize: 8 }
      });
      currentY = (doc as any).lastAutoTable.finalY + 15;

      // Add Daily Operations Summary
      if (trendData.length > 0) {
        addSectionTitle("3. Daily Operations Summary");
        (doc as any).autoTable({
            startY: currentY,
            head: [['Date', 'Total Income', 'Total Cost', 'Actual %', 'Forecast %']],
            body: trendData.map(d => [
                d.date,
                `${d.income.toLocaleString()} TZS`,
                `${d.cost.toLocaleString()} TZS`,
                `${d.actual}%`,
                `${d.forecast}%`
            ]),
            theme: 'grid',
            headStyles: { fillColor: [52, 73, 94] },
            styles: { fontSize: 8 }
        });
        currentY = (doc as any).lastAutoTable.finalY + 15;
      }

      // AI Analysis
      if (aiAnalysis) {
        addSectionTitle("4. AI Strategic Analysis", [142, 68, 173]);
        
        checkPageSpace(25);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text("Costing Efficiency Rating:", 14, currentY);
        
        const rating = aiAnalysis.efficiencyRating.toUpperCase();
        let ratingColor = [0, 0, 0];
        if (rating === 'EXCELLENT') ratingColor = [39, 174, 96]; // Emerald Green
        if (rating === 'GOOD') ratingColor = [41, 128, 185];    // Belize Hole Blue
        if (rating === 'FAIR') ratingColor = [243, 156, 18];    // Orange
        if (rating === 'POOR') ratingColor = [192, 57, 43];    // Alizarin Red
        
        // Draw Rating Badge
        const badgeWidth = 40;
        const badgeHeight = 8;
        const badgeX = 65;
        const badgeY = currentY - 5;
        
        doc.setFillColor(ratingColor[0], ratingColor[1], ratingColor[2]);
        doc.rect(badgeX, badgeY, badgeWidth, badgeHeight, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        doc.text(rating, badgeX + (badgeWidth / 2), badgeY + 5.5, { align: "center" });
        
        doc.setTextColor(0, 0, 0);
        currentY += 12;

        // Premium Summary Block
        const summaryLines = doc.splitTextToSize(aiAnalysis.summary, pageWidth - 36);
        const summaryHeight = (summaryLines.length * 6) + 12;
        checkPageSpace(summaryHeight);
        
        // Background for Summary
        doc.setFillColor(245, 245, 250);
        doc.rect(14, currentY, pageWidth - 28, summaryHeight, 'F');
        // Left Border Accent
        doc.setFillColor(142, 68, 173);
        doc.rect(14, currentY, 2, summaryHeight, 'F');
        
        doc.setFont("helvetica", "bold");
        doc.text("Strategic Summary:", 18, currentY + 7);
        doc.setFont("helvetica", "italic");
        doc.setFontSize(9);
        doc.text(summaryLines, 18, currentY + 13);
        currentY += summaryHeight + 12;

        if (aiAnalysis.anomalies.length > 0) {
            checkPageSpace(20);
            doc.setFontSize(11);
            doc.setFont("helvetica", "bold");
            doc.text("Identified Anomalies & Variances", 14, currentY);
            
            (doc as any).autoTable({
                startY: currentY + 4,
                head: [['#', 'Anomaly Details']],
                body: aiAnalysis.anomalies.map((anom, i) => [i + 1, anom]),
                theme: 'grid',
                headStyles: { fillColor: [192, 57, 43] }, // Red for anomalies
                styles: { fontSize: 8, cellPadding: 3 },
                columnStyles: { 0: { cellWidth: 10, halign: 'center' } }
            });
            currentY = (doc as any).lastAutoTable.finalY + 12;
        }

        checkPageSpace(20);
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text("Optimization Advice & Next Steps", 14, currentY);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        aiAnalysis.advice.forEach((adv, idx) => {
          const advLines = doc.splitTextToSize(`• ${adv}`, pageWidth - 32);
          checkPageSpace(advLines.length * 6);
          doc.text(advLines, 18, currentY + 8);
          currentY += (advLines.length * 5) + 3;
        });
      }

      doc.save(`Costing_Tracker_Report_${format(new Date(), 'yyyyMMdd')}.pdf`);
      toast({ title: "Export Successful", description: "The full Costing Tracker Report has been exported to PDF." });
    } catch (error) {
      console.error("PDF Export failed:", error);
      toast({ variant: "destructive", title: "Export Failed", description: "An error occurred during PDF export." });
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center h-64 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Gathering operational data...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Costing Tracker</h1>
          <p className="text-muted-foreground">Monitor costing percentage trends and forecast accuracy</p>
        </div>
        <div className="flex items-center space-x-3">
          <Button asChild variant="outline" size="sm">
            <Link href="/reports">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                size="sm"
                className={cn(
                  "w-[240px] justify-start text-left font-normal",
                  !dateRange && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, "LLL dd, y")} -{" "}
                      {format(dateRange.to, "LLL dd, y")}
                    </>
                  ) : (
                    format(dateRange.from, "LLL dd, y")
                  )
                ) : (
                  <span>Pick a date range</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
          <Button onClick={handleAiAnalysis} variant="secondary" size="sm" disabled={isAnalyzing || !dateRange?.to}>
            {isAnalyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BrainCircuit className="mr-2 h-4 w-4" />}
            AI Analysis
          </Button>
          <Button onClick={handlePdfExport} variant="default" size="sm" disabled={isExporting}>
            {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Export PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Costing Trend %</CardTitle>
            <CardDescription>Actual vs Forecasted costing percentage over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div ref={chartRef} className="h-[400px] w-full bg-background p-2 rounded-md">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#9333ea" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#9333ea" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="date" />
                  <YAxis unit="%" domain={[0, 'auto']} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="actual" 
                    name="Actual Costing %" 
                    stroke="#2563eb" 
                    fillOpacity={1} 
                    fill="url(#colorActual)" 
                    strokeWidth={2}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="forecast" 
                    name="Forecast Costing %" 
                    stroke="#9333ea" 
                    fillOpacity={1} 
                    fill="url(#colorForecast)" 
                    strokeWidth={2}
                    strokeDasharray="5 5"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Ingredients</CardTitle>
            <CardDescription>Highest volume items in the selected period</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[400px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ingredient</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>Unit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topIngredients.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-right">{item.quantity.toLocaleString(undefined, { maximumFractionDigits: 1 })}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{item.unit}</TableCell>
                    </TableRow>
                  ))}
                  {topIngredients.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-10 text-muted-foreground">No data for this period</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {aiAnalysis && (
        <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <CardHeader className="flex flex-row items-center space-x-2">
            <BrainCircuit className="h-6 w-6 text-primary" />
            <div>
              <CardTitle>AI Strategic Analysis</CardTitle>
              <CardDescription>Generated based on your operational trend and ingredient usage</CardDescription>
            </div>
             <div className="ml-auto flex items-center gap-2">
                <span className="text-sm font-medium">Efficiency Rating:</span>
                {aiAnalysis.efficiencyRating === 'excellent' && <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-bold uppercase flex items-center"><CheckCircle2 className="h-3 w-3 mr-1" /> Excellent</span>}
                {aiAnalysis.efficiencyRating === 'good' && <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-bold uppercase flex items-center"><CheckCircle2 className="h-3 w-3 mr-1" /> Good</span>}
                {aiAnalysis.efficiencyRating === 'fair' && <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-bold uppercase flex items-center"><AlertCircle className="h-3 w-3 mr-1" /> Fair</span>}
                {aiAnalysis.efficiencyRating === 'poor' && <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-bold uppercase flex items-center"><AlertCircle className="h-3 w-3 mr-1" /> Poor</span>}
             </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-muted/30 p-4 rounded-lg border">
              <h3 className="text-lg font-semibold mb-2 flex items-center">
                <TrendingUp className="h-4 w-4 mr-2 text-primary" />
                Performance Summary
              </h3>
              <p className="text-foreground/90 leading-relaxed italic">
                "{aiAnalysis.summary}"
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h3 className="font-semibold text-red-600 dark:text-red-400 flex items-center">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Anomalies & Variances
                </h3>
                <ul className="space-y-2">
                  {aiAnalysis.anomalies.map((item, idx) => (
                    <li key={idx} className="bg-red-50 dark:bg-red-950/20 p-2 rounded text-sm border-l-4 border-red-500">
                      {item}
                    </li>
                  ))}
                  {aiAnalysis.anomalies.length === 0 && <li className="text-muted-foreground text-sm italic">No significant anomalies detected.</li>}
                </ul>
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold text-green-600 dark:text-green-400 flex items-center">
                  <TrendingDown className="h-4 w-4 mr-2" />
                  Optimization Advice
                </h3>
                <ul className="space-y-2">
                  {aiAnalysis.advice.map((item, idx) => (
                    <li key={idx} className="bg-green-50 dark:bg-green-950/20 p-2 rounded text-sm border-l-4 border-green-500">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
