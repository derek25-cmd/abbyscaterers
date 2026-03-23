
"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
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
import { Invoice, Client } from "@/types";

const chartConfig = {
  revenue: {
    label: "Total Revenue",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

interface RevenueByClientChartProps {
  invoices: Invoice[];
  clients: Client[];
}

export function RevenueByClientChart({ invoices, clients }: RevenueByClientChartProps) {
  const chartData = React.useMemo(() => {
    const revenueMap = new Map<string, number>();

    invoices.forEach((inv) => {
      if (!inv.clientId) return;
      
      const subtotal = inv.items.reduce((sum, item) => sum + (item.total || 0), 0);
      const totalForDays = inv.multiplyByDays ? subtotal * (inv.numberOfDays || 1) : subtotal;
      const totalBeforeVAT = totalForDays + (inv.serviceCharge || 0) + (inv.transportCosts || 0);
      const vat = inv.vatType === 'exclusive' ? totalBeforeVAT * 0.18 : 0;
      const grandTotal = totalBeforeVAT + vat;

      revenueMap.set(inv.clientId, (revenueMap.get(inv.clientId) || 0) + grandTotal);
    });

    return Array.from(revenueMap.entries())
      .map(([clientId, revenue]) => ({
        client: clients.find((c) => c.id === clientId)?.companyName || "Unknown",
        revenue,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5); // Top 5 clients
  }, [invoices, clients]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Clients by Revenue</CardTitle>
        <CardDescription>Based on generated final invoices.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-64">
          <BarChart
            layout="vertical"
            data={chartData}
            margin={{
              left: 40,
            }}
          >
            <CartesianGrid horizontal={false} />
            <YAxis
              dataKey="client"
              type="category"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              fontSize={12}
            />
            <XAxis type="number" hide />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <Bar dataKey="revenue" fill="var(--color-revenue)" radius={5} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
