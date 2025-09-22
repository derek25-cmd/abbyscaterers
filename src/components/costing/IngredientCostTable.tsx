import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { StockLog } from "@/types";
import { ShoppingCart } from "lucide-react";

interface StockLogTableProps {
  logs: StockLog[];
}

const StockLogTable = ({ logs }: StockLogTableProps) => {
  const totalCost = logs.reduce((sum, log) => sum + log.price, 0);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS', currencyDisplay: 'code' }).format(amount);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <ShoppingCart className="h-5 w-5 text-destructive" />
          <span>Ingredient Costs (Stocked Out)</span>
          <Badge variant="outline">{logs.length} items</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead className="text-right">Total Price</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length > 0 ? logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="font-medium">{log.productName}</TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {log.reason}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(log.price)}
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                  <TableCell colSpan={3} className="text-center h-24">No stock out logs for this period.</TableCell>
              </TableRow>
            )}
          </TableBody>
           <TableFooter>
            <TableRow className="border-t-2">
              <TableCell colSpan={2} className="font-bold text-lg">
                Total Ingredient Cost
              </TableCell>
              <TableCell className="text-right font-bold text-lg text-destructive">
                {formatCurrency(totalCost)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </CardContent>
    </Card>
  );
};

export default StockLogTable;
