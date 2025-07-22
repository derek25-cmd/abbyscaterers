
"use client";

import { useState, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Download, FileText, Settings } from "lucide-react";
import Link from "next/link";
import IngredientCostTable from "./IngredientCostTable";
import EventIncomeTable from "./EventIncomeTable";
import DateSelector from "./DateSelector";
import CostingSummary from "./CostingSummary";
import { useToast } from "@/hooks/use-toast";
import { useDailyMenuStorage } from "@/hooks/use-daily-menu-storage";
import { useIngredientStorage } from "@/hooks/use-ingredient-storage";
import { useReactToPrint } from "react-to-print";

export const DailyCostingModule = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const { toast } = useToast();
  const { getEventsForDate } = useDailyMenuStorage();
  const { ingredients } = useIngredientStorage();
  const printRef = useRef<HTMLDivElement>(null);

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

  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `Daily_Costing_Report_${selectedDate.toISOString().split('T')[0]}`,
    onAfterPrint: () => toast({ title: "Print Job Completed", description: "Your report has been sent to the printer or saved as a PDF."}),
    onPrintError: () => toast({ variant: "destructive", title: "Print Error", description: "There was an error while trying to print the report."})
  });

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
          <Button onClick={handlePrint} variant="outline" size="sm">
            <FileText className="h-4 w-4 mr-2" />
            Print / Export PDF
          </Button>
        </div>
      </div>

      <div ref={printRef} className="space-y-6">
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
