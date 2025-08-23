// @ts-nocheck
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useMemo } from "react";
import { isWithinInterval, startOfMonth, endOfMonth } from 'date-fns';

const IngredientCostTable = ({ stockLogs, products, request }) => {
  
  const { ingredientsWithCost, totalCost } = useMemo(() => {
    if(!request) return { ingredientsWithCost: [], totalCost: 0};

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

    const relevantLogs = stockLogs.filter(log => {
      const logDate = new Date(log.date);
      const isStockOut = log.type === "Stock Out";
      const inInterval = intervals.some(interval => isWithinInterval(logDate, interval));
      return isStockOut && inInterval;
    });

    const ingredientsWithCost = relevantLogs.map(log => {
        const product = products.find(p => p.id === log.productId);
        return {
            ...log,
            productName: product?.name || "Unknown Product",
            unit: product?.unit || "N/A",
            cost: (product?.unitPrice || 0) * log.quantity,
            unitPrice: product?.unitPrice || 0
        };
    });
    
    const totalCost = ingredientsWithCost.reduce((sum, item) => sum + item.cost, 0);
    
    return { ingredientsWithCost, totalCost };
  }, [stockLogs, products, request]);


  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS', currencyDisplay: 'code' }).format(amount);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <span>Ingredient Cost Breakdown</span>
           <Badge variant="outline">{ingredientsWithCost.length} items used</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ingredient</TableHead>
              <TableHead>Qty Used</TableHead>
              <TableHead>Unit Price</TableHead>
              <TableHead className="text-right">Total Cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ingredientsWithCost.length > 0 ? ingredientsWithCost.map((ingredient, index) => (
              <TableRow key={index}>
                <TableCell className="font-medium">{ingredient.productName}</TableCell>
                <TableCell>
                    {ingredient.quantity} {ingredient.unit}
                </TableCell>
                <TableCell>{formatCurrency(ingredient.unitPrice)} / {ingredient.unit}</TableCell>
                <TableCell className="text-right font-medium">
                  <span className="text-destructive">
                    {formatCurrency(ingredient.cost)}
                  </span>
                </TableCell>
              </TableRow>
            )) : (
                <TableRow>
                    <TableCell colSpan={4} className="text-center h-24">No stock out data for the selected period.</TableCell>
                </TableRow>
            )}
            <TableRow className="border-t-2">
              <TableCell colSpan={3} className="font-bold">
                Total Ingredient Cost
              </TableCell>
              <TableCell className="text-right font-bold text-lg text-destructive">
                {formatCurrency(totalCost)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default IngredientCostTable;
