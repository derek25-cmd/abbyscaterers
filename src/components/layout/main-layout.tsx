
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
    Home, 
    BookOpen, 
    UtensilsCrossed, 
    ClipboardSignature, 
    ClipboardList, 
    ChefHat, 
    FileText,
    Users,
    Settings,
    Bell,
    DollarSign,
    Menu as MenuIcon,
    Calculator,
    Briefcase,
    LayoutDashboard,
    Package,
    History,
    Truck,
    CalendarCheck,
    CreditCard
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

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/orders", label: "Orders", icon: BookOpen },
  { href: "/recipes", label: "Recipes", icon: ClipboardSignature },
  { href: "/ingredients", label: "Ingredients", icon: ClipboardList },
  { href: "/equipment", label: "Inventory", icon: ChefHat },
  { href: "/invoicing/proforma-invoices", label: "Proforma Invoices", icon: FileText },
  { href: "/invoicing/invoices", label: "Final Invoices", icon: FileText },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/costing", label: "Costing", icon: Calculator },
  { href: "/hr-ops/dashboard", label: "HR & Operations", icon: Briefcase },
];


const managementItems = [
    { href: "#", label: "Finances", icon: DollarSign },
    { href: "/reports", label: "Reports", icon: BarChart3 },
    { href: "#", label: "Settings", icon: Settings }
];

function UserProfile() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src="https://placehold.co/100x100.png" alt="User avatar" data-ai-hint="user avatar" />
            <AvatarFallback>AL</AvatarFallback>
          </Avatar>
           <div className="text-left hidden md:block">
              <p className="text-sm font-medium leading-none">Abby's Legendary</p>
              <p className="text-xs leading-none text-muted-foreground">Admin</p>
            </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">Abby's Legendary</p>
            <p className="text-xs leading-none text-muted-foreground">
              admin@abbyscatering.com
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Profile</DropdownMenuItem>
        <DropdownMenuItem>Settings</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Log out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function LayoutContentWrapper({ children, currentPathname }: { children: React.ReactNode; currentPathname: string }) {
  const { open } = useSidebar();

  if (currentPathname.startsWith('/hr-ops') || currentPathname.startsWith('/hr/') || currentPathname.startsWith('/operations/')) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar collapsible="icon">
        <SidebarHeader>
             <div className="flex items-center gap-2.5">
               <div className="h-9 w-9 rounded-lg bg-gradient-primary flex items-center justify-center shadow-lg">
                 <ChefHat className="h-5 w-5 text-primary-foreground" />
               </div>
                {open && (
                  <div>
                     <h1 className="text-lg font-bold text-foreground">CaterSmart</h1>
                 </div>
                )}
             </div>
        </SidebarHeader>
        <SidebarContent>
            <SidebarMenu>
                {navItems.map((item) => (
                  <SidebarMenuItem key={item.label}>
                      <Link href={item.href}>
                        <SidebarMenuButton 
                            isActive={item.href === '/' ? currentPathname === item.href : currentPathname.startsWith(item.href)}
                            tooltip={{ children: item.label, side: "right" }}
                        >
                            <item.icon />
                           {open && <span>{item.label}</span>}
                        </SidebarMenuButton>
                      </Link>
                  </SidebarMenuItem>
                ))}
            </SidebarMenu>
        </SidebarContent>
         <SidebarFooter>
            <SidebarMenu>
                {managementItems.map((item) => (
                    <SidebarMenuItem key={item.label}>
                       <Link href={item.href}>
                        <SidebarMenuButton 
                          variant="ghost" 
                          isActive={false} 
                          tooltip={{children: item.label, side: 'right'}}
                        >
                           <item.icon />
                           {open && <span>{item.label}</span>}
                         </SidebarMenuButton>
                      </Link>
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
          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-muted/40">
            {children}
          </main>
      </div>
    </div>
  );
}

export function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname(); 

  return (
    <SidebarProvider defaultOpen> 
      <LayoutContentWrapper currentPathname={pathname}> 
        {children}
      </LayoutContentWrapper>
    </SidebarProvider>
  );
}
