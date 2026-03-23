
"use client";

import * as React from "react";
import { Label, Pie, PieChart } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Asset } from "@/types";

const chartConfig = {
  count: {
    label: "Assets",
  },
  available: {
    label: "Available",
    color: "hsl(var(--success))",
  },
  inUse: {
    label: "In Use",
    color: "hsl(var(--primary))",
  },
  maintenance: {
    label: "Maintenance",
    color: "hsl(var(--destructive))",
  },
} satisfies ChartConfig;

interface AssetStatusChartProps {
  assets: Asset[];
}

export function AssetStatusChart({ assets }: AssetStatusChartProps) {
  const chartData = React.useMemo(() => {
    return [
      { status: "available", count: assets.filter(a => a.status === 'Available').length, fill: "var(--color-available)" },
      { status: "inUse", count: assets.filter(a => a.status === 'In Use').length, fill: "var(--color-inUse)" },
      { status: "maintenance", count: assets.filter(a => a.status === 'Under Maintenance').length, fill: "var(--color-maintenance)" },
    ];
  }, [assets]);

  const totalAssets = React.useMemo(() => {
    return chartData.reduce((acc, curr) => acc + curr.count, 0);
  }, [chartData]);

  return (
    <Card className="flex flex-col">
      <CardHeader className="items-center pb-0">
        <CardTitle>Asset Logistics Status</CardTitle>
        <CardDescription>Current availability of fleet & equipment</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square max-h-[250px]"
        >
          <PieChart>
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <Pie
              data={chartData}
              dataKey="count"
              nameKey="status"
              innerRadius={60}
              strokeWidth={5}
            >
              <Label
                content={({ viewBox }) => {
                  if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                    return (
                      <text
                        x={viewBox.cx}
                        y={viewBox.cy}
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        <tspan
                          x={viewBox.cx}
                          y={viewBox.cy}
                          className="fill-foreground text-3xl font-bold"
                        >
                          {totalAssets}
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 24}
                          className="fill-muted-foreground"
                        >
                          Total Assets
                        </tspan>
                      </text>
                    );
                  }
                }}
              />
            </Pie>
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
