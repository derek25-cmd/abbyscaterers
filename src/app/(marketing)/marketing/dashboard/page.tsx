"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Flame, X } from "lucide-react";
import { KpiCards, KpiCardsSkeleton } from "@/features/marketing/components/cards/KpiCards";
import { FollowUpFeed } from "@/features/marketing/components/cards/FollowUpFeed";
import { LiveActivityFeed } from "@/features/marketing/components/cards/LiveActivityFeed";
import { MyPerformanceCard } from "@/features/marketing/components/cards/MyPerformanceCard";
import { PipelineFunnelChart } from "@/features/marketing/components/charts/PipelineFunnelChart";
import { MarketerLeaderboard } from "@/features/marketing/components/tables/MarketerLeaderboard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useDashboardData } from "@/features/marketing/hooks/useMarketingQuery";

interface HotLeadAlert {
  companyId: string;
  companyName: string;
  score: number;
}

export default function MarketingDashboardPage() {
  const { data, isLoading } = useDashboardData();
  const [hotLead, setHotLead] = useState<HotLeadAlert | null>(null);

  useEffect(() => {
    if (!hotLead) return;
    const timer = setTimeout(() => setHotLead(null), 30_000);
    return () => clearTimeout(timer);
  }, [hotLead]);

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <KpiCardsSkeleton />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {hotLead && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-primary bg-warning/10 p-3">
          <div className="flex items-center gap-2 text-sm">
            <Flame className="h-4 w-4 text-warning" />
            <span>
              Hot lead detected: <span className="font-semibold">{hotLead.companyName}</span> scored {hotLead.score}/100.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href={`/marketing/companies/${hotLead.companyId}`}>View Company →</Link>
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setHotLead(null)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      <KpiCards kpis={data.kpis} />

      <div className="grid gap-6 lg:grid-cols-2">
        <PipelineFunnelChart data={data.pipeline} />
        <FollowUpFeed followUps={data.followUps} />
      </div>

      {data.role === "MARKETER" ? (
        <MyPerformanceCard data={data.myPerformance} />
      ) : (
        <MarketerLeaderboard rows={data.leaderboard} />
      )}

      <LiveActivityFeed onHotLead={(companyName, score, companyId) => setHotLead({ companyId, companyName, score })} />
    </div>
  );
}
