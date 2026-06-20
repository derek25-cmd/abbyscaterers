"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Building2, GitBranch, ClipboardList, Users, Map, BarChart2 } from "lucide-react";

const marketingNavItems = [
  { href: "/marketing/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/marketing/companies", label: "Companies", icon: Building2 },
  { href: "/marketing/pipeline", label: "Pipeline", icon: GitBranch },
  { href: "/marketing/followups", label: "Follow-ups", icon: ClipboardList },
  { href: "/marketing/marketers", label: "Marketers", icon: Users },
  { href: "/marketing/map", label: "Map", icon: Map },
  { href: "/marketing/reports", label: "Reports", icon: BarChart2 },
];

export function MarketingNav() {
  const pathname = usePathname();

  return (
    <div className="flex items-center space-x-2 border-b pb-2 overflow-x-auto">
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
            </Link>
          </Button>
        );
      })}
    </div>
  );
}
