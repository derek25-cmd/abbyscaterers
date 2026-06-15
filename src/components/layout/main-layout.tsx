
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { 
    Home, 
    BookOpen, 
    ClipboardSignature, 
    ClipboardList, 
    ChefHat, 
    FileText,
    Users,
    Settings,
    Bell,
    DollarSign,
    Calculator,
    Briefcase,
    Package,
    History,
    Truck,
    CalendarCheck,
    CreditCard,
    ChevronDown,
    LogOut,
    BookCopy,
    CalendarClock,
    Utensils,
    ListPlus,
    Banknote,
    ArrowLeft,
    RefreshCw,
    GraduationCap
} from "lucide-react"; 
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BarChart3 } from "lucide-react";
import React, { useEffect, useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { PrivateRoute } from "./private-route";
import { UpdateBanner } from "./update-banner";


const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/orders", label: "Single Orders", icon: BookOpen },
  { href: "/bookings", label: "Bookings", icon: CalendarClock },
  { href: "/delivery-notes", label: "Delivery Notes", icon: Truck },
  { href: "/recipes", label: "Recipes", icon: ClipboardSignature },
  { href: "/menu-costing", label: "Menu Costing", icon: Calculator },
  { href: "/equipment", label: "Inventory", icon: ChefHat },
  { 
    label: "Invoicing", 
    icon: FileText,
    subItems: [
        { href: "/invoicing/proforma-invoices", label: "Proforma Invoices", icon: FileText },
        { href: "/invoicing/invoices", label: "Final Invoices", icon: FileText },
    ]
  },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/costing", label: "Costing", icon: Calculator },
  { href: "/finances", label: "Finances", icon: Banknote },
  { 
    label: "HR & Operations", 
    icon: Briefcase,
    subItems: [
        { href: "/hr/employees", label: "Employees", icon: Users },
        { href: "/hr/attendance", label: "Attendance", icon: CalendarCheck },
        { href: "/hr/payroll", label: "Payroll", icon: CreditCard },
        { href: "/hr/training", label: "Staff Training", icon: GraduationCap },
        { href: "/operations/inventory", label: "Product Catalog", icon: Package },
        { href: "/operations/stock-logs", label: "Stock Logs", icon: History },
        { href: "/operations/assets", label: "Asset Management", icon: Truck },
        { href: "/operations/issuance", label: "Daily Issuance", icon: ClipboardList },
    ]
  },
];


const managementItems = [
    { href: "/reports", label: "Reports", icon: BarChart3 },
    { href: "/settings", label: "Settings", icon: Settings }
];

function UserProfile() {
    const { user, logout } = useAuth();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user?.user_metadata.avatar_url} alt={user?.user_metadata.name} />
            <AvatarFallback>{user?.email?.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
           <div className="text-left hidden md:block">
              <p className="text-sm font-medium leading-none">{user?.user_metadata.name}</p>
              <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
            </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user?.user_metadata.name}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user?.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Profile</DropdownMenuItem>
        <DropdownMenuItem>Settings</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout}>
            <LogOut className="mr-2 h-4 w-4" />
            <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NavItem({ item, currentPathname }: { item: {href?: string, label: string, icon: React.ElementType, subItems?: any[]}, currentPathname: string }) {
    const { open } = useSidebar();
    const [isSubMenuOpen, setIsSubMenuOpen] = useState(false);
    
    const isParentActive = item.subItems?.some(sub => currentPathname.startsWith(sub.href)) || (item.href && currentPathname.startsWith(item.href)) || false;


    useEffect(() => {
        if (isParentActive) {
            setIsSubMenuOpen(true);
        }
    }, [isParentActive]);


    if (item.subItems) {
        return (
            <Collapsible open={isSubMenuOpen} onOpenChange={setIsSubMenuOpen}>
                <CollapsibleTrigger asChild>
                    <SidebarMenuButton 
                        isActive={isParentActive}
                        tooltip={{ children: item.label, side: "right" }}
                        className="w-full justify-between"
                    >
                        <div className="flex items-center gap-2">
                            <item.icon />
                            {open && <span>{item.label}</span>}
                        </div>
                        {open && <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isSubMenuOpen ? 'rotate-180' : ''}`} />}
                    </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <SidebarMenu>
                        {item.subItems.map((subItem: any) => (
                             <SidebarMenuItem key={subItem.href}>
                                <Link href={subItem.href}>
                                    <SidebarMenuButton isActive={currentPathname.startsWith(subItem.href)}>
                                        <subItem.icon />
                                        {open && <span>{subItem.label}</span>}
                                    </SidebarMenuButton>
                                </Link>
                             </SidebarMenuItem>
                        ))}
                    </SidebarMenu>
                </CollapsibleContent>
            </Collapsible>
        )
    }

    return (
        <Link href={item.href || ''}>
            <SidebarMenuButton 
                isActive={item.href === '/' ? currentPathname === item.href : (item.href ? currentPathname.startsWith(item.href) : false)}
                tooltip={{ children: item.label, side: "right" }}
            >
                <item.icon />
                {open && <span>{item.label}</span>}
            </SidebarMenuButton>
        </Link>
    )
}


function LayoutContentWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { open } = useSidebar();

  if (pathname === '/login') {
    return <main className="w-full">{children}</main>;
  }

  return (
    <div className="flex h-full w-full overflow-hidden">
      <Sidebar collapsible="icon" variant="inset">
        <SidebarHeader>
             <div className="flex items-center gap-2.5 p-2">
                {open ? (
                  <Image src="/logo.png" alt="Abby's Catersmart" width={150} height={40} style={{ mixBlendMode: 'darken' }} />
                ) : (
                  <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center shadow-lg">
                    <ChefHat className="h-5 w-5 text-primary-foreground" />
                  </div>
                )}
             </div>
        </SidebarHeader>
        <SidebarContent>
            <SidebarMenu>
                {navItems.map((item) => (
                  <SidebarMenuItem key={item.label}>
                      <NavItem item={item} currentPathname={pathname} />
                  </SidebarMenuItem>
                ))}
            </SidebarMenu>
        </SidebarContent>
         <SidebarFooter>
            <SidebarMenu>
                {managementItems.map((item) => (
                    <SidebarMenuItem key={item.label}>
                       <NavItem item={item} currentPathname={pathname} />
                    </SidebarMenuItem>
                ))}
            </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <div className="flex-1 flex flex-col overflow-hidden">
          <header className="h-16 border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-30 shrink-0">
              <div className="h-full px-4 sm:px-6 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <SidebarTrigger />
                  <div className="h-4 w-px bg-border mx-1 hidden sm:block" />
                  <Button variant="ghost" size="sm" onClick={() => router.back()} className="h-9 px-2 font-bold text-muted-foreground hover:text-primary transition-colors hidden sm:flex">
                    <ArrowLeft className="mr-2 h-4 w-4" /> BACK
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => window.location.reload()} className="h-9 px-2 font-bold text-muted-foreground hover:text-primary transition-colors hidden sm:flex">
                    <RefreshCw className="mr-2 h-4 w-4" /> REFRESH
                  </Button>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5" />
                    <span className="absolute top-2 right-2 h-2 w-2 bg-primary rounded-full animate-pulse"></span>
                  </Button>
                  <UserProfile />
                </div>
              </div>
            </header>
          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-muted/20">
            <PrivateRoute>
                {children}
            </PrivateRoute>
          </main>
      </div>
    </div>
  );
}

export function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <UpdateBanner />
      <div className="flex-1 overflow-hidden">
        <SidebarProvider defaultOpen>
          <LayoutContentWrapper>
            {children}
          </LayoutContentWrapper>
        </SidebarProvider>
      </div>
    </div>
  );
}
