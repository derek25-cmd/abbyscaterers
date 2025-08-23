// @ts-nocheck
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMemo } from "react";
import { isWithinInterval, startOfMonth, endOfMonth } from 'date-fns';
import { ShoppingCart } from "lucide-react";
import { useOrderStorage } from "@/hooks/use-order-storage";

const IngredientCostTable = ({ stockLogs, products, request, ingredientCost }) => {
  const { orders } = useOrderStorage();

  const ingredientsUsedCount = useMemo(() => {
    if (!request || !stockLogs) return 0;
     const intervals = request.dates.map(date => {
        if (request.periodType === 'daily') {
          const startOfDay = new Date(date);
          startOfDay.setHours(0, 0, 0, 0);
          const endOfDay = new Date(date);
          endOfDay.setHours(23, 59, 59, 999);
          return { start: startOfDay, end: endOfDay };
        }
        return { start: startOfMonth(date), end: endOfMonth(date) };
    });
    
     const clientOrderIds = new Set(
        orders
          .filter(order => request.type === 'aggregate' || order.clientEvents.some(e => e.clientId === request.clientId))
          .map(order => order.id)
      );

    const relevantLogs = stockLogs.filter(log => {
      const logDate = new Date(log.date);
      const isStockOut = log.type === "Stock Out";
      const inInterval = intervals.some(interval => isWithinInterval(logDate, interval));
      
      if (!isStockOut || !inInterval) return false;

      if (request.type === 'individual') {
          if (!log.reason.startsWith('Customer Order')) return false;
          const orderIdFromReason = log.reason.split(': ')[1];
          return clientOrderIds.has(orderIdFromReason);
      }
      
      return true;
    });

    return relevantLogs.length;
  }, [stockLogs, request, orders]);


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
