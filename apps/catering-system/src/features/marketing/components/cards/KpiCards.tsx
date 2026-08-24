"use client";

import { Building2, Flame, Target, Trophy, ClipboardList } from "lucide-react";
import { StatsCard } from "@/components/dashboard/stats-card";
import { Skeleton } from "@/components/ui/skeleton";
import type { MarketingKpis } from "../../types";

export function KpiCards({ kpis }: { kpis: MarketingKpis }) {
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
      <StatsCard title="Total Companies" value={kpis.totalCompanies} icon={Building2} />
      <StatsCard title="Active Leads" value={kpis.activeLeads} icon={Target} />
      <StatsCard title="Hot Leads" value={kpis.hotLeads} icon={Flame} />
      <StatsCard title="Deals Won (This Month)" value={kpis.dealsWonThisMonth} icon={Trophy} />
      <StatsCard title="Pending Follow-ups" value={kpis.pendingFollowUps} icon={ClipboardList} />
    </div>
  );
}

export function KpiCardsSkeleton() {
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-[104px] rounded-xl" />
      ))}
    </div>
  );
}
