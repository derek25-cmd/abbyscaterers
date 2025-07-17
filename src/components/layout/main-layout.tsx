
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, UtensilsCrossed, ChefHat, ClipboardList, ClipboardSignature, BookOpen, FileText as InvoiceIcon, Home, BarChart, Settings, Banknote } from "lucide-react"; 
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
  useSidebar,
  SidebarMenuSub,
  SidebarMenuSubButton,
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
    icon: InvoiceIcon,
    subItems: [
      { href: "/proforma-invoices", label: "Proforma Invoice" },
      { href: "/invoices", label: "Final Invoices" }
    ]
  },
  { href: "/finances", label: "Finances", icon: Banknote },
  { href: "/reports", label: "Reports", icon: BarChart },
  { href: "/settings", label: "Settings", icon: Settings },
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
            <p className="text-sm font-medium leading-none">Abby&apos;s Legendary</p>
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
      <Sidebar className="border-r" collapsible="icon">
        <SidebarHeader className="p-4">
          <Link href="/" className="flex items-center gap-2">
            <UtensilsCrossed className={`h-8 w-8 text-primary transition-all ${open ? "" : "mx-auto"}`} />
            <span className={`font-semibold text-lg ${open ? "opacity-100" : "opacity-0"} transition-opacity duration-300`}>
              CaterSmart
            </span>
          </Link>
        </SidebarHeader>
        <SidebarContent className="p-2">
          <SidebarMenu>
            {navItems.map((item) => (
              <SidebarMenuItem key={item.label}>
                {item.subItems ? (
                  <>
                     <SidebarMenuButton
                        isActive={item.subItems.some(sub => currentPathname.startsWith(sub.href))}
                        tooltip={{ children: item.label, side: "right" }}
                        asChild={false} // Important: This is a trigger, not a link
                      >
                       <item.icon />
                       <span>{item.label}</span>
                     </SidebarMenuButton>
                     <SidebarMenuSub>
                        {item.subItems.map(subItem => (
                           <SidebarMenuSubItem key={subItem.href}>
                             <Link href={subItem.href}>
                               <SidebarMenuSubButton isActive={currentPathname.startsWith(subItem.href)}>
                                 {subItem.label}
                               </SidebarMenuSubButton>
                             </Link>
                           </SidebarMenuSubItem>
                        ))}
                     </SidebarMenuSub>
                  </>
                ) : (
                  <Link href={item.href || "#"}>
                    <SidebarMenuButton
                      isActive={item.href ? currentPathname.startsWith(item.href) : false}
                      tooltip={{ children: item.label, side: "right" }}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </Link>
                )}
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="p-4">
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 backdrop-blur-sm px-4 md:px-6">
          <SidebarTrigger className="md:hidden" />
          <div className="flex-1">
          </div>
          <UserProfile />
        </header>
        <main className="flex-1 p-4 md:p-6 lg:p-8">
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
