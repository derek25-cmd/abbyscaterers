
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
import type { Recipe } from "@/types";

export const getRecipeColumns = (
  onDelete: (recipeNumber: string) => void
): ColumnDef<Recipe>[] => [
  {
    accessorKey: "recipeNumber",
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Recipe No.
      </Button>
    ),
    cell: ({ row }) => <div className="font-mono text-xs">{row.getValue("recipeNumber")}</div>,
  },
  {
    accessorKey: "recipeName",
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Food Created
      </Button>
    ),
    cell: ({ row }) => <div className="font-medium">{row.getValue("recipeName")}</div>,
  },
  {
    accessorKey: "ingredients",
    header: "No. of Ingredients",
    cell: ({ row }) => {
      const ingredients = row.getValue("ingredients") as any[];
      return <div className="text-center">{ingredients.length}</div>;
    }
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const recipe = row.original;
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
              <Link href={`/recipes/${recipe.recipeNumber}`} className="flex items-center cursor-pointer">
                <Eye className="mr-2 h-4 w-4" /> View Details
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/recipes/${recipe.recipeNumber}/edit`} className="flex items-center cursor-pointer">
                <Edit className="mr-2 h-4 w-4" /> Edit Recipe
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(recipe.recipeNumber)}
              className="text-destructive focus:text-destructive focus:bg-destructive/10 flex items-center cursor-pointer"
            >
              <Trash2 className="mr-2 h-4 w-4" /> Delete Recipe
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
