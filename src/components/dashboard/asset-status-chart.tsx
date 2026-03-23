
"use client";

import * as React from "react";
import { Label, Pie, PieChart, ResponsiveContainer, Cell, Tooltip } from "recharts";
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
import { motion } from "framer-motion";

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
    <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="h-full"
    >
        <Card className="flex flex-col shadow-elegant border-primary/10 h-full">
            <CardHeader className="items-center pb-0 border-b bg-muted/10 mb-4">
                <CardTitle className="text-xl font-bold text-primary">Logistics Health</CardTitle>
                <CardDescription className="pb-4">Fleet & Equipment Readiness</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex justify-center items-center pb-6">
                <div className="w-full aspect-square max-h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Tooltip content={<ChartTooltipContent hideLabel />} />
                            <Pie
                                data={chartData}
                                dataKey="count"
                                nameKey="status"
                                innerRadius="65%"
                                outerRadius="90%"
                                stroke="hsl(var(--background))"
                                strokeWidth={4}
                                paddingAngle={2}
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
                                                        className="fill-foreground text-4xl font-bold"
                                                    >
                                                        {totalAssets}
                                                    </tspan>
                                                    <tspan
                                                        x={viewBox.cx}
                                                        y={(viewBox.cy || 0) + 28}
                                                        className="fill-muted-foreground text-xs font-semibold uppercase tracking-widest"
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
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    </motion.div>
  );
}
