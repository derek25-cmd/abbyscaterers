'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import {
  LayoutDashboard,
  FileText,
  Receipt,
  Percent,
  Calculator,
  BarChart3,
  Bell,
  ShieldAlert,
  Users,
  ChefHat,
} from 'lucide-react';
import type { PortalRole } from '@abbyscaterers/types';
import { usePortalRole } from '@/lib/portal-role';
import { useKeyboardAwareScroll } from '@/hooks/use-keyboard-aware-scroll';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { OfflineBanner } from '@/components/pwa/offline-banner';
import { BottomTabBar } from '@/components/pwa/bottom-tab-bar';
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
} from '@/components/ui/sidebar';

const navItems: { href: string; label: string; icon: typeof LayoutDashboard }[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/rfqs', label: 'RFQs', icon: FileText },
  { href: '/invoices', label: 'Invoices', icon: Receipt },
  { href: '/costing', label: 'Costing', icon: Calculator },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/notifications', label: 'Notifications', icon: Bell },
];

// Mirrors catering-system's managementItems (Reports/Settings in its
// sidebar footer) — role-gated admin functions separated from day-to-day
// operational nav.
const managementItems: { href: string; label: string; icon: typeof LayoutDashboard; roles: PortalRole[] }[] = [
  { href: '/tax-settings', label: 'Tax Settings', icon: Percent, roles: ['super_admin', 'finance'] },
  { href: '/audit-log', label: 'Audit Log', icon: ShieldAlert, roles: ['super_admin'] },
  { href: '/users', label: 'Users', icon: Users, roles: ['super_admin'] },
];

function NavLink({ href, label, icon: Icon, pathname }: { href: string; label: string; icon: typeof LayoutDashboard; pathname: string }) {
  const { open } = useSidebar();
  const isActive = pathname.startsWith(href);
  return (
    <SidebarMenuItem>
      <Link href={href}>
        <SidebarMenuButton isActive={isActive} tooltip={{ children: label, side: 'right' }}>
          <Icon />
          {open && <span>{label}</span>}
        </SidebarMenuButton>
      </Link>
    </SidebarMenuItem>
  );
}

function SidebarLogo() {
  const { open } = useSidebar();
  return (
    <div className="flex items-center gap-2.5 p-2">
      {open ? (
        <Image src="/logo.png" alt="Abby's Catersmart" width={150} height={40} style={{ mixBlendMode: 'darken' }} />
      ) : (
        <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center shadow-lg">
          <ChefHat className="h-5 w-5 text-primary-foreground" />
        </div>
      )}
    </div>
  );
}

function LayoutContentWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { role, isActive, loading } = usePortalRole();
  const visibleManagementItems = managementItems.filter((item) => role && item.roles.includes(role));
  useKeyboardAwareScroll();

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar collapsible="icon" variant="inset">
        <SidebarHeader>
          <SidebarLogo />
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {navItems.map((item) => (
              <NavLink key={item.href} {...item} pathname={pathname} />
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            {visibleManagementItems.map((item) => (
              <NavLink key={item.href} {...item} pathname={pathname} />
            ))}
          </SidebarMenu>
          {!loading && !isActive && (
            <div className="m-2 rounded-md bg-destructive/10 p-3 text-xs text-destructive">
              Your account isn&apos;t provisioned for portal access yet. Ask a super admin to add you in Users.
            </div>
          )}
        </SidebarFooter>
      </Sidebar>
      <div className="flex-1 flex flex-col overflow-hidden" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <OfflineBanner />
        <header className="h-16 border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-30 shrink-0">
          <div className="h-full px-4 sm:px-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="hidden md:flex" />
              <div className="h-4 w-px bg-border mx-1 hidden sm:block" />
              <span className="text-sm text-muted-foreground hidden sm:inline">{role ? `Role: ${role}` : ''}</span>
              <span className="text-base font-semibold text-foreground sm:hidden">Abby&apos;s Admin</span>
            </div>
            <div className="flex items-center gap-2">
              <NotificationBell />
              <UserButton afterSignOutUrl="/sign-in" />
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 pb-20 md:pb-6 lg:pb-8 bg-muted/20">{children}</main>
        <BottomTabBar />
      </div>
    </div>
  );
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider defaultOpen>
      <LayoutContentWrapper>{children}</LayoutContentWrapper>
    </SidebarProvider>
  );
}
