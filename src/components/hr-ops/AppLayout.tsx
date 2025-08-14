
"use client";

import type { ReactNode } from "react";
import { SidebarProvider, Sidebar, SidebarBody, SidebarFooter, SidebarHeader, SidebarTrigger } from "@/components/ui/sidebar";
import { SidebarNav } from "./sidebar-nav";
import { Building } from "lucide-react";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden">
        <Sidebar>
          <SidebarHeader>
            <div className="flex items-center gap-2.5 p-2">
              <div className="h-9 w-9 rounded-lg bg-gradient-primary flex items-center justify-center shadow-lg">
                <Building className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="flex flex-col">
                <h1 className="text-lg font-bold text-foreground">HR &amp; Ops</h1>
              </div>
            </div>
          </SidebarHeader>
          <SidebarBody>
            <SidebarNav />
          </SidebarBody>
          <SidebarFooter>
            {/* Can add user profile or other footer items here */}
          </SidebarFooter>
        </Sidebar>
        <div className="flex-1 flex flex-col overflow-hidden">
            <header className="h-16 border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-30 shrink-0">
                <div className="h-full px-4 sm:px-6 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <SidebarTrigger className="md:hidden"/>
                    </div>
                </div>
            </header>
            <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-muted/40">
                {children}
            </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
