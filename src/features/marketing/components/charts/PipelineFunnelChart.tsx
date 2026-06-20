"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PackageOpen } from "lucide-react";
import { getStageMeta } from "../../utils/pipeline";
import type { PipelineFunnelStage } from "../../types";

export function PipelineFunnelChart({ data }: { data: PipelineFunnelStage[] }) {
  const hasData = data.some((stage) => stage.count > 0);

  const chartData = data.map((stage) => ({
    stage: getStageMeta(stage.stage).label,
    count: stage.count,
  }));

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>Pipeline Funnel</CardTitle>
        <CardDescription>Prospect distribution across the sales pipeline.</CardDescription>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
              <XAxis type="number" allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis type="category" dataKey="stage" width={140} stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  borderColor: "hsl(var(--border))",
                  borderRadius: "var(--radius)",
                }}
              />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-[300px] flex-col items-center justify-center gap-2 text-muted-foreground">
            <PackageOpen className="h-8 w-8" />
            <p className="text-sm">No pipeline data yet</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
