// @ts-nocheck
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMemo } from "react";
import { isWithinInterval, startOfMonth, endOfMonth, startOfDay, endOfDay } from 'date-fns';
import { ShoppingCart } from "lucide-react";

const IngredientCostTable = ({ stockLogs, request, ingredientCost }) => {

  const ingredientsUsedCount = useMemo(() => {
    if (!request || !stockLogs) return 0;
     const intervals = request.dates.map(date => {
        if (request.periodType === 'daily') {
          return { start: startOfDay(date), end: endOfDay(date) };
        }
        return { start: startOfMonth(date), end: endOfMonth(date) };
    });
    
    const relevantLogs = stockLogs.filter(log => {
      const logDate = new Date(log.date);
      const isStockOut = log.type === "Stock Out";
      const inInterval = intervals.some(interval => isWithinInterval(logDate, interval));
      return isStockOut && inInterval;
    });

    return relevantLogs.length;
  }, [stockLogs, request]);


  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS', currencyDisplay: 'code' }).format(amount);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <ShoppingCart className="h-5 w-5 text-primary" />
          <span>Total Ingredient Cost</span>
           <Badge variant="outline">{ingredientsUsedCount} items used</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="p-4 text-center border rounded-lg bg-muted/30">
          <p className="text-sm text-muted-foreground">Total value of all ingredients stocked out during this period.</p>
          <div className="text-4xl font-bold text-destructive mt-2">
            {formatCurrency(ingredientCost)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default IngredientCostTable;
