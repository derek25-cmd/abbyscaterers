import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Percent } from "lucide-react";
import { cn } from "@/lib/utils";

interface CostingSummaryProps {
  totalIngredientCost: number;
  totalIncome: number;
  netProfitLoss: number;
}

const CostingSummary = ({ totalIngredientCost, totalIncome, netProfitLoss }: CostingSummaryProps) => {
  const isProfit = netProfitLoss >= 0;
  
  const costingMargin = totalIncome > 0 ? (totalIngredientCost / totalIncome) * 100 : 0;

  let marginStatusText = "";

  if (costingMargin > 30) {
    marginStatusText = "Below break-even";
  } else if (costingMargin >= 25 && costingMargin <= 30) {
    marginStatusText = "Above break-even";
  } else {
    marginStatusText = "Healthy Margin";
  }
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS', currencyDisplay: 'code' }).format(amount);
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
      {/* Total Ingredient Cost */}
      <Card className="p-2">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Ingredient Cost</CardTitle>
          <ShoppingCart className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-xl font-bold text-destructive">
            {formatCurrency(totalIngredientCost)}
          </div>
          <p className="text-xs text-muted-foreground">
            Daily food cost
          </p>
        </CardContent>
      </Card>

      {/* Total Income */}
      <Card className="p-2">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Income</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-xl font-bold text-green-600">
            {formatCurrency(totalIncome)}
          </div>
          <p className="text-xs text-muted-foreground">
            Event revenue
          </p>
        </CardContent>
      </Card>

      {/* Net Profit/Loss */}
      <Card className="p-2">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Net Profit/Loss</CardTitle>
          {isProfit ? 
            <TrendingUp className="h-4 w-4 text-green-500" /> : 
            <TrendingDown className="h-4 w-4 text-red-500" />
          }
        </CardHeader>
        <CardContent>
          <div className={cn(
            "text-xl font-bold",
            isProfit ? "text-green-600" : "text-destructive"
          )}>
            {isProfit ? '+' : ''}{formatCurrency(netProfitLoss)}
          </div>
          <p className="text-xs text-muted-foreground">
            Daily {isProfit ? 'profit' : 'loss'}
          </p>
        </CardContent>
      </Card>

      {/* Costing Margin */}
      <Card className="p-2">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Costing Margin</CardTitle>
          <Percent className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
           <div className={cn(
               "text-2xl font-bold",
               costingMargin > 30 ? "text-destructive" : "text-foreground"
            )}>
            {costingMargin.toFixed(1)}%
          </div>
          <p className="text-xs text-muted-foreground">
            {marginStatusText}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default CostingSummary;
