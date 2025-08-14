
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
    href: "/hr-ops/inventory",
    label: "Product Catalog",
    icon: Package,
  },
  {
    href: "/hr-ops/stock-logs",
    label: "Stock Logs",
    icon: History,
  },
  {
    href: "/hr-ops/assets",
    label: "Asset Management",
    icon: Truck,
  },
  {
    href: "/hr-ops/issuance",
    label: "Daily Issuance",
    icon: ClipboardList,
  },
];

const hrNav = [
  {
    href: "/hr-ops/hr/employees",
    label: "Employee Records",
    icon: Users,
  },
  {
    href: "/hr-ops/hr/attendance",
    label: "Attendance",
    icon: CalendarCheck,
  },
  {
    href: "/hr-ops/hr/recruitment",
    label: "Recruitment",
    icon: Briefcase,
  },
  {
    href: "/hr-ops/hr/payroll",
    label: "Payroll",
    icon: CreditCard,
  }
];

export function SidebarNav() {
  const pathname = usePathname();

  const renderNavGroup = (items: typeof mainNav, label: string) => (
    <div className="space-y-2">
      <p className="px-4 text-sm font-semibold text-muted-foreground">{label}</p>
      <SidebarMenu>
        {items.map((item) => (
          <SidebarMenuItem key={item.href}>
            <Link href={item.href}>
              <SidebarMenuButton isActive={pathname.startsWith(item.href)}>
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {renderNavGroup(mainNav, "Main")}
      {renderNavGroup(operationsNav, "Operations")}
      {renderNavGroup(hrNav, "Human Resources")}
    </div>
  );
}
