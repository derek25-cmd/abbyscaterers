
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
import { format, parseISO } from "date-fns";
import { Badge } from "../ui/badge";

type BookingWithClient = Booking & { clientName: string };

export const getBookingColumns = (
  onDelete: (bookingId: string) => void
): ColumnDef<BookingWithClient>[] => [
  {
    accessorKey: "name",
    header: "Booking Name",
  },
  {
    accessorKey: "clientName",
    header: "Client",
  },
  {
    accessorKey: "start_date",
    header: "Start Date",
    cell: ({ row }) => format(parseISO(row.getValue("start_date")), "PPP"),
  },
  {
    accessorKey: "end_date",
    header: "End Date",
    cell: ({ row }) => format(parseISO(row.getValue("end_date")), "PPP"),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
        const status = row.getValue("status") as string;
        return <Badge variant={status === 'active' ? 'default' : 'secondary'}>{status}</Badge>
    }
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
              <Link href={`/bookings/${booking.id}`} className="cursor-pointer">
                <Eye className="mr-2 h-4 w-4" /> View Details
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/bookings/${booking.id}/edit`} className="cursor-pointer">
                <Edit className="mr-2 h-4 w-4" /> Edit Booking
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(booking.id)}
              className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
            >
              <Trash2 className="mr-2 h-4 w-4" /> Delete Booking
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
