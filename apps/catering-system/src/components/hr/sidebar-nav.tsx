
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Briefcase, 
  ClipboardList, 
  LayoutDashboard, 
  Truck, 
  Users,
  CalendarCheck,
  Package,
  History,
  CreditCard,
  GraduationCap,
  ScrollText,
  CalendarDays,
  FileText,
  UserPlus
} from "lucide-react";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton
} from "@/components/ui/sidebar";
import { useSidebar } from "@/components/ui/sidebar";
import { useStaffRole } from "@/hooks/use-staff-role";
import { isHrModuleOn, useHrModules } from "@/lib/hr-modules";


const mainNav = [
  {
    href: "/dashboard",
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
    href: "/hr/leave",
    label: "Leave",
    icon: CalendarDays,
  },
  {
    href: "/hr/training",
    label: "Staff Training",
    icon: GraduationCap,
  },
  {
    href: "/hr/payroll",
    label: "Payroll",
    icon: CreditCard,
  }
];

// Letters, templates and the reference-number register: HR roles only
// (hr.manage). The pages and the database enforce it too.
const candidatesNavItem = {
  href: "/hr/candidates",
  label: "Candidates",
  icon: UserPlus,
};

const documentsNavItem = {
  href: "/hr/documents",
  label: "HR Documents",
  icon: FileText,
};

// Visible only to roles with the audit.view permission (hr_manager,
// general_manager, admin); the page and the audit_log RLS enforce it too.
const auditNavItem = {
  href: "/hr/audit-trail",
  label: "Audit Trail",
  icon: ScrollText,
};

export function SidebarNav() {
  const pathname = usePathname();
  const { open } = useSidebar();
  const { can } = useStaffRole();
  // HR module switch: hidden modules drop out of the menu (pages say "Not available yet").
  const modules = useHrModules();
  const on = (m: Parameters<typeof isHrModuleOn>[1]) => !!modules && isHrModuleOn(modules, m);
  const visibleHrNav = [
    ...hrNav.filter((item) => item.href !== '/hr/leave' || on('leave')),
    ...(can('hr.manage') && on('candidates') ? [candidatesNavItem] : []),
    ...(can('hr.manage') && on('documents') ? [documentsNavItem] : []),
    ...(can('audit.view') && on('audit') ? [auditNavItem] : []),
  ];

  return (
    <div className="flex flex-col gap-2">
      <div className="p-2">
        <SidebarMenu>
          {mainNav.map((item) => (
            <SidebarMenuItem key={item.href}>
              <Link href={item.href}>
                <SidebarMenuButton isActive={pathname === item.href} tooltip={{children: item.label, side: 'right'}}>
                  <item.icon />
                  {open && <span>{item.label}</span>}
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </div>

      <div className="p-2">
        {open && <p className="px-2 py-1 text-xs font-semibold text-muted-foreground">Operations</p>}
        <SidebarMenu>
          {operationsNav.map((item) => (
            <SidebarMenuItem key={item.href}>
              <Link href={item.href}>
                <SidebarMenuButton isActive={pathname.startsWith(item.href)} tooltip={{children: item.label, side: 'right'}}>
                  <item.icon />
                  {open && <span>{item.label}</span>}
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </div>

      <div className="p-2">
        {open && <p className="px-2 py-1 text-xs font-semibold text-muted-foreground">Human Resources</p>}
        <SidebarMenu>
          {visibleHrNav.map((item) => (
            <SidebarMenuItem key={item.href}>
              <Link href={item.href}>
                <SidebarMenuButton isActive={pathname.startsWith(item.href)} tooltip={{children: item.label, side: 'right'}}>
                  <item.icon />
                  {open && <span>{item.label}</span>}
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </div>
    </div>
  );
}
