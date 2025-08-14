import type { ReactNode } from "react";
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarFooter, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { SidebarNav } from "./sidebar-nav";
import { Building } from "lucide-react";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-2 p-2">
            <Building className="w-8 h-8 text-primary" />
            <h1 className="text-xl font-semibold font-headline">CaterEase</h1>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarNav />
        </SidebarContent>
        <SidebarFooter>
          {/* Footer content if any */}
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-30 flex items-center h-14 gap-4 border-b bg-background/80 backdrop-blur-sm px-4 md:px-6">
            <div className="md:hidden">
              <SidebarTrigger />
            </div>
            <div className="flex-1">
              {/* Header content like search or breadcrumbs can go here */}
            </div>
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
