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
import { PlusCircle, Download, Loader2 } from "lucide-react";
import Link from "next/link";
import { getEquipmentColumns } from "./columns"; 
import { useEquipmentStorage } from "@/hooks/use-equipment-storage";
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

export function EquipmentListTable() {
  const { equipmentList, isLoading, deleteEquipment: deleteEquipmentFromStore } = useEquipmentStorage();
  const { toast } = useToast();
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});
  const [itemToDelete, setItemToDelete] = React.useState<string | null>(null);

  const handleDeleteRequest = (equipmentNumber: string) => {
    setItemToDelete(equipmentNumber);
  };

  const confirmDelete = () => {
    if (itemToDelete) {
      const success = deleteEquipmentFromStore(itemToDelete);
      if (success) {
        toast({ title: "Equipment Deleted", description: "The equipment item has been successfully deleted." });
      } else {
        toast({ variant: "destructive", title: "Error", description: "Failed to delete equipment item." });
      }
      setItemToDelete(null);
    }
  };
  
  const columns = React.useMemo(() => getEquipmentColumns(handleDeleteRequest), [handleDeleteRequest]); // eslint-disable-line react-hooks/exhaustive-deps

  const table = useReactTable({
    data: equipmentList,
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
    const csvRows = [];
    const headers = [
      "EquipmentNo", "EquipmentName", "OEM", "Model", "PowerRating", "Quantity", 
      "YearOfManufacture", "EquipmentSource", "Capacity", "Commitment", 
      "RegistrationNumber", "CreatedAt", "UpdatedAt"
    ];
    csvRows.push(headers.join(','));

    equipmentList.forEach(item => {
      const row = [
        item.equipmentNumber,
        `"${item.equipmentName.replace(/"/g, '""')}"`,
        `"${item.oem?.replace(/"/g, '""') || ''}"`,
        `"${item.model?.replace(/"/g, '""') || ''}"`,
        `"${item.powerRating?.replace(/"/g, '""') || ''}"`,
        item.quantity,
        `"${item.yearOfManufacture?.replace(/"/g, '""') || ''}"`,
        `"${item.equipmentSource?.replace(/"/g, '""') || ''}"`,
        `"${item.capacity?.replace(/"/g, '""') || ''}"`,
        `"${item.commitment?.replace(/"/g, '""') || ''}"`,
        `"${item.registrationNumber?.replace(/"/g, '""') || ''}"`,
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
      link.setAttribute('download', 'caterSmart_equipment.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({ title: "Export Successful", description: "Equipment data exported to CSV." });
    } else {
       toast({ variant: "destructive", title: "Export Failed", description: "Your browser doesn't support this feature." });
    }
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="mr-2 h-8 w-8 animate-spin" />Loading equipment...</div>;
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Input
          placeholder="Filter by equipment name..."
          value={(table.getColumn("equipmentName")?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn("equipmentName")?.setFilterValue(event.target.value)
          }
          className="max-w-sm"
        />
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportData}>
            <Download className="mr-2 h-4 w-4" />
            Export Data
          </Button>
          <Link href="/equipment/new" passHref>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add New Equipment
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
                  No equipment found.
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
      <AlertDialog open={!!itemToDelete} onOpenChange={(open) => !open && setItemToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the equipment item.
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
