
"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { MoreHorizontal, Edit, Trash2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Invoice } from "@/types";
import { format, parseISO, isValid } from 'date-fns';
import { Badge } from "../ui/badge";
import { cn } from "@/lib/utils";

type InvoiceWithClientName = Invoice & { clientName: string };

const calculateGrandTotal = (invoice: Invoice): number => {
    const subtotal = invoice.items.reduce((sum, item) => sum + (item.total || 0), 0);
    const totalForDays = invoice.multiplyByDays ? subtotal * (invoice.numberOfDays || 1) : subtotal;
    const totalBeforeVat = totalForDays + (invoice.serviceCharge || 0) + (invoice.transportCosts || 0);
    const vat = invoice.vatType === 'exclusive' ? totalBeforeVat * 0.18 : 0;
    return totalBeforeVat + vat;
};

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS', currencyDisplay: 'code' }).format(amount);
}


export const getInvoiceColumns = (
  onDelete: (invoiceId: string) => void
): ColumnDef<InvoiceWithClientName>[] => [
  {
    accessorKey: "id",
    header: "Invoice No.",
    cell: ({ row }) => <div className="font-mono text-xs">{row.getValue("id")}</div>,
  },
  {
    accessorKey: "clientName",
    header: "Customer Name",
    cell: ({ row }) => <div className="font-medium">{row.getValue("clientName")}</div>,
  },
  {
    accessorKey: "proformaId",
    header: "Proforma No.",
    cell: ({ row }) => {
        const proformaId = row.getValue("proformaId") as string | undefined;
        return <div className="font-mono text-xs">{proformaId || 'N/A'}</div>;
    },
  },
  {
    accessorKey: "invoiceDate",
    header: "Date",
    cell: ({ row }) => {
        const dateStr = row.getValue("invoiceDate") as string | undefined;
        if (!dateStr) return 'N/A';
        const date = parseISO(dateStr);
        return isValid(date) ? format(date, 'PPP') : 'Invalid Date';
    },
  },
  {
    id: "amount",
    header: "Amount",
    cell: ({ row }) => {
        const amount = calculateGrandTotal(row.original);
        return <div className="text-right font-medium">{formatCurrency(amount)}</div>;
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      return (
        <Badge
          className={cn(
            "capitalize",
            status === 'paid' ? 'bg-success/20 text-green-700 border-success/30' : 'bg-destructive/10 text-destructive border-destructive/20'
          )}
          variant="outline"
        >
          {status}
        </Badge>
      );
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const invoice = row.original;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <Link href={`/invoices/${invoice.id}`} className="flex items-center cursor-pointer">
                <Eye className="mr-2 h-4 w-4" /> View Details
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/invoices/${invoice.id}/edit`} className="flex items-center cursor-pointer">
                <Edit className="mr-2 h-4 w-4" /> Edit Invoice
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(invoice.id)}
              className="text-destructive focus:text-destructive focus:bg-destructive/10 flex items-center cursor-pointer"
            >
              <Trash2 className="mr-2 h-4 w-4" /> Delete Invoice
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
