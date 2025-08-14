"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton
} from "@/components/ui/sidebar";

const mainNav = [
  {
    href: "/hr-ops/dashboard",
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
      <div className="p-2">
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
      </div>

      <div className="p-2">
        <p className="px-2 py-1 text-xs font-semibold text-muted-foreground">Operations</p>
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
      </div>

      <div className="p-2">
        <p className="px-2 py-1 text-xs font-semibold text-muted-foreground">Human Resources</p>
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
      </div>
    </div>
  );
}
