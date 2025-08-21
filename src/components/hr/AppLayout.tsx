
import type { ReactNode } from "react";
import { SidebarProvider, Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarTrigger } from "@/components/ui/sidebar";
import { SidebarNav } from "./sidebar-nav";
import { Building } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { Button } from "../ui/button";

function AppLayoutContent({ children }: { children: ReactNode }) {
  const { open } = useSidebar();
  
  return (
    <>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center gap-2 p-2">
            <Building className="w-8 h-8 text-primary" />
            {open && <h1 className="text-xl font-semibold font-headline">CaterEase</h1>}
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarNav />
        </SidebarContent>
        <SidebarFooter>
          {/* Footer content if any */}
        </SidebarFooter>
      </Sidebar>
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="sticky top-0 z-30 flex items-center h-14 gap-4 border-b bg-background/80 backdrop-blur-sm px-4 md:px-6">
            <SidebarTrigger />
            <div className="flex-1">
              {/* Header content like search or breadcrumbs can go here */}
            </div>
            <Button>Logout</Button>
        </header>
        <main className="flex-1 overflow-y-auto">
            {children}
        </main>
      </div>
    </>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider defaultOpen>
      <div className="flex h-screen w-full">
        <AppLayoutContent>{children}</AppLayoutContent>
      </div>
    </SidebarProvider>
  );
}
