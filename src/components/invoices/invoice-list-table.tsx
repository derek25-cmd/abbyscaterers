
"use client";

import * as React from "react";
import { useSearchParams, useRouter } from 'next/navigation';
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
import { PlusCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { getInvoiceColumns } from "./columns"; 
import { useInvoiceStorage } from "@/hooks/use-invoice-storage";
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
import { useClientStorage } from "@/hooks/use-client-storage";
import { useProformaInvoiceStorage } from "@/hooks/use-proforma-invoice-storage";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";


export function InvoiceListTable() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientIdFilter = searchParams.get('clientId');

  const { invoices, isLoading: invoicesLoading, deleteInvoice } = useInvoiceStorage();
  const { proformaInvoices, isLoading: proformasLoading } = useProformaInvoiceStorage();
  const { clients, isLoading: clientsLoading } = useClientStorage();
  const { toast } = useToast();
  
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});
  const [itemToDelete, setItemToDelete] = React.useState<string | null>(null);

  const [popoverOpen, setPopoverOpen] = React.useState(false);

  const handleDeleteRequest = React.useCallback((invoiceId: string) => {
    setItemToDelete(invoiceId);
  }, []);

  const confirmDelete = React.useCallback(() => {
    if (itemToDelete) {
      const success = deleteInvoice(itemToDelete);
      if (success) {
        toast({ title: "Invoice Deleted", description: "The invoice has been successfully deleted." });
      } else {
        toast({ variant: "destructive", title: "Error", description: "Failed to delete the invoice." });
      }
      setItemToDelete(null);
    }
  }, [itemToDelete, deleteInvoice, toast]);
  
  const getClientName = React.useCallback((clientId: string | null) => {
    if (!clientId) return 'N/A';
    const client = clients.find(c => c.id === clientId);
    return client?.companyName || 'Unknown Client';
  }, [clients]);

  const filteredInvoices = React.useMemo(() => {
    return clientIdFilter
      ? invoices.filter(inv => inv.clientId === clientIdFilter)
      : invoices;
  }, [invoices, clientIdFilter]);

  const tableData = React.useMemo(() => filteredInvoices.map(inv => ({
    ...inv,
    clientName: getClientName(inv.clientId)
  })), [filteredInvoices, getClientName]);
  
  const columns = React.useMemo(() => getInvoiceColumns(handleDeleteRequest), [handleDeleteRequest]);

  const table = useReactTable({
    data: tableData,
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
  
  const isLoading = invoicesLoading || clientsLoading || proformasLoading;

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="mr-2 h-8 w-8 animate-spin" />Loading invoices...</div>;
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Input
          placeholder="Filter by client name..."
          value={(table.getColumn("clientName")?.getFilterValue() as string) ?? ""}
          onChange={(event) =>
            table.getColumn("clientName")?.setFilterValue(event.target.value)
          }
          className="max-w-sm"
        />
        <div className="flex gap-2">
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={popoverOpen}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Create from Proforma
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0">
                <Command>
                    <CommandInput placeholder="Search proforma..." />
                    <CommandList>
                        <CommandEmpty>No proforma invoices found.</CommandEmpty>
                        <CommandGroup>
                            {proformaInvoices.map((pi) => (
                                <CommandItem
                                    key={pi.id}
                                    value={`${pi.id} - ${getClientName(pi.clientId)}`}
                                    onSelect={() => {
                                        router.push(`/invoices/new?fromProforma=${pi.id}`);
                                        setPopoverOpen(false);
                                    }}
                                >
                                    <Check className={cn("mr-2 h-4 w-4", "opacity-0" )} />
                                    {pi.id} - {getClientName(pi.clientId)}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

          <Link href="/invoices/new" passHref>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              New Invoice from Scratch
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
                  {clientIdFilter ? `No invoices found for client ID: ${clientIdFilter}.` : 'No final invoices found.'}
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
              This action cannot be undone. This will permanently delete the invoice.
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
