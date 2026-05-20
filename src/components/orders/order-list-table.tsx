"use client";

import * as React from "react";
import { useSearchParams } from 'next/navigation';
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
import { PlusCircle, Loader2, CalendarIcon, ListFilter, Search, X, Trash2 } from "lucide-react";
import Link from "next/link";
import { getOrderColumns } from "./columns"; 
import { useOrderStorage } from "@/hooks/use-order-storage";
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
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Calendar } from "../ui/calendar";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "../ui/dropdown-menu";

export function OrderListTable() {
  const searchParams = useSearchParams();
  const clientIdFilter = searchParams.get('clientId');
  
  const { orders, isLoading: ordersLoading, deleteOrder: deleteOrderFromStore, bulkDeleteOrders } = useOrderStorage();
  const { clients, isLoading: clientsLoading, getClientById } = useClientStorage();
  const { toast } = useToast();
  
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});
  const [itemsToDelete, setItemsToDelete] = React.useState<string[] | null>(null);
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(new Date());
  const [filterType, setFilterType] = React.useState("customerName");
  const [searchQuery, setSearchQuery] = React.useState("");


  const getClientName = React.useCallback((clientId: string | null) => {
    if (!clientId) return 'N/A';
    const client = clients.find(c => c.id === clientId);
    return client?.companyName || 'Unknown Client';
  }, [clients]);

  
  const tableData = React.useMemo(() => {
      let filtered = orders;

      if (clientIdFilter) {
          filtered = filtered.filter(order => order.clientId === clientIdFilter);
      }
      
      if (selectedDate) {
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        filtered = filtered.filter(order => {
            // Check if the selected date falls within the order's top-level start/end dates
            const start = order.startDate;
            const end = order.endDate;
            return (start && start <= dateStr && end && end >= dateStr) || (start === dateStr);
        });
      }
      
      if(searchQuery) {
          const lowercasedQuery = searchQuery.toLowerCase();
          filtered = filtered.filter(order => {
              const clientName = getClientName(order.clientId).toLowerCase();
              switch (filterType) {
                  case 'id':
                      return order.id.toLowerCase().includes(lowercasedQuery);
                  case 'proformaId':
                      return order.proformaId?.toLowerCase().includes(lowercasedQuery);
                  case 'customerName':
                  default:
                      return clientName.includes(lowercasedQuery);
              }
          })
      }
      
      return filtered.map(order => ({
        ...order,
        customerName: getClientName(order.clientId),
      }));

  }, [orders, clientIdFilter, selectedDate, searchQuery, filterType, getClientName]);

  const handleDeleteRequest = React.useCallback((orderId: string) => {
    setItemsToDelete([orderId]);
  }, []);

  const confirmDelete = React.useCallback(async () => {
    if (itemsToDelete && itemsToDelete.length > 0) {
      if (itemsToDelete.length === 1) {
        const success = await deleteOrderFromStore(itemsToDelete[0]);
        if (success) {
          toast({ title: "Order Deleted", description: "The order has been successfully deleted." });
        } else {
          toast({ variant: "destructive", title: "Error", description: "Failed to delete the order." });
        }
      } else {
        const success = await bulkDeleteOrders(itemsToDelete);
        if (success) {
          toast({ title: "Orders Deleted", description: `${itemsToDelete.length} orders have been successfully deleted.` });
          setRowSelection({});
        } else {
          toast({ variant: "destructive", title: "Error", description: "Failed to delete the orders." });
        }
      }
      setItemsToDelete(null);
    }
  }, [itemsToDelete, deleteOrderFromStore, bulkDeleteOrders, toast]);
  
  const columns = React.useMemo(() => getOrderColumns(handleDeleteRequest, getClientById), [handleDeleteRequest, getClientById]);

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

  const isLoading = ordersLoading || clientsLoading;

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="mr-2 h-8 w-8 animate-spin" />Loading orders...</div>;
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
            <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    type="search"
                    placeholder={`Search by ${filterType}...`}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-lg bg-background pl-8 md:w-[200px] lg:w-[320px]"
                />
            </div>
             <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 gap-1">
                    <ListFilter className="h-3.5 w-3.5" />
                    <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                      Filter By
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Filter by</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem checked={filterType === 'customerName'} onCheckedChange={() => setFilterType('customerName')}>Customer</DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={filterType === 'id'} onCheckedChange={() => setFilterType('id')}>Order ID</DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={filterType === 'proformaId'} onCheckedChange={() => setFilterType('proformaId')}>Proforma No.</DropdownMenuCheckboxItem>
                </DropdownMenuContent>
            </DropdownMenu>
            <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-[240px] justify-start text-left font-normal h-9",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "PPP") : <span>Filter by date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {selectedDate && (
                <Button variant="ghost" size="sm" onClick={() => setSelectedDate(undefined)}>
                  <X className="h-4 w-4 mr-1" />
                  Show All
                </Button>
              )}
        </div>
        <div className="flex gap-2">
          {Object.keys(rowSelection).length > 0 && (
            <Button 
              variant="destructive" 
              onClick={() => {
                const selectedIds = table.getFilteredSelectedRowModel().rows.map(r => r.original.id);
                setItemsToDelete(selectedIds);
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Delete Selected ({Object.keys(rowSelection).length})
            </Button>
          )}
          <Link href="/orders/new" passHref>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              New Order
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
                  {clientIdFilter ? `No orders found for client ID: ${clientIdFilter}.` : 'No orders found for the selected criteria.'}
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
      <AlertDialog open={!!itemsToDelete} onOpenChange={(open) => !open && setItemsToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete {itemsToDelete?.length === 1 ? 'the order' : `${itemsToDelete?.length} orders`}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setItemsToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}