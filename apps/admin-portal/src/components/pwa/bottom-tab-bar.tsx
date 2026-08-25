'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useClerk } from '@clerk/nextjs';
import {
  House,
  FileText,
  ClipboardCheck,
  Bell,
  Menu,
  Receipt,
  Calculator,
  BarChart3,
  Percent,
  ShieldAlert,
  Users,
  LogOut,
} from 'lucide-react';
import type { PortalRole } from '@abbyscaterers/types';
import { usePortalRole } from '@/lib/portal-role';
import { useUnreadNotificationCount } from '@/hooks/use-unread-notification-count';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

const tabs: { href: string; label: string; icon: typeof House }[] = [
  { href: '/dashboard', label: 'Home', icon: House },
  { href: '/rfqs', label: 'RFQs', icon: FileText },
  { href: '/proformas', label: 'Proformas', icon: ClipboardCheck },
  { href: '/notifications', label: 'Notifications', icon: Bell },
];

// Everything not on the tab bar — same role-gating as the desktop sidebar's
// managementItems in (portal)/layout.tsx, kept in sync manually since this
// is a short, rarely-changing list.
const moreItems: { href: string; label: string; icon: typeof House; roles?: PortalRole[] }[] = [
  { href: '/invoices', label: 'Invoices', icon: Receipt },
  { href: '/costing', label: 'Costing', icon: Calculator },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/tax-settings', label: 'Tax Settings', icon: Percent, roles: ['super_admin', 'finance'] },
  { href: '/audit-log', label: 'Audit Log', icon: ShieldAlert, roles: ['super_admin'] },
  { href: '/users', label: 'Users', icon: Users, roles: ['super_admin'] },
];

function TabLink({ href, label, icon: Icon, active, badge }: { href: string; label: string; icon: typeof House; active: boolean; badge?: number }) {
  return (
    <Link
      href={href}
      className={cn(
        'relative flex min-h-12 min-w-12 flex-1 flex-col items-center justify-center gap-0.5 text-muted-foreground',
        active && 'text-primary'
      )}
    >
      <Icon className="h-6 w-6" />
      <span className="text-[10px] leading-none">{label}</span>
      {badge != null && badge > 0 && (
        <span className="absolute right-3 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] text-destructive-foreground">
          {badge}
        </span>
      )}
    </Link>
  );
}

export function BottomTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { role } = usePortalRole();
  const { signOut } = useClerk();
  const unreadCount = useUnreadNotificationCount();
  const [moreOpen, setMoreOpen] = useState(false);

  const visibleMoreItems = moreItems.filter((item) => !item.roles || (role && item.roles.includes(role)));
  const moreActive = visibleMoreItems.some((item) => pathname.startsWith(item.href));

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex h-14 items-stretch border-t border-border bg-background md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {tabs.map((tab) => (
          <TabLink
            key={tab.href}
            {...tab}
            active={pathname.startsWith(tab.href)}
            badge={tab.href === '/notifications' ? unreadCount : undefined}
          />
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className={cn(
            'flex min-h-12 min-w-12 flex-1 flex-col items-center justify-center gap-0.5 text-muted-foreground',
            moreActive && 'text-primary'
          )}
        >
          <Menu className="h-6 w-6" />
          <span className="text-[10px] leading-none">More</span>
        </button>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="pb-[calc(1rem+env(safe-area-inset-bottom))] md:hidden">
          <SheetHeader>
            <SheetTitle>More</SheetTitle>
          </SheetHeader>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {visibleMoreItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMoreOpen(false)}
                className="flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-lg border border-border p-3 text-center text-xs text-foreground hover:bg-muted/60"
              >
                <item.icon className="h-5 w-5 text-primary" />
                {item.label}
              </Link>
            ))}
            <button
              type="button"
              onClick={() => {
                setMoreOpen(false);
                signOut(() => router.push('/sign-in'));
              }}
              className="flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-lg border border-border p-3 text-center text-xs text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-5 w-5" />
              Sign out
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
