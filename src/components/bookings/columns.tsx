
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
import type { Booking } from "@/types";
import { format, parseISO, isValid } from 'date-fns';
import { Badge } from "../ui/badge";

type BookingWithClientName = Booking & { clientName: string };

export const getBookingColumns = (
  onDelete: (bookingId: string) => void
): ColumnDef<BookingWithClientName>[] => [
  {
    accessorKey: "name",
    header: "Booking Name",
    cell: ({ row }) => {
        const booking = row.original;
        return (
            <Link href={`/bookings/${booking.id}`} className="font-medium text-primary hover:underline">
                {row.getValue("name")}
            </Link>
        )
    },
  },
  {
    accessorKey: "clientName",
    header: "Client",
    cell: ({ row }) => <div className="font-medium">{row.getValue("clientName")}</div>,
  },
  {
    accessorKey: "start_date",
    header: "Start Date",
    cell: ({ row }) => {
      const date = parseISO(row.getValue("start_date"));
      return isValid(date) ? format(date, 'PPP') : 'N/A';
    },
  },
  {
    accessorKey: "end_date",
    header: "End Date",
    cell: ({ row }) => {
      const date = parseISO(row.getValue("end_date"));
      return isValid(date) ? format(date, 'PPP') : 'N/A';
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      const variant = status === 'active' ? 'default' : status === 'closed' ? 'secondary' : 'outline';
      return <Badge variant={variant} className="capitalize">{status}</Badge>;
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const booking = row.original;
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
              <Link href={`/bookings/${booking.id}`} className="flex items-center cursor-pointer">
                <Eye className="mr-2 h-4 w-4" /> View Details
              </Link>
            </DropdownMenuItem>
            {/* Edit might be complex, could be a future feature */}
            {/* <DropdownMenuItem asChild>
              <Link href={`/bookings/${booking.id}/edit`} className="flex items-center cursor-pointer">
                <Edit className="mr-2 h-4 w-4" /> Edit Booking
              </Link>
            </DropdownMenuItem> */}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(booking.id)}
              className="text-destructive focus:text-destructive focus:bg-destructive/10 flex items-center cursor-pointer"
            >
              <Trash2 className="mr-2 h-4 w-4" /> Delete Booking
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
