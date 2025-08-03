
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
import type { Employee } from "@/types";
import { Badge } from "@/components/ui/badge";

export const getEmployeeColumns = (
  onDelete: (employeeId: string) => void
): ColumnDef<Employee>[] => [
  {
    accessorKey: "employeeId",
    header: "Employee ID",
    cell: ({ row }) => <div className="font-mono text-xs">{row.getValue("employeeId")}</div>,
  },
  {
    accessorKey: "fullName",
    header: "Full Name",
    cell: ({ row }) => <div className="font-medium">{row.getValue("fullName")}</div>,
  },
  {
    accessorKey: "position",
    header: "Position",
    cell: ({ row }) => <Badge variant="secondary">{row.getValue("position")}</Badge>,
  },
  {
    accessorKey: "department",
    header: "Department",
    cell: ({ row }) => <div className="capitalize">{row.getValue("department")}</div>,
  },
  {
    accessorKey: "employmentType",
    header: "Type",
    cell: ({ row }) => <div className="capitalize">{row.getValue("employmentType")}</div>,
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const employee = row.original;
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
              <Link href={`/hr/${employee.employeeId}/edit`} className="flex items-center cursor-pointer">
                <Edit className="mr-2 h-4 w-4" /> Edit Employee
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(employee.employeeId)}
              className="text-destructive focus:text-destructive focus:bg-destructive/10 flex items-center cursor-pointer"
            >
              <Trash2 className="mr-2 h-4 w-4" /> Delete Employee
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
