
"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { MoreHorizontal, Edit, Eye, Trash2 } from "lucide-react";
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
import { format, parseISO, isValid } from 'date-fns';
import { Badge } from "../ui/badge";

export const getColumns = (
  onDelete: (clientId: string) => void
): ColumnDef<Client>[] => [
  {
    accessorKey: "id",
    header: "Reg. No.",
    cell: ({ row }) => <div className="font-mono text-xs">{row.getValue("id")}</div>,
  },
  {
    accessorKey: "companyName",
    header: "Company Name",
    cell: ({ row }) => {
        const client = row.original;
        return (
            <Link href={`/clients/${client.id}`} className="font-medium text-primary hover:underline">
                {row.getValue("companyName")}
            </Link>
        )
    },
  },
  {
    accessorKey: "createdAt",
    header: "Date Created",
    cell: ({ row }) => {
      const dateStr = row.getValue("createdAt") as string | undefined;
      if (!dateStr) return 'N/A';
      const date = parseISO(dateStr);
      return isValid(date) ? format(date, 'PPP') : 'Invalid Date';
    },
  },
  {
    accessorKey: "typeOfOrganization",
    header: "Org. Type",
    cell: ({ row }) => {
      const orgType = row.getValue("typeOfOrganization") as string;
      return orgType ? <Badge variant="secondary">{orgType}</Badge> : <span className="text-muted-foreground">N/A</span>;
    },
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
