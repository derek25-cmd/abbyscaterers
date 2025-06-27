
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
import type { Ingredient, UnitAndPrice } from "@/types";
import { Badge } from "@/components/ui/badge";

export const getIngredientColumns = (
  onDelete: (itemNumber: string) => void
): ColumnDef<Ingredient>[] => [
  {
    accessorKey: "itemNumber",
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        No.
      </Button>
    ),
    cell: ({ row }) => <div className="font-mono text-xs">{row.getValue("itemNumber")}</div>,
  },
  {
    accessorKey: "itemDescription",
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Item Description
      </Button>
    ),
    cell: ({ row }) => <div className="font-medium">{row.getValue("itemDescription")}</div>,
  },
  {
    accessorKey: "itemClassification",
    header: "Classification",
    cell: ({ row }) => {
      const classification = row.getValue("itemClassification") as string;
      return <Badge variant="secondary">{classification}</Badge>;
    }
  },
  {
    accessorKey: "units",
    header: "Units Available",
    cell: ({ row }) => {
      const units = row.getValue("units") as UnitAndPrice[];
      if (!units || units.length === 0) return <Badge variant="outline">None</Badge>;
      
      const sortedUnits = [...units].sort((a, b) => a.unit.localeCompare(b.unit));
      
      return (
        <div className="flex flex-wrap gap-1">
          {sortedUnits.map(u => <Badge key={u.unit} variant="outline" className="font-mono">{u.unit}</Badge>)}
        </div>
      );
    }
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const ingredient = row.original;
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
              <Link href={`/ingredients/${ingredient.itemNumber}`} className="flex items-center cursor-pointer">
                <Eye className="mr-2 h-4 w-4" /> View Details
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/ingredients/${ingredient.itemNumber}/edit`} className="flex items-center cursor-pointer">
                <Edit className="mr-2 h-4 w-4" /> Edit Ingredient
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(ingredient.itemNumber)}
              className="text-destructive focus:text-destructive focus:bg-destructive/10 flex items-center cursor-pointer"
            >
              <Trash2 className="mr-2 h-4 w-4" /> Delete Ingredient
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
