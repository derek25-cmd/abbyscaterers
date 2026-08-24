
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
import { PlusCircle, Loader2, CalendarIcon, X } from "lucide-react";
import { getBookingColumns } from "./columns";
import { useBookingStorage } from "@/hooks/use-booking-storage";
import { useClientStorage } from "@/hooks/use-client-storage";
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
import { AddBookingDialog } from "./add-booking-dialog";
import type { BookingFormData } from "@/lib/schemas";
import { startOfMonth, endOfMonth, areIntervalsOverlapping, parseISO } from "date-fns";
import { DatePicker } from "../ui/date-picker";

export function BookingListTable() {
  const { bookings, isLoading: bookingsLoading, addBooking, deleteBooking } = useBookingStorage();
  const { clients, isLoading: clientsLoading, getClientById } = useClientStorage();
  const { toast } = useToast();

  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});
  const [itemToDelete, setItemToDelete] = React.useState<string | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
  const [selectedMonth, setSelectedMonth] = React.useState<Date>(new Date());

  const filteredBookings = React.useMemo(() => {
    if (!selectedMonth) {
      return bookings;
    }
    const monthStart = startOfMonth(selectedMonth);
    const monthEnd = endOfMonth(selectedMonth);

    return bookings.filter(booking => {
      try {
        const bookingStart = parseISO(booking.start_date);
        const bookingEnd = parseISO(booking.end_date);
        return areIntervalsOverlapping(
          { start: bookingStart, end: bookingEnd },
          { start: monthStart, end: monthEnd }
        );
      } catch (error) {
        return false; // Invalid date format in booking data
      }
    });
  }, [bookings, selectedMonth]);

  const tableData = React.useMemo(() => {
    return filteredBookings.map(booking => ({
      ...booking,
      clientName: getClientById(booking.client_id)?.companyName || "Unknown Client"
    }));
  }, [filteredBookings, getClientById]);


  const handleDeleteRequest = React.useCallback((bookingId: string) => {
    setItemToDelete(bookingId);
  }, []);

  const confirmDelete = React.useCallback(async () => {
    if (itemToDelete) {
      const success = await deleteBooking(itemToDelete);
      if (success) {
        toast({ title: "Booking Deleted", description: "The booking contract has been successfully deleted." });
      } else {
        toast({ variant: "destructive", title: "Error", description: "Failed to delete the booking." });
      }
      setItemToDelete(null);
    }
  }, [itemToDelete, deleteBooking, toast]);

  const handleAddBooking = async (data: BookingFormData) => {
    try {
      await addBooking(data);
      toast({ title: "Booking Added", description: "The new booking has been successfully created." });
      setIsAddDialogOpen(false);
    } catch(error: any) {
       toast({ variant: "destructive", title: "Error", description: error.message || "Failed to add booking." });
    }
  };

  const columns = React.useMemo(() => getBookingColumns(handleDeleteRequest), [handleDeleteRequest]);

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

  const isLoading = bookingsLoading || clientsLoading;

  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="mr-2 h-8 w-8 animate-spin" />Loading bookings...</div>;
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
            <Input
              placeholder="Filter by booking name..."
              value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                table.getColumn("name")?.setFilterValue(event.target.value)
              }
              className="max-w-sm"
            />
            <DatePicker
                selectedDate={selectedMonth}
                onDateChange={setSelectedMonth}
                labelFormat="MMMM yyyy"
                isMonthPicker
            />
            {selectedMonth && (
                <Button variant="ghost" size="sm" onClick={() => setSelectedMonth(null as any)}>
                    <X className="h-4 w-4 mr-1"/>Show All
                </Button>
            )}
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          New Booking
        </Button>
      </div>
      <div className="rounded-md border shadow-sm bg-card">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No bookings found for the selected month.
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
      <AddBookingDialog
        isOpen={isAddDialogOpen}
        setIsOpen={setIsAddDialogOpen}
        clients={clients}
        onAddBooking={handleAddBooking}
      />
      <AlertDialog open={!!itemToDelete} onOpenChange={(open: boolean) => !open && setItemToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. This will permanently delete the booking and all associated daily orders.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setItemToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
