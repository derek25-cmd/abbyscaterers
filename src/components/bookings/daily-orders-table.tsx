
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Trash2, Eye, FileText } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Order } from "@/types";
import { format, parseISO, isValid } from "date-fns";
import Link from "next/link";
import { Badge } from "../ui/badge";

interface DailyOrdersTableProps {
    data: Order[];
    onDeleteOrder: (orderId: string) => void;
}

export function DailyOrdersTable({ data, onDeleteOrder }: DailyOrdersTableProps) {

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS' }).format(amount);
  }
  
  const getOrderTotal = (order: Order) => {
      if (!order.clientEvents || order.clientEvents.length === 0) return 0;
      const event = order.clientEvents[0];
      return (event.unitPrice || 0) * (event.numberOfPeople || 0);
  }

  const grandTotal = data.reduce((sum, order) => sum + getOrderTotal(order), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recorded Order Items</CardTitle>
        <CardDescription>All individual orders and items recorded for this booking contract.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order ID</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Particulars</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead><span className="sr-only">Actions</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length > 0 ? data.map(order => {
              const eventDate = order.clientEvents?.[0]?.date;
              const event = order.clientEvents?.[0];
              const particular = event?.particularDescription || event?.mealType || order.name || 'N/A';
              
              return (
              <TableRow key={order.id}>
                <TableCell className="font-mono">{order.id}</TableCell>
                <TableCell>{eventDate && isValid(parseISO(eventDate)) ? format(parseISO(eventDate), 'PPP') : <Badge variant="secondary">N/A (Bulk)</Badge>}</TableCell>
                <TableCell className="font-medium">{particular}</TableCell>
                <TableCell className="text-right font-semibold">{formatCurrency(getOrderTotal(order))}</TableCell>
                <TableCell className="text-right">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                             <DropdownMenuItem asChild>
                                <Link href={`/orders/${order.id}`} className="cursor-pointer">
                                    <Eye className="mr-2 h-4 w-4"/> View Order
                                </Link>
                             </DropdownMenuItem>
                             <DropdownMenuItem asChild>
                                <Link href={`/invoices/new?fromOrder=${order.id}&clientId=${order.clientEvents[0]?.clientId}`} className="cursor-pointer">
                                    <FileText className="mr-2 h-4 w-4"/> Create Invoice
                                </Link>
                             </DropdownMenuItem>
                             <DropdownMenuItem className="text-destructive" onClick={() => onDeleteOrder(order.id)}>
                                <Trash2 className="mr-2 h-4 w-4"/> Delete Order
                             </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </TableCell>
              </TableRow>
            )}) : (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">No daily orders recorded yet.</TableCell>
              </TableRow>
            )}
          </TableBody>
          <TableFooter>
            <TableRow>
                <TableCell colSpan={3} className="text-right font-bold text-lg">Grand Total</TableCell>
                <TableCell className="text-right font-bold text-lg">{formatCurrency(grandTotal)}</TableCell>
                <TableCell></TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </CardContent>
    </Card>
  )
}
