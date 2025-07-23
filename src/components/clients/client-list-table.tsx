
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
import { PlusCircle, Download } from "lucide-react";
import Link from "next/link";
import { getColumns } from "./columns";
import { useClientStorage } from "@/hooks/use-client-storage";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { ORGANIZATION_TYPES } from "@/types";

export function ClientListTable() {
  const { clients, isLoading } = useClientStorage();
  const { toast } = useToast();
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});
  
  const columns = React.useMemo(() => getColumns(), []);

  const table = useReactTable({
    data: clients,
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
      pagination: { pageSize: 20 }
    }
  });

  const exportData = () => {
    const csvRows = [];
    const headers = ["ID", "Company Name", "Company Email", "Phone Number", "Address 1", "Address 2", "Primary Location", "Last Contacted", "Created At", "Updated At"];
    csvRows.push(headers.join(','));

    clients.forEach(client => {
      const row = [
        client.id,
        `"${client.companyName.replace(/"/g, '""')}"`,
        client.companyEmail,
        client.phoneNumber,
        `"${client.address1.replace(/"/g, '""')}"`,
        `"${client.address2?.replace(/"/g, '""') || ''}"`,
        `"${client.primaryLocation.replace(/"/g, '""')}"`,
        client.lastContacted,
        client.createdAt,
        client.updatedAt
      ];
      csvRows.push(row.join(','));
    });

    const csvString = csvRows.join('\r\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'caterSmart_clients.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({ title: "Export Successful", description: "Client data exported to CSV." });
    } else {
       toast({ variant: "destructive", title: "Export Failed", description: "Your browser doesn't support this feature." });
    }
  };


  if (isLoading) {
    return <div className="flex justify-center items-center h-64">Loading clients...</div>;
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-grow sm:flex-grow-0">
          <Input
            placeholder="Filter by Reg. No..."
            value={(table.getColumn("id")?.getFilterValue() as string) ?? ""}
            onChange={(event) =>
              table.getColumn("id")?.setFilterValue(event.target.value)
            }
            className="w-full sm:w-40"
          />
          <Input
            placeholder="Filter by Name..."
            value={(table.getColumn("companyName")?.getFilterValue() as string) ?? ""}
            onChange={(event) =>
              table.getColumn("companyName")?.setFilterValue(event.target.value)
            }
            className="w-full sm:w-52"
          />
          <Select
            value={(table.getColumn("typeOfOrganization")?.getFilterValue() as string) ?? ""}
            onValueChange={(value) => table.getColumn("typeOfOrganization")?.setFilterValue(value === "all" ? "" : value)}
          >
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Filter by Org. Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {ORGANIZATION_TYPES.map(type => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportData}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Link href="/clients/new" passHref>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Client
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
                  className="py-2"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-2">
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
                  No clients found.
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
    </div>
  );
}
