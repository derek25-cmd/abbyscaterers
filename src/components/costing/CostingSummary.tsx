
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";

interface CostingSummaryProps {
  totalIngredientCost: number;
  totalIncome: number;
  netProfitLoss: number;
}

const CostingSummary = ({ totalIngredientCost, totalIncome, netProfitLoss }: CostingSummaryProps) => {
  const isProfit = netProfitLoss >= 0;
  const profitLossPercentage = totalIncome > 0 ? (netProfitLoss / totalIncome) * 100 : 0;
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS', currencyDisplay: 'code' }).format(amount);
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {/* Total Ingredient Cost */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Ingredient Cost</CardTitle>
          <ShoppingCart className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-destructive">
            {formatCurrency(totalIngredientCost)}
          </div>
          <p className="text-xs text-muted-foreground">
            Daily food cost
          </p>
        </CardContent>
      </Card>

      {/* Total Income */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Income</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-success">
            {formatCurrency(totalIncome)}
          </div>
          <p className="text-xs text-muted-foreground">
            Event revenue
          </p>
        </CardContent>
      </Card>

      {/* Net Profit/Loss */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Net Profit/Loss</CardTitle>
          {isProfit ? 
            <TrendingUp className="h-4 w-4 text-success" /> : 
            <TrendingDown className="h-4 w-4 text-destructive" />
          }
        </CardHeader>
        <CardContent>
          <div className={cn(
            "text-2xl font-bold",
            isProfit ? "text-success" : "text-destructive"
          )}>
            {isProfit ? '+' : ''}{formatCurrency(netProfitLoss)}
          </div>
          <p className="text-xs text-muted-foreground">
            Daily {isProfit ? 'profit' : 'loss'}
          </p>
        </CardContent>
      </Card>

      {/* Profit Margin */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Profit Margin</CardTitle>
          <Badge variant={isProfit ? "secondary" : "destructive"}>
            {profitLossPercentage.toFixed(1)}%
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {Math.abs(profitLossPercentage).toFixed(1)}%
          </div>
          <p className="text-xs text-muted-foreground">
            {isProfit ? 'Above' : 'Below'} break-even
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default CostingSummary;
