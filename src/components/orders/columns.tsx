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
import type { Order, Client } from "@/types";
import { format, parseISO, isValid } from 'date-fns';
import { Badge } from "@/components/ui/badge";

type OrderWithClientName = Order & { customerName: string };

export const getOrderColumns = (
  onDelete: (orderId: string) => void,
  getClientById: (id: string) => Client | undefined
): ColumnDef<OrderWithClientName>[] => {
  return [
    {
      accessorKey: "id",
      header: "Order ID",
      cell: ({ row }: { row: any }) => <div className="font-mono text-xs">{row.getValue("id")}</div>,
    },
    {
      accessorKey: "customerName",
      header: "Customer Name",
      cell: ({ row }: { row: any }) => {
        const order = row.original;
        const client = getClientById(order.clientId);
        return (
          <div className="font-semibold text-primary">
            {client ? client.companyName : <span className="text-muted-foreground italic text-[10px]">No Client</span>}
          </div>
        );
      },
    },
    {
      accessorKey: "startDate",
      header: "Period",
      cell: ({ row }: { row: any }) => {
          const start = row.original.startDate;
          const end = row.original.endDate;
          if(!start || !end) return <span className="text-muted-foreground italic text-[10px]">N/A</span>;
          try {
            return (
                <div className="text-xs">
                    {format(parseISO(start), 'MMM d')} - {format(parseISO(end), 'MMM d, yyyy')}
                </div>
            )
          } catch (e) {
            return <div className="text-xs">{start} - {end}</div>
          }
      }
    },
    {
      accessorKey: "proformaId",
      header: "Proforma",
      cell: ({ row }: { row: any }) => {
        const proformaId = row.getValue("proformaId") as string;
        return proformaId ? (
            <Badge variant="outline" className="font-mono bg-primary/5 text-primary border-primary/20 text-[10px]">
                {proformaId}
            </Badge>
        ) : (
            <span className="text-muted-foreground text-[10px] italic">Not Linked</span>
        );
      },
    },
    {
      id: "actions",
      cell: ({ row }: { row: any }) => {
        const order = row.original;
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
                <Link href={`/orders/${order.id}`} className="flex items-center cursor-pointer">
                  <Eye className="mr-2 h-4 w-4" /> View Details
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/orders/${order.id}/edit`} className="flex items-center cursor-pointer">
                  <Edit className="mr-2 h-4 w-4" /> Edit Order
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete(order.id)}
                className="text-destructive focus:text-destructive focus:bg-destructive/10 flex items-center cursor-pointer"
              >
                <Trash2 className="mr-2 h-4 w-4" /> Delete Order
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
};
