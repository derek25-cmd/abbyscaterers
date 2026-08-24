
"use client";

import * as React from "react";
import { Label, Pie, PieChart, Tooltip, Cell } from "recharts";
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
      { status: "available", count: assets.filter(a => a.status === 'Available').length, fill: "hsl(142, 71%, 45%)" },
      { status: "inUse", count: assets.filter(a => a.status === 'In Use').length, fill: "hsl(var(--primary))" },
      { status: "maintenance", count: assets.filter(a => a.status === 'Under Maintenance').length, fill: "hsl(0, 84.2%, 60.2%)" },
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
                <CardDescription className="pb-4 text-center">Fleet & Equipment Readiness</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex justify-center items-center pb-6 min-h-[300px]">
                <div className="w-full aspect-square max-h-[280px]">
                    <ChartContainer config={chartConfig} className="w-full h-full">
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
                                cx="50%"
                                cy="50%"
                            >
                                {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                ))}
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
                                                        className="fill-muted-foreground text-[10px] font-semibold uppercase tracking-widest"
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
                </div>
            </CardContent>
        </Card>
    </motion.div>
  );
}
