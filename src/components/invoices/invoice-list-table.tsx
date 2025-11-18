
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
import { PlusCircle, Loader2, CalendarIcon, ListFilter, Search, X } from "lucide-react";
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
import { Calendar } from "../ui/calendar";
import { format } from 'date-fns';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "../ui/dropdown-menu";


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
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(new Date());
  const [filterType, setFilterType] = React.useState("clientName");
  const [searchQuery, setSearchQuery] = React.useState("");

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
    let data = invoices;
    if (clientIdFilter) {
      data = data.filter(inv => inv.clientId === clientIdFilter);
    }
     if (selectedDate) {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      data = data.filter(inv => inv.invoiceDate?.startsWith(dateStr));
    }
    if(searchQuery){
      const lowercasedQuery = searchQuery.toLowerCase();
      data = data.filter(inv => {
          switch(filterType){
              case 'id': return inv.id.toLowerCase().includes(lowercasedQuery);
              case 'proformaId': return inv.proformaId?.toLowerCase().includes(lowercasedQuery) ?? false;
              case 'clientName': return getClientName(inv.clientId).toLowerCase().includes(lowercasedQuery);
              default: return true;
          }
      });
    }
    return data;
  }, [invoices, clientIdFilter, selectedDate, searchQuery, filterType, getClientName]);

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
         <div className="flex items-center gap-2">
            <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    type="search"
                    placeholder={`Search...`}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-lg bg-background pl-8 md:w-[200px] lg:w-[320px]"
                />
            </div>
             <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 gap-1">
                    <ListFilter className="h-3.5 w-3.5" />
                    <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">Filter By</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Filter by</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem checked={filterType === 'clientName'} onCheckedChange={() => setFilterType('clientName')}>Client Name</DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={filterType === 'id'} onCheckedChange={() => setFilterType('id')}>Invoice No.</DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={filterType === 'proformaId'} onCheckedChange={() => setFilterType('proformaId')}>Proforma No.</DropdownMenuCheckboxItem>
                </DropdownMenuContent>
            </DropdownMenu>
            <Popover>
                <PopoverTrigger asChild>
                  <Button variant={"outline"} className={cn("w-[240px] justify-start text-left font-normal h-9", !selectedDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "PPP") : <span>Filter by date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} initialFocus />
                </PopoverContent>
            </Popover>
            {selectedDate && (
                <Button variant="ghost" size="sm" onClick={() => setSelectedDate(undefined)}><X className="h-4 w-4 mr-1"/>Show All</Button>
            )}
        </div>
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
                  No final invoices found for the selected criteria.
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
