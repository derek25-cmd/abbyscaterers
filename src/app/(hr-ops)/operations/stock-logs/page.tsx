
'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlusCircle, MinusCircle, MoreHorizontal, CalendarIcon, Search, ListFilter, ArrowDown, ArrowUp, DollarSign, MoveRight } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { LogStockMovementDialog } from "@/components/hr/log-stock-movement-dialog";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";
import { EditStockLogDialog } from "@/components/hr/edit-stock-log-dialog";
import { ViewStockLogDialog } from "@/components/hr/view-stock-log-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { StockLog } from "@/types";
import { useStockLogStorage } from "@/hooks/use-stock-log-storage";
import { useProductStorage } from "@/hooks/use-product-storage";
import { useReactTable, getCoreRowModel, getFilteredRowModel, getSortedRowModel, flexRender, RowSelectionState, SortingState, ColumnFiltersState, VisibilityState, ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";


export default function StockLogsPage() {
  const { logs, isLoading: logsLoading, addStockLog, updateStockLog: updateStockLogInStore, refreshLogs } = useStockLogStorage();
  const { products, isLoading: productsLoading, updateProduct: updateProductInStore } = useProductStorage();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [isLogDialogOpen, setIsLogDialogOpen] = useState(false);
  const [logType, setLogType] = useState<'Stock In' | 'Stock Out'>('Stock In');
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [newTransferDate, setNewTransferDate] = useState<Date | undefined>(new Date());
  const [isTransferring, setIsTransferring] = useState(false);
  const [selectedLog, setSelectedLog] = useState<StockLog | null>(null);
  
  // Table State
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  
  useEffect(() => {
    setLoading(logsLoading || productsLoading);
  }, [logsLoading, productsLoading]);
  
  const handleOpenLogDialog = (type: 'Stock In' | 'Stock Out') => {
    setLogType(type);
    setIsLogDialogOpen(true);
  };
  
  const handleLogMovement = async (movement: any) => {
    const product = products.find(p => p.id === movement.productId);
    
    if(!product) {
        toast({ variant: 'destructive', title: "Product not found" });
        return;
    }

    const logData = { ...movement, price: movement.actual_unit_price * movement.quantity };
    await addStockLog(logData);

    const updatedProduct = { ...product };
    if(movement.type === 'Stock In') {
        updatedProduct.quantity += movement.quantity;
    } else {
        if(product.quantity < movement.quantity) {
            toast({ variant: 'destructive', title: "Not enough stock to log out" });
            return;
        }
        updatedProduct.quantity -= movement.quantity;
    }
    
    await updateProductInStore(product.id, { 
        quantity: updatedProduct.quantity,
        unitPrice: movement.actual_unit_price,
    });
  };

  const handleEditLog = async (updatedLog: any) => {
    await updateStockLogInStore(updatedLog.id, updatedLog);
  };

  const openEditDialog = (log: StockLog) => {
    setSelectedLog(log);
    setIsEditDialogOpen(true);
  };
  
  const openViewDialog = (log: StockLog) => {
    setSelectedLog(log);
    setIsViewDialogOpen(true);
  };

  const formatCurrency = (amount: number) => {
    if(typeof amount !== 'number') return 'TZS 0.00';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS' }).format(amount).replace('TZS', 'TZS ');
  }
  
  const dailySummary = useMemo(() => {
    const selectedDateStr = table.getColumn('date')?.getFilterValue() as string | undefined;
    const currentLogs = selectedDateStr ? logs.filter(log => log.date === selectedDateStr) : logs;
    
    const summary = currentLogs.reduce((acc, log) => {
      const price = Number(log.price) || 0;
      const quantity = Number(log.quantity) || 0;
      if (log.type === 'Stock In') {
        acc.stockedIn.items += quantity;
        acc.stockedIn.value += price;
      } else {
        acc.stockedOut.items += quantity;
        acc.stockedOut.value += price;
      }
      return acc;
    }, { stockedIn: { items: 0, value: 0 }, stockedOut: { items: 0, value: 0 } });
    
    return summary;
  }, [logs, columnFilters]);

  const totalStockValue = useMemo(() => {
    return products.reduce((sum, p) => sum + p.quantity * p.unitPrice, 0);
  }, [products]);


  const columns: ColumnDef<StockLog>[] = useMemo(() => [
      {
          id: 'select',
          header: ({ table } ) => (
              <Checkbox
                  checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && 'indeterminate')}
                  onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                  aria-label="Select all"
              />
          ),
          cell: ({ row } ) => (
              <Checkbox
                  checked={row.getIsSelected()}
                  onCheckedChange={(value) => row.toggleSelected(!!value)}
                  aria-label="Select row"
              />
          ),
          enableSorting: false,
          enableHiding: false,
      },
      { accessorKey: 'id', header: 'Stock Issue ID' },
      { accessorKey: 'productName', header: 'Product' },
      { accessorKey: 'type', header: 'Type' },
      { accessorKey: 'quantity', header: 'Quantity', cell: (info) => <div className="text-right">{info.getValue() as number}</div> },
      { accessorKey: 'price', header: 'Price (TZS)', cell: (info) => <div className="text-right">{formatCurrency(info.getValue() as number)}</div> },
      { accessorKey: 'reason', header: 'Reason' },
      { accessorKey: 'date', header: 'Date' },
      { accessorKey: 'status', header: 'Status' },
      {
          id: 'actions',
          cell: ({ row } ) => (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button aria-haspopup="true" size="icon" variant="ghost">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Toggle menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => openViewDialog(row.original)}>View Details</DropdownMenuItem>
                <DropdownMenuItem onClick={() => openEditDialog(row.original)}>Edit</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ),
      },
  ], []);
  
  const table = useReactTable({
      data: logs,
      columns,
      state: {
          sorting,
          columnVisibility,
          rowSelection,
          columnFilters,
          globalFilter,
      },
      enableRowSelection: true,
      onRowSelectionChange: setRowSelection,
      onSortingChange: setSorting,
      onColumnFiltersChange: setColumnFilters,
      onGlobalFilterChange: setGlobalFilter,
      onColumnVisibilityChange: setColumnVisibility,
      getCoreRowModel: getCoreRowModel(),
      getFilteredRowModel: getFilteredRowModel(),
      getSortedRowModel: getSortedRowModel(),
      getPaginationRowModel: getPaginationRowModel(),
  });
  
  const handleDateFilterChange = (date: Date | undefined) => {
      const dateString = date ? format(date, "yyyy-MM-dd") : undefined;
      // When date is selected, clear other filters
      if (dateString) {
        setColumnFilters([{ id: 'date', value: dateString }]);
        setGlobalFilter(''); // Clear global search
      } else {
        setColumnFilters([]); // Clear all filters
      }
      table.resetRowSelection();
  };
  
  useEffect(() => {
    const selectedDate = columnFilters.find(f => f.id === 'date')?.value as string;
    table.setPagination(selectedDate ? false : { pageIndex: 0, pageSize: 10 });
  }, [columnFilters, table]);

  const handleTransferSelected = async () => {
    if (!newTransferDate) {
        toast({
            variant: "destructive",
            title: "No Date Selected",
            description: "Please select a date to transfer the logs to.",
        });
        return;
    }

    setIsTransferring(true);
    const selectedRows = table.getFilteredSelectedRowModel().rows;
    const newDate = format(newTransferDate, 'yyyy-MM-dd');
    
    try {
        const updatePromises = selectedRows.map(row => 
            updateStockLogInStore(row.original.id, { date: newDate })
        );
        await Promise.all(updatePromises);
        
        toast({
            title: "Transfer Successful",
            description: `${selectedRows.length} log(s) have been moved to ${format(newTransferDate, 'PPP')}.`,
        });

        table.resetRowSelection();
        setIsTransferDialogOpen(false);
        await refreshLogs();
        handleDateFilterChange(newTransferDate);

    } catch (error) {
        toast({
            variant: "destructive",
            title: "Transfer Failed",
            description: "An error occurred while transferring the logs.",
        });
    } finally {
        setIsTransferring(false);
    }
  };


  return (
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="flex items-center">
          <h1 className="font-headline text-2xl font-bold">Stock Movement Logs</h1>
          <div className="ml-auto flex items-center gap-2">
             <Button size="sm" variant="outline" className="h-9 gap-1" onClick={() => handleOpenLogDialog('Stock Out')}>
                <MinusCircle className="h-3.5 w-3.5" />
                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                    Log Stock Out
                </span>
            </Button>
            <Button size="sm" className="h-9 gap-1" onClick={() => handleOpenLogDialog('Stock In')}>
              <PlusCircle className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                Log Stock In
              </span>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-3">
             <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Stocked In</CardTitle>
                    <ArrowDown className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(dailySummary.stockedIn.value)}</div>
                    <p className="text-xs text-muted-foreground">
                        {dailySummary.stockedIn.items} items received
                    </p>
                </CardContent>
            </Card>
             <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Stocked Out</CardTitle>
                    <ArrowUp className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(dailySummary.stockedOut.value)}</div>
                    <p className="text-xs text-muted-foreground">
                        {dailySummary.stockedOut.items} items issued
                    </p>
                </CardContent>
            </Card>
             <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Stock Value</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(totalStockValue)}</div>
                    <p className="text-xs text-muted-foreground">
                        Current value of all products
                    </p>
                </CardContent>
            </Card>
        </div>


        <Card>
          <CardHeader>
            <CardTitle>Movement History</CardTitle>
            <CardDescription>
              {table.getColumn('date')?.getFilterValue() ? `Showing stock movements for ${format(parseISO(table.getColumn('date')?.getFilterValue() as string), "MMMM dd, yyyy")}` : 'Track all inventory coming in and going out.'}
            </CardDescription>
          </CardHeader>
          <div className="p-6 pt-0 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="relative flex-1 md:grow-0">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder="Search all logs..."
                      value={globalFilter}
                      onChange={(event) => {
                          setGlobalFilter(event.target.value);
                          // Clear date filter when searching globally
                          if (event.target.value) {
                             table.getColumn('date')?.setFilterValue(undefined);
                          }
                      }}
                      className="w-full rounded-lg bg-background pl-8 md:w-[200px] lg:w-[320px]"
                    />
                </div>
                <Popover>
                    <PopoverTrigger asChild>
                    <Button
                        variant={"outline"}
                        className={cn(
                        "w-[240px] justify-start text-left font-normal h-9",
                        !table.getColumn('date')?.getFilterValue() && "text-muted-foreground"
                        )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {table.getColumn('date')?.getFilterValue() ? format(parseISO(table.getColumn('date')?.getFilterValue() as string), "PPP") : <span>Pick a date</span>}
                    </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                        mode="single"
                        selected={table.getColumn('date')?.getFilterValue() ? parseISO(table.getColumn('date')?.getFilterValue() as string) : undefined}
                        onSelect={(date) => handleDateFilterChange(date)}
                        initialFocus
                    />
                    </PopoverContent>
                </Popover>
              </div>
              <div>
                {table.getFilteredSelectedRowModel().rows.length > 0 && (
                     <Button size="sm" onClick={() => setIsTransferDialogOpen(true)}>
                        <MoveRight className="mr-2 h-4 w-4" />
                        Transfer {table.getFilteredSelectedRowModel().rows.length} Selected
                    </Button>
                )}
              </div>
          </div>
          <CardContent>
            {loading ? (
                <p>Loading stock logs...</p>
            ) : (
            <div className="relative w-full overflow-auto">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map(headerGroup => (
                      <TableRow key={headerGroup.id}>
                          {headerGroup.headers.map(header => (
                              <TableHead key={header.id}>
                                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                              </TableHead>
                          ))}
                      </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.map(row => (
                    <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                      {row.getVisibleCells().map(cell => (
                          <TableCell key={cell.id}>
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            )}
          </CardContent>
           {!table.getColumn('date')?.getFilterValue() && (
                <div className="flex justify-end items-center space-x-2 p-4">
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
            )}
        </Card>
      
      <LogStockMovementDialog
        isOpen={isLogDialogOpen}
        setIsOpen={setIsLogDialogOpen}
        logType={logType}
        onLogMovement={handleLogMovement}
        products={products}
      />
      {selectedLog && (
        <EditStockLogDialog
            isOpen={isEditDialogOpen}
            setIsOpen={setIsEditDialogOpen}
            log={selectedLog}
            onEditLog={handleEditLog}
            products={products}
        />
      )}
      {selectedLog && (
        <ViewStockLogDialog
            isOpen={isViewDialogOpen}
            setIsOpen={setIsViewDialogOpen}
            log={selectedLog}
        />
      )}
       <Dialog open={isTransferDialogOpen} onOpenChange={setIsTransferDialogOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Transfer Stock Logs</DialogTitle>
                    <DialogDescription>
                        Select a new date to move the selected {table.getFilteredSelectedRowModel().rows.length} log(s) to.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 flex justify-center">
                    <Calendar
                        mode="single"
                        selected={newTransferDate}
                        onSelect={setNewTransferDate}
                        initialFocus
                    />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsTransferDialogOpen(false)} disabled={isTransferring}>Cancel</Button>
                    <Button onClick={handleTransferSelected} disabled={isTransferring}>
                        {isTransferring && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Confirm Transfer
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </main>
  );
}



    