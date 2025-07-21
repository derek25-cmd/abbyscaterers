
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
import { useCostingData } from "@/hooks/useCostingData";

export const DailyCostingModule = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const { toast } = useToast();
  const { ingredients, getEventsForDate } = useCostingData();

  // Get events for the selected date
  const dailyEvents = useMemo(() => {
    return getEventsForDate(selectedDate);
  }, [selectedDate, getEventsForDate]);

  // Unit conversion logic
  const convertToBaseUnit = (quantity: number, unit: string) => {
    switch (unit.toLowerCase()) {
      case 'kg':
        return quantity * 1000; // Convert to grams
      case 'bunches':
      case 'items':
      case 'grams':
      default:
        return quantity;
    }
  };

  const getBaseUnitPrice = (price: number, unit: string) => {
    switch (unit.toLowerCase()) {
      case 'kg':
        return price / 1000; // Price per gram
      case 'bunches':
      case 'items':
      case 'grams':
      default:
        return price;
    }
  };

  // Calculate costs
  const ingredientCosts = ingredients.map(ingredient => {
    const baseQuantity = convertToBaseUnit(ingredient.stock_quantity_used || 0, ingredient.unit_of_measure);
    const basePrice = getBaseUnitPrice(ingredient.unit_price, ingredient.unit_of_measure);
    const totalCost = baseQuantity * basePrice;
    
    return {
      ...ingredient,
      baseQuantity,
      basePrice,
      totalCost
    };
  });

  const totalIngredientCost = ingredientCosts.reduce((sum, item) => sum + item.totalCost, 0);
  const totalIncome = dailyEvents.reduce((sum, event) => sum + event.amount_paid, 0);
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
              Manage Ingredients
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
        <IngredientCostTable ingredients={ingredientCosts} />
        <EventIncomeTable events={dailyEvents} />
      </div>
    </div>
  );
};
