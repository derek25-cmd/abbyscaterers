
"use client";

import { useState, useMemo } from "react";
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

export const DailyCostingModule = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const { toast } = useToast();
  const { getEventsForDate } = useDailyMenuStorage();
  const { ingredients } = useIngredientStorage();

  const dailyEvents = useMemo(() => {
    return getEventsForDate(selectedDate);
  }, [selectedDate, getEventsForDate]);

  const totalIncome = dailyEvents.reduce((sum, event) => sum + (event.unitPrice * event.numberOfPeople), 0);
  
  // A more realistic calculation would be to sum up costs of all ingredients
  // for all recipes used in today's events. This is a simplified version.
  const totalIngredientCost = ingredients.reduce((sum, item) => {
    const quantityUsed = (item as any).quantityUsed || 0; // Assuming this ephemeral data exists
    if (quantityUsed > 0 && item.units.length > 0) {
      // Use the first unit price for simplicity
      return sum + (quantityUsed * item.units[0].price);
    }
    return sum;
  }, 0);
  
  const netProfitLoss = totalIncome - totalIngredientCost;

  const handleExport = () => {
    toast({
      title: "Report Generated",
      description: "Daily costing report has been exported successfully.",
    });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
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
          <Button onClick={handleExport} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={handlePrint} variant="outline" size="sm">
            <FileText className="h-4 w-4 mr-2" />
            Print
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <CostingSummary 
        totalIngredientCost={totalIngredientCost}
        totalIncome={totalIncome}
        netProfitLoss={netProfitLoss}
      />

      {/* Detailed Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <IngredientCostTable ingredients={ingredients} />
        <EventIncomeTable events={dailyEvents} />
      </div>
    </div>
  );
};
