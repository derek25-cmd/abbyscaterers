
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { StockLog } from "@/types";
import { ShoppingCart, ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface StockLogTableProps {
  logs: StockLog[];
}

const StockLogTable = ({ logs }: StockLogTableProps) => {
  const totalCost = logs
    .filter(log => log.type?.toLowerCase() === 'stock out')
    .reduce((sum, log) => sum + log.price, 0);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS', currencyDisplay: 'code' }).format(amount);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <ShoppingCart className="h-5 w-5 text-primary" />
          <span>Stock Movements</span>
          <Badge variant="outline">{logs.length} entries</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Total Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length > 0 ? logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="font-medium">{log.productName}</TableCell>
                <TableCell>
                  <Badge variant={log.type === 'Stock In' ? 'secondary' : 'destructive'} className={cn(
                    log.type === 'Stock In' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  )}>
                    {log.type === 'Stock In' ? 
                      <ArrowDown className="h-3 w-3 mr-1"/> : 
                      <ArrowUp className="h-3 w-3 mr-1"/>
                    }
                    {log.type}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">{log.quantity}</TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(log.price)}
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                  <TableCell colSpan={4} className="text-center h-24">No stock logs for this period.</TableCell>
              </TableRow>
            )}
          </TableBody>
           <TableFooter>
            <TableRow className="border-t-2">
              <TableCell colSpan={3} className="font-bold text-lg">
                Total Ingredient Cost (Stocked Out)
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
