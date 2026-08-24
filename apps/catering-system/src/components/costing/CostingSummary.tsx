
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Percent } from "lucide-react";
import { cn } from "@/lib/utils";

interface CostingSummaryProps {
  totalIngredientCost: number;
  totalIncome: number;
  netProfitLoss: number;
  forecastedIngredientCost?: number;
}

const CostingSummary = ({ totalIngredientCost, totalIncome, netProfitLoss, forecastedIngredientCost = 0 }: CostingSummaryProps) => {
  const isProfit = netProfitLoss >= 0;
  
  const costingMargin = totalIncome > 0 ? (totalIngredientCost / totalIncome) * 100 : 0;
  const forecastMargin = totalIncome > 0 ? (forecastedIngredientCost / totalIncome) * 100 : 0;

  const getMarginProps = (margin: number) => {
    if (margin > 30) return { text: "Below break-even", color: "text-destructive" };
    if (margin >= 25 && margin <= 30) return { text: "Above break-even", color: "text-orange-600" };
    return { text: "Healthy Margin", color: "text-green-600" };
  };

  const actualMarginProps = getMarginProps(costingMargin);
  const forecastedMarginProps = getMarginProps(forecastMargin);
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS', currencyDisplay: 'code' }).format(amount);
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
      {/* Total Ingredient Cost */}
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Costs</CardTitle>
          <ShoppingCart className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex flex-col space-y-1">
             <div className="flex justify-between items-end">
                <span className="text-xs text-muted-foreground uppercase font-semibold">Actual</span>
                <span className="text-xl font-bold text-destructive">{formatCurrency(totalIngredientCost)}</span>
             </div>
             {forecastedIngredientCost > 0 && (
                 <div className="flex justify-between items-end">
                    <span className="text-xs text-muted-foreground uppercase font-semibold">Forecast</span>
                    <span className="text-md font-semibold text-muted-foreground">{formatCurrency(forecastedIngredientCost)}</span>
                 </div>
             )}
          </div>
        </CardContent>
      </Card>

      {/* Total Income */}
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            {formatCurrency(totalIncome)}
          </div>
          <p className="text-xs text-muted-foreground">
            Event revenue + misc. income
          </p>
        </CardContent>
      </Card>

      {/* Gross Profit/Loss */}
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Gross Profit/Loss</CardTitle>
          {isProfit ? 
            <TrendingUp className="h-4 w-4 text-green-500" /> : 
            <TrendingDown className="h-4 w-4 text-red-500" />
          }
        </CardHeader>
        <CardContent>
          <div className={cn(
            "text-2xl font-bold",
            isProfit ? "text-green-600" : "text-destructive"
          )}>
            {isProfit ? '+' : ''}{formatCurrency(netProfitLoss)}
          </div>
          <p className="text-xs text-muted-foreground">
            Total Revenue - Total Costs
          </p>
        </CardContent>
      </Card>

      {/* Costing Margin */}
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Costing Margin</CardTitle>
          <Percent className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex flex-col space-y-1">
             <div className="flex justify-between items-end">
                <span className="text-xs text-muted-foreground uppercase font-semibold">Actual</span>
                <span className={cn("text-xl font-bold", actualMarginProps.color)}>{costingMargin.toFixed(1)}%</span>
             </div>
             <p className="text-xs text-right text-muted-foreground mb-1">{actualMarginProps.text}</p>
             
             {forecastedIngredientCost > 0 && (
                 <>
                  <div className="flex justify-between items-end mt-2">
                      <span className="text-xs text-muted-foreground uppercase font-semibold">Forecast</span>
                      <span className={cn("text-md font-semibold", forecastedMarginProps.color)}>{forecastMargin.toFixed(1)}%</span>
                  </div>
                  <p className="text-xs text-right text-muted-foreground">{forecastedMarginProps.text}</p>
                 </>
             )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CostingSummary;
