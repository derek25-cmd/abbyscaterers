
"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { MoreHorizontal, Edit, Trash2, Eye, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ProformaInvoice } from "@/types";
import { format, parseISO, isValid } from 'date-fns';
import { Badge } from "../ui/badge";
import { cn, calculateGrandTotal } from "@/lib/utils";


type ProformaInvoiceWithClientName = ProformaInvoice & { clientName: string };

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS', currencyDisplay: 'code' }).format(amount);
}


export const getProformaInvoiceColumns = (
  onDelete: (invoiceId: string) => void
): ColumnDef<ProformaInvoiceWithClientName>[] => [
  {
    accessorKey: "id",
    header: "Proforma No.",
    cell: ({ row }) => <div className="font-mono text-xs">{row.getValue("id")}</div>,
  },
  {
    accessorKey: "clientName",
    header: "Customer Name",
    cell: ({ row }) => <div className="font-medium">{row.getValue("clientName")}</div>,
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
    accessorKey: "isInvoiced",
    header: "Status",
    cell: ({ row }) => {
      const isInvoiced = row.getValue("isInvoiced");
      return (
        <Badge
          variant={isInvoiced ? "destructive" : "secondary"}
          className={cn(isInvoiced && "bg-amber-100 text-amber-800 border-amber-300")}
        >
          {isInvoiced ? <Lock className="mr-1 h-3 w-3"/> : null}
          {isInvoiced ? 'Invoiced' : 'Open'}
        </Badge>
      );
    }
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
              <Link href={`/proforma-invoices/${invoice.id}`} className="flex items-center cursor-pointer">
                <Eye className="mr-2 h-4 w-4" /> View Details
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/proforma-invoices/${invoice.id}/edit`} className={cn("flex items-center cursor-pointer", invoice.isInvoiced && "text-muted-foreground pointer-events-none")}>
                <Edit className="mr-2 h-4 w-4" /> Edit Proforma
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(invoice.id)}
              className="text-destructive focus:text-destructive focus:bg-destructive/10 flex items-center cursor-pointer"
            >
              <Trash2 className="mr-2 h-4 w-4" /> Delete Proforma
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
