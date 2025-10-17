
"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { MoreHorizontal, Trash2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DeliveryNote } from "@/types";
import { format, parseISO, isValid } from 'date-fns';

type DeliveryNoteWithClient = DeliveryNote & { clientName: string; orderId: string; };

export const getDeliveryNoteColumns = (
  onDelete: (id: string) => void
): ColumnDef<DeliveryNoteWithClient>[] => [
  {
    accessorKey: "id",
    header: "Delivery Note #",
    cell: ({ row }) => <div className="font-mono text-xs">{row.getValue("id")}</div>,
  },
  {
    accessorKey: "clientName",
    header: "Client Name",
  },
    {
    accessorKey: "orderId",
    header: "Order ID",
    cell: ({ row }) => <div className="font-mono text-xs">{row.getValue("orderId")}</div>,
  },
  {
    accessorKey: "delivery_date",
    header: "Delivery Date",
    cell: ({ row }) => {
      const dateStr = row.getValue("delivery_date") as string;
      if (!dateStr) return 'N/A';
      const date = parseISO(dateStr);
      return isValid(date) ? format(date, 'PPP') : 'Invalid Date';
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const deliveryNote = row.original;
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
              <Link href={`/delivery-notes/${deliveryNote.id}`} className="cursor-pointer">
                <Eye className="mr-2 h-4 w-4" /> View Details
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(deliveryNote.id)}
              className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
            >
              <Trash2 className="mr-2 h-4 w-4" /> Delete Note
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
