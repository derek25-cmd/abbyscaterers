
"use client";

import { useState, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Settings, Loader2 } from "lucide-react";
import Link from "next/link";
import IngredientCostTable from "./IngredientCostTable";
import EventIncomeTable from "./EventIncomeTable";
import DateSelector from "./DateSelector";
import CostingSummary from "./CostingSummary";
import { useToast } from "@/hooks/use-toast";
import { useDailyMenuStorage } from "@/hooks/use-daily-menu-storage";
import { useIngredientStorage } from "@/hooks/use-ingredient-storage";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export const DailyCostingModule = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const { toast } = useToast();
  const { getEventsForDate } = useDailyMenuStorage();
  const { ingredients } = useIngredientStorage();
  const printRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);

  const dailyEvents = useMemo(() => {
    return getEventsForDate(selectedDate);
  }, [selectedDate, getEventsForDate]);

  const totalIncome = dailyEvents.reduce((sum, event) => sum + (event.unitPrice * event.numberOfPeople), 0);
  
  const totalIngredientCost = ingredients.reduce((sum, item) => {
    const quantityUsed = (item as any).quantityUsed || 0;
    if (quantityUsed > 0 && item.units.length > 0) {
      return sum + (quantityUsed * item.units[0].price);
    }
    return sum;
  }, 0);
  
  const netProfitLoss = totalIncome - totalIngredientCost;

  const handlePdfExport = async () => {
    if (!printRef.current) return;
    setIsExporting(true);
    try {
      const canvas = await html2canvas(printRef.current, {
        scale: 2, 
        useCORS: true,
        backgroundColor: null
      });
      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
      });
      
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
      
      pdf.save(`Daily_Costing_Report_${selectedDate.toISOString().split('T')[0]}.pdf`);
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0 print:hidden">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Daily Costing Report</h1>
          <p className="text-muted-foreground">Track ingredient costs and event income for optimal profitability</p>
        </div>
        <div className="flex items-center space-x-3">
          <DateSelector selectedDate={selectedDate} onDateChange={setSelectedDate} />
          <Link href="/costing/ingredients">
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Input Usage
            </Button>
          </Link>
          <Button onClick={handlePdfExport} variant="outline" size="sm" disabled={isExporting}>
             {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
             {isExporting ? 'Exporting...' : 'Export PDF'}
          </Button>
        </div>
      </div>

      <div ref={printRef} className="space-y-6 bg-background p-4 rounded-lg">
        <div className="text-center hidden print:block pt-8">
            <h1 className="text-2xl font-bold">Daily Costing Report</h1>
            <p className="text-lg">{selectedDate.toLocaleDateString()}</p>
        </div>

        <CostingSummary 
          totalIngredientCost={totalIngredientCost}
          totalIncome={totalIncome}
          netProfitLoss={netProfitLoss}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
          <IngredientCostTable ingredients={ingredients} />
          <EventIncomeTable events={dailyEvents} />
        </div>
      </div>
    </div>
  );
};
