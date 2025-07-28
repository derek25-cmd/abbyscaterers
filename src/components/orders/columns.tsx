
"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { MoreHorizontal, Edit, Trash2, Eye, Utensils } from "lucide-react";
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

type OrderWithClientName = Order & { customerName: string };

export const getOrderColumns = (
  onDelete: (orderId: string) => void,
  getClientById: (id: string) => Client | undefined
): ColumnDef<OrderWithClientName>[] => {
  return [
    {
      accessorKey: "id",
      header: "Order ID",
      cell: ({ row }) => <div className="font-mono text-xs">{row.getValue("id")}</div>,
    },
    {
      accessorKey: "proformaId",
      header: "Proforma No.",
      cell: ({ row }) => {
        const proformaId = row.getValue("proformaId") as string;
        return <div className="font-mono text-xs">{proformaId || 'N/A'}</div>;
      },
    },
    {
      accessorKey: "customerName",
      header: "Customer Name",
      cell: ({ row }) => {
        const order = row.original;
        const client = order.clientEvents.length > 0 ? getClientById(order.clientEvents[0].clientId) : null;
        return (
          <div className="font-medium">
            {client ? client.companyName : "N/A"}
          </div>
        );
      },
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => {
        const description = row.getValue("description") as string;
        const name = row.original.name;
        return <div className="text-muted-foreground truncate" style={{maxWidth: '250px'}}>{description || name}</div>;
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
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
              <DropdownMenuItem asChild>
                <Link href={`/menus/new?orderId=${order.id}`} className="flex items-center cursor-pointer">
                  <Utensils className="mr-2 h-4 w-4" /> Create Menu
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
