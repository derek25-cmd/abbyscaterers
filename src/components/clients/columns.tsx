
"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { MoreHorizontal, Edit, Trash2, Eye, Building, Fingerprint } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Client } from "@/types";
import { format, parseISO } from "date-fns";

export const getColumns = (
  onDelete: (clientId: string) => void
): ColumnDef<Client>[] => [
  {
    accessorKey: "id",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Client ID
        </Button>
      );
    },
    cell: ({ row }) => <div className="font-mono text-xs">{row.getValue("id")}</div>,
  },
  {
    accessorKey: "companyName",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Company Name
        </Button>
      );
    },
    cell: ({ row }) => <div className="font-medium">{row.getValue("companyName")}</div>,
  },
  {
    accessorKey: "companyEmail",
    header: "Company Email",
  },
  {
    accessorKey: "phoneNumber",
    header: "Phone Number",
  },
  {
    accessorKey: "primaryLocation",
    header: "Primary Location",
    cell: ({ row }) => {
        const location = row.getValue("primaryLocation");
        return location ? (
            <div className="flex items-center">
                <Building className="mr-2 h-4 w-4 text-muted-foreground" />
                {location as string}
            </div>
        ) : <span className="text-muted-foreground">N/A</span>;
    }
  },
  {
    accessorKey: "lastContacted",
    header: ({ column }) => {
       return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Last Contacted
        </Button>
      );
    },
    cell: ({ row }) => {
      const date = parseISO(row.getValue("lastContacted"));
      return <div className="whitespace-nowrap">{format(date, "PP")}</div>; // e.g., Sep 21, 2023
    },
    sortingFn: 'datetime',
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const client = row.original;
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
              <Link href={`/clients/${client.id}`} className="flex items-center cursor-pointer">
                <Eye className="mr-2 h-4 w-4" /> View Details
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/clients/${client.id}/edit`} className="flex items-center cursor-pointer">
                <Edit className="mr-2 h-4 w-4" /> Edit Client
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(client.id)}
              className="text-destructive focus:text-destructive focus:bg-destructive/10 flex items-center cursor-pointer"
            >
              <Trash2 className="mr-2 h-4 w-4" /> Delete Client
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
