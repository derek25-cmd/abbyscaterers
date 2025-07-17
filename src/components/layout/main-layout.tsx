
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
    BarChart3,
    Settings,
    Bell,
    DollarSign
} from "lucide-react"; 
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
  SidebarMenuSub,
  SidebarMenuSubButton,
  useSidebar,
  SidebarMenuSubItem
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

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/daily-menus", label: "Bookings", icon: BookOpen },
  { 
    label: "Menu / Food Costing", 
    icon: UtensilsCrossed,
    subItems: [
      { href: "/recipes", label: "Recipes", icon: ClipboardSignature },
      { href: "/ingredients", label: "Ingredients", icon: ClipboardList }
    ]
  },
  { href: "/equipment", label: "Inventory", icon: ChefHat },
  { 
    label: "Invoicing", 
    icon: FileText,
    subItems: [
      { href: "/invoicing/proforma-invoices", label: "Proforma Invoice" },
      { href: "/invoicing/invoices", label: "Final Invoices" }
    ]
  },
  { href: "/clients", label: "Clients", icon: Users },
];

const managementItems = [
    { href: "#", label: "Finances", icon: DollarSign },
    { href: "#", label: "Reports", icon: BarChart3 },
    { href: "#", label: "Settings", icon: Settings }
];


function UserProfile() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <Avatar className="h-9 w-9">
            <AvatarImage src="https://placehold.co/100x100.png" alt="User avatar" data-ai-hint="user avatar" />
            <AvatarFallback>AL</AvatarFallback>
          </Avatar>
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

  return (
    <>
      <Sidebar className="border-r bg-sidebar shadow-card">
        <SidebarContent className="gap-6 p-4">
            <div className="px-2 pb-2">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-8 w-8 rounded-lg bg-gradient-primary flex items-center justify-center">
                    <span className="text-white font-bold text-sm">CS</span>
                  </div>
                   {!open ? null : (
                     <div>
                        <h1 className="text-lg font-bold text-foreground">CaterSmart</h1>
                        <p className="text-xs text-muted-foreground">Catering Management</p>
                    </div>
                   )}
                </div>
            </div>
            <SidebarMenu>
                {navItems.map((item) => (
                  <SidebarMenuItem key={item.label}>
                    {item.subItems ? (
                      <>
                         <SidebarMenuButton
                            isActive={item.subItems.some(sub => currentPathname.startsWith(sub.href))}
                            tooltip={{ children: item.label, side: "right" }}
                          >
                           <item.icon />
                           <span>{item.label}</span>
                         </SidebarMenuButton>
                         <SidebarMenuSub>
                            {item.subItems.map(subItem => (
                               <SidebarMenuSubItem key={subItem.href}>
                                 <Link href={subItem.href} passHref>
                                   <SidebarMenuSubButton asChild isActive={currentPathname.startsWith(subItem.href)}>
                                     <a>{subItem.label}</a>
                                   </SidebarMenuSubButton>
                                 </Link>
                               </SidebarMenuSubItem>
                            ))}
                         </SidebarMenuSub>
                      </>
                    ) : (
                       <SidebarMenuButton
                          href={item.href || "#"}
                          isActive={item.href ? currentPathname.startsWith(item.href) : false}
                          tooltip={{ children: item.label, side: "right" }}
                        >
                          <item.icon />
                          <span>{item.label}</span>
                      </SidebarMenuButton>
                    )}
                  </SidebarMenuItem>
                ))}
            </SidebarMenu>
            <SidebarMenu>
                {managementItems.map((item) => (
                    <SidebarMenuItem key={item.label}>
                        <SidebarMenuButton href={item.href} isActive={false} tooltip={{children: item.label, side: 'right'}}>
                            <item.icon />
                            <span>{item.label}</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                ))}
            </SidebarMenu>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <header className="h-16 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-30">
            <div className="h-full px-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <SidebarTrigger />
              </div>
              
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-4 w-4" />
                  <span className="absolute -top-1 -right-1 h-2 w-2 bg-primary rounded-full"></span>
                </Button>
                <UserProfile />
              </div>
            </div>
          </header>
        <main className="flex-1 p-4 md:p-6 lg:p-8 bg-muted/20 min-h-0">
          {children}
        </main>
      </SidebarInset>
    </>
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