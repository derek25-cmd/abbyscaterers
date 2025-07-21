
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
    DollarSign,
    Menu as MenuIcon,
    Calculator
} from "lucide-react"; 
import {
  SidebarProvider,
  Sidebar,
  SidebarBody,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarTrigger,
  useSidebar,
  SidebarMenuSubButton
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
  { href: "/costing", label: "Costing", icon: Calculator },
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

  return (
    <>
      <Sidebar>
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
        <SidebarBody>
            <SidebarMenu>
                {navItems.map((item) => (
                  <SidebarMenuItem key={item.label}>
                    {item.subItems ? (
                       <SidebarMenuSub
                         label={item.label}
                         icon={<item.icon />}
                         isActive={item.subItems.some(sub => currentPathname.startsWith(sub.href))}
                        >
                            {item.subItems.map(subItem => (
                               <SidebarMenuSubItem key={subItem.href}>
                                  <Link href={subItem.href} passHref>
                                    <SidebarMenuSubButton isActive={currentPathname.startsWith(subItem.href)}>
                                      {subItem.label}
                                    </SidebarMenuSubButton>
                                  </Link>
                               </SidebarMenuSubItem>
                            ))}
                         </SidebarMenuSub>
                    ) : (
                      <Link href={item.href} passHref asChild>
                        <SidebarMenuButton 
                            isActive={item.href === '/' ? currentPathname === item.href : currentPathname.startsWith(item.href)}
                            tooltip={{ children: item.label, side: "right" }}
                            icon={<item.icon />}
                            label={item.label}
                        />
                      </Link>
                    )}
                  </SidebarMenuItem>
                ))}
            </SidebarMenu>
        </SidebarBody>
         <SidebarFooter>
            <SidebarMenu>
                {managementItems.map((item) => (
                    <SidebarMenuItem key={item.label}>
                       <Link href={item.href} passHref asChild>
                        <SidebarMenuButton 
                          variant="ghost" 
                          isActive={false} 
                          tooltip={{children: item.label, side: 'right'}}
                          icon={<item.icon />}
                          label={item.label}
                        />
                      </Link>
                    </SidebarMenuItem>
                ))}
            </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <div className="flex-1">
          <header className="h-16 border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-30">
              <div className="h-full px-4 sm:px-6 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <SidebarTrigger className="md:hidden"/>
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
          <main className="flex-1 p-4 md:p-6 lg:p-8 bg-muted/40 min-h-[calc(100vh-4rem)]">
            {children}
          </main>
      </div>
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
