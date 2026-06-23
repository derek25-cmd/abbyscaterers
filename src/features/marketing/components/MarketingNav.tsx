"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LayoutDashboard, Building2, GitBranch, ClipboardList, Users, Map, BarChart2, UserCheck, FileText, Wallet, NotebookPen, Target } from "lucide-react";
import { NotificationBell } from "./ui/NotificationBell";
import { usePendingApplications } from "../hooks/useMarketingQuery";

const marketingNavItems = [
  { href: "/marketing/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/marketing/companies", label: "Companies", icon: Building2 },
  { href: "/marketing/pipeline", label: "Pipeline", icon: GitBranch },
  { href: "/marketing/quotations", label: "Quotations", icon: FileText },
  { href: "/marketing/followups", label: "Follow-ups", icon: ClipboardList },
  { href: "/marketing/daily-reports", label: "Daily Reports", icon: NotebookPen },
  { href: "/marketing/commissions", label: "Commissions", icon: Wallet },
  { href: "/marketing/targets", label: "Targets", icon: Target },
  { href: "/marketing/marketers", label: "Marketers", icon: Users },
  { href: "/marketing/applications", label: "Applications", icon: UserCheck },
  { href: "/marketing/map", label: "Map", icon: Map },
  { href: "/marketing/reports", label: "Reports", icon: BarChart2 },
];

export function MarketingNav() {
  const pathname = usePathname();
  const { data: applications } = usePendingApplications();
  const pendingCount = applications?.length ?? 0;

  return (
    <div className="MarketingNav flex items-center justify-between gap-2 border-b pb-2">
      <div className="flex items-center space-x-2 overflow-x-auto">
        {marketingNavItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Button
              key={item.href}
              variant={isActive ? "secondary" : "ghost"}
              asChild
              className="shrink-0 font-semibold"
            >
              <Link href={item.href} className="flex items-center gap-2">
                <item.icon className="h-4 w-4" />
                {item.label}
                {item.href === "/marketing/applications" && pendingCount > 0 && (
                  <Badge className="h-5 min-w-5 justify-center rounded-full bg-destructive p-0 text-[10px] text-destructive-foreground">
                    {pendingCount}
                  </Badge>
                )}
              </Link>
            </Button>
          );
        })}
      </div>
      <NotificationBell />
    </div>
  );
}
