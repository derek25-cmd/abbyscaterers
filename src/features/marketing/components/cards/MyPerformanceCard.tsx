"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatTZS } from "../../utils/format";
import type { MarketingPerformanceSnapshot } from "../../types";

export function MyPerformanceCard({ data }: { data: MarketingPerformanceSnapshot | null }) {
  if (!data) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-sm">My Performance</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No performance snapshot yet for this month — it populates after the nightly recalculation.</p>
        </CardContent>
      </Card>
    );
  }

  const metrics = [
    { label: "Visits", value: data.total_visits },
    { label: "Verified", value: data.verified_visits },
    { label: "New Leads", value: data.new_leads },
    { label: "Hot Leads", value: data.hot_leads },
    { label: "Quotations", value: data.quotations_requested },
    { label: "Deals Won", value: data.deals_won },
    { label: "Revenue", value: formatTZS(data.revenue_generated, { compact: true }) },
    { label: "Avg Score", value: Math.round(data.avg_lead_score) },
  ];

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">My Performance ({data.month}/{data.year})</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="space-y-1">
            <p className="text-xs text-muted-foreground">{metric.label}</p>
            <p className="text-lg font-semibold">{metric.value}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
