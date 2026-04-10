
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Globe, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface RegionalStats {
    region: string;
    revenue: number;
    expenses: number;
    profit: number;
    margin: number;
}

interface RegionalComparisonTableProps {
  data: Record<string, RegionalStats>;
}

const RegionalComparisonTable = ({ data }: RegionalComparisonTableProps) => {
  const regions = Object.values(data).sort((a, b) => b.revenue - a.revenue);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS', currencyDisplay: 'code' }).format(amount);
  }

  if (regions.length === 0) return null;

  const totalRevenue = regions.reduce((sum, r) => sum + r.revenue, 0);
  const totalExpenses = regions.reduce((sum, r) => sum + r.expenses, 0);
  const totalProfit = totalRevenue - totalExpenses;
  const overallMargin = totalRevenue > 0 ? (totalExpenses / totalRevenue) * 100 : 0;

  return (
    <Card className="border-primary/20 shadow-md">
      <CardHeader className="bg-primary/5 border-b">
        <CardTitle className="flex items-center space-x-2 text-primary">
          <Globe className="h-5 w-5" />
          <span>Regional Performance Comparison</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-bold">Region</TableHead>
              <TableHead className="text-right font-bold">Revenue</TableHead>
              <TableHead className="text-right font-bold">Expenses</TableHead>
              <TableHead className="text-right font-bold">Net Profit/Loss</TableHead>
              <TableHead className="text-right font-bold">Margin</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {regions.map((r) => {
              const isProfit = r.profit >= 0;
              return (
                <TableRow key={r.region} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="font-bold">{r.region}</TableCell>
                  <TableCell className="text-right text-green-600 font-medium">{formatCurrency(r.revenue)}</TableCell>
                  <TableCell className="text-right text-destructive font-medium">{formatCurrency(r.expenses)}</TableCell>
                  <TableCell className={cn(
                    "text-right font-bold",
                    isProfit ? "text-green-700" : "text-destructive"
                  )}>
                    <div className="flex items-center justify-end gap-1">
                        {isProfit ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {formatCurrency(r.profit)}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant={r.margin > 30 ? "destructive" : r.margin > 25 ? "outline" : "secondary"} className="font-mono">
                      {r.margin.toFixed(1)}%
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          <TableFooter className="bg-primary/5">
            <TableRow>
              <TableCell className="font-black uppercase tracking-wider">Total Aggregate</TableCell>
              <TableCell className="text-right font-bold text-green-700">{formatCurrency(totalRevenue)}</TableCell>
              <TableCell className="text-right font-bold text-destructive">{formatCurrency(totalExpenses)}</TableCell>
              <TableCell className={cn(
                "text-right font-black",
                totalProfit >= 0 ? "text-green-800" : "text-destructive"
              )}>
                {formatCurrency(totalProfit)}
              </TableCell>
              <TableCell className="text-right">
                <Badge className="bg-primary text-primary-foreground font-bold">
                  {overallMargin.toFixed(1)}%
                </Badge>
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </CardContent>
    </Card>
  );
};

export default RegionalComparisonTable;
