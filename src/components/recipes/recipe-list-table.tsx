
"use client";

import * as React from "react";
import {
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { PlusCircle, Download, Loader2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { getRecipeColumns } from "./columns"; 
import { useRecipeStorage } from "@/hooks/use-recipe-storage";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Recipe } from "@/types";

export function RecipeListTable() {
  const { recipes, isLoading, deleteRecipe: deleteRecipeFromStore, refreshRecipes } = useRecipeStorage();
  const { toast } = useToast();
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});
  const [itemToDelete, setItemToDelete] = React.useState<string | null>(null);

  const handleDeleteRequest = React.useCallback((recipeNumber: string) => {
    setItemToDelete(recipeNumber);
  }, []);

  const confirmDelete = React.useCallback(async () => {
    if (itemToDelete) {
      const success = await deleteRecipeFromStore(itemToDelete);
      if (success) {
        toast({ title: "Recipe Deleted", description: "The recipe has been successfully deleted." });
      } else {
        toast({ variant: "destructive", title: "Error", description: "Failed to delete recipe." });
      }
      setItemToDelete(null);
    }
  }, [itemToDelete, deleteRecipeFromStore, toast]);
  
  const columns = React.useMemo(() => getRecipeColumns(handleDeleteRequest), [handleDeleteRequest]);

  const table = useReactTable({
    data: recipes,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
    initialState: {
      pagination: { pageSize: 10 }
    }
  });

  const exportData = () => {
    const csvRows: string[] = [];
    const headers = [
      "RecipeNo", "RecipeName", "IngredientsCount", "CreatedAt", "UpdatedAt"
    ];
    csvRows.push(headers.join(','));

    recipes.forEach((item: Recipe) => {
      const row = [
        item.recipeNumber,
        `"${item.recipeName.replace(/"/g, '""')}"`,
        item.ingredients?.length || 0,
        item.createdAt,
        item.updatedAt
      ];
      csvRows.push(row.join(','));
    });

    const csvString = csvRows.join('\r\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'caterSmart_recipes.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({ title: "Export Successful", description: "Recipe data exported to CSV." });
    } else {
       toast({ variant: "destructive", title: "Export Failed", description: "Your browser doesn't support this feature." });
    }
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="mr-2 h-8 w-8 animate-spin" />Loading recipes...</div>;
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Input
          placeholder="Filter by recipe name..."
          value={(table.getColumn("recipeName")?.getFilterValue() as string) ?? ""}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            table.getColumn("recipeName")?.setFilterValue(event.target.value)
          }
          className="max-w-sm"
        />
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refreshRecipes()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
          </Button>
          <Button variant="outline" onClick={exportData}>
            <Download className="mr-2 h-4 w-4" />
            Export Data
          </Button>
          <Link href="/recipes/new" passHref>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add New Recipe
            </Button>
          </Link>
        </div>
      </div>
      <div className="rounded-md border shadow-sm bg-card">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No recipes found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next
        </Button>
      </div>
      <AlertDialog open={!!itemToDelete} onOpenChange={(open: boolean) => !open && setItemToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the recipe.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setItemToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
