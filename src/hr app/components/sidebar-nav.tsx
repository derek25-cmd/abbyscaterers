"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { 
  Box, 
  Briefcase, 
  ClipboardList, 
  LayoutDashboard, 
  Truck, 
  Users,
  CalendarCheck,
  Package,
  History,
  CreditCard,
} from "lucide-react";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton
} from "./ui/sidebar";

const mainNav = [
  {
    href: "/",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
];

const operationsNav = [
  {
    href: "/operations/inventory",
    label: "Product Catalog",
    icon: Package,
  },
  {
    href: "/operations/stock-logs",
    label: "Stock Logs",
    icon: History,
  },
  {
    href: "/operations/assets",
    label: "Asset Management",
    icon: Truck,
  },
  {
    href: "/operations/issuance",
    label: "Daily Issuance",
    icon: ClipboardList,
  },
];

const hrNav = [
  {
    href: "/hr/employees",
    label: "Employee Records",
    icon: Users,
  },
  {
    href: "/hr/attendance",
    label: "Attendance",
    icon: CalendarCheck,
  },
  {
    href: "/hr/recruitment",
    label: "Recruitment",
    icon: Briefcase,
  },
  {
    href: "/hr/payroll",
    label: "Payroll",
    icon: CreditCard,
  }
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <div className="flex flex-col gap-2">
      <SidebarGroup>
        <SidebarMenu>
          {mainNav.map((item) => (
            <SidebarMenuItem key={item.href}>
              <Link href={item.href}>
                <SidebarMenuButton isActive={pathname === item.href}>
                  <item.icon />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroup>

      <SidebarGroup>
        <SidebarGroupLabel>Operations</SidebarGroupLabel>
        <SidebarMenu>
          {operationsNav.map((item) => (
            <SidebarMenuItem key={item.href}>
              <Link href={item.href}>
                <SidebarMenuButton isActive={pathname.startsWith(item.href)}>
                  <item.icon />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroup>

      <SidebarGroup>
        <SidebarGroupLabel>Human Resources</SidebarGroupLabel>
        <SidebarMenu>
          {hrNav.map((item) => (
            <SidebarMenuItem key={item.href}>
              <Link href={item.href}>
                <SidebarMenuButton isActive={pathname.startsWith(item.href)}>
                  <item.icon />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroup>
    </div>
  );
}
