"use client";

import { KpiCards, KpiCardsSkeleton } from "@/features/marketing/components/cards/KpiCards";
import { FollowUpFeed } from "@/features/marketing/components/cards/FollowUpFeed";
import { PipelineFunnelChart } from "@/features/marketing/components/charts/PipelineFunnelChart";
import { MarketerLeaderboard } from "@/features/marketing/components/tables/MarketerLeaderboard";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardData } from "@/features/marketing/hooks/useMarketingQuery";

export default function MarketingDashboardPage() {
  const { data, isLoading } = useDashboardData();

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
      <KpiCards kpis={data.kpis} />

      <div className="grid gap-6 lg:grid-cols-2">
        <PipelineFunnelChart data={data.pipeline} />
        <FollowUpFeed followUps={data.followUps} />
      </div>

      <MarketerLeaderboard rows={data.leaderboard} />
    </div>
  );
}
