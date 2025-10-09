
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { DailyOrder } from "@/types";
import { format, parseISO } from "date-fns";

interface DailyOrdersTableProps {
    data: DailyOrder[];
    onDeleteOrder: (orderId: number) => void;
}

export function DailyOrdersTable({ data, onDeleteOrder }: DailyOrdersTableProps) {

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS' }).format(amount);
  }
  
  const grandTotal = data.reduce((sum, order) => sum + order.total, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily Orders</CardTitle>
        <CardDescription>All individual orders recorded for this booking contract.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Menu / Particulars</TableHead>
              <TableHead className="text-center">Quantity</TableHead>
              <TableHead className="text-right">Unit Price</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length > 0 ? data.map(order => (
              <TableRow key={order.id}>
                <TableCell>{format(parseISO(order.order_date), 'PPP')}</TableCell>
                <TableCell className="font-medium">{order.menu}</TableCell>
                <TableCell className="text-center">{order.quantity}</TableCell>
                <TableCell className="text-right">{formatCurrency(order.unit_price)}</TableCell>
                <TableCell className="text-right font-semibold">{formatCurrency(order.total)}</TableCell>
                <TableCell className="text-right">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                             <DropdownMenuItem className="text-destructive" onClick={() => onDeleteOrder(order.id)}>
                                <Trash2 className="mr-2 h-4 w-4"/> Delete Order
                             </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">No daily orders recorded yet.</TableCell>
              </TableRow>
            )}
          </TableBody>
          <TableFooter>
            <TableRow>
                <TableCell colSpan={4} className="text-right font-bold text-lg">Grand Total</TableCell>
                <TableCell className="text-right font-bold text-lg">{formatCurrency(grandTotal)}</TableCell>
                <TableCell></TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </CardContent>
    </Card>
  )
}
