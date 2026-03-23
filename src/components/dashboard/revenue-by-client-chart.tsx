"use client";

import * as React from "react";
import { 
  Bar, 
  BarChart, 
  CartesianGrid, 
  XAxis, 
  YAxis, 
  ResponsiveContainer, 
  Tooltip, 
  Cell,
  LabelList
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Invoice, Client } from "@/types";
import { motion } from "framer-motion";

interface RevenueByClientChartProps {
  invoices: Invoice[];
  clients: Client[];
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: 'TZS',
    maximumFractionDigits: 0
  }).format(amount).replace('TZS', 'Tsh');
};

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
        client: clients.find((c) => c.id === clientId)?.companyName || "Unknown Client",
        revenue,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [invoices, clients]);

  if (chartData.length === 0) {
    return (
      <Card className="h-full flex flex-col justify-center items-center text-center p-6 border-dashed border-2">
        <div className="p-4 bg-muted rounded-full mb-4">
          <CardTitle className="text-muted-foreground text-sm uppercase tracking-wider">Financial Data Empty</CardTitle>
        </div>
        <CardDescription>Generate final invoices to visualize your top performers.</CardDescription>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6 }}
      className="h-full"
    >
      <Card className="overflow-hidden shadow-elegant border-primary/10 h-full flex flex-col">
        <CardHeader className="bg-muted/10 border-b pb-4">
          <CardTitle className="text-xl font-bold text-primary text-center">Top Performing Clients</CardTitle>
          <CardDescription className="text-center">Billed revenue concentration (Top 5)</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 pt-8 pb-4 min-h-[350px]">
          <div className="h-full w-full flex justify-center items-center">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={chartData}
                margin={{
                  top: 5,
                  right: 120,
                  left: 20,
                  bottom: 5,
                }}
                barSize={32}
              >
                <CartesianGrid horizontal={false} strokeDasharray="3 3" opacity={0.2} />
                <XAxis type="number" hide />
                <YAxis
                  dataKey="client"
                  type="category"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                  fontSize={12}
                  fontWeight={600}
                  width={140}
                />
                <Tooltip
                  cursor={{ fill: 'hsl(var(--primary) / 0.05)' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-popover border border-border p-3 rounded-lg shadow-xl">
                          <p className="text-xs font-bold text-popover-foreground mb-1 uppercase tracking-tight">{payload[0].payload.client}</p>
                          <p className="text-sm font-mono font-bold text-primary">
                            {formatCurrency(payload[0].value as number)}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar 
                  dataKey="revenue" 
                  radius={[0, 6, 6, 0]}
                  animationDuration={1500}
                >
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={index === 0 ? 'hsl(var(--primary))' : `hsl(var(--primary) / ${0.8 - index * 0.12})`} 
                    />
                  ))}
                  <LabelList 
                    dataKey="revenue" 
                    position="right" 
                    formatter={formatCurrency}
                    style={{ fontSize: '12px', fontWeight: 'bold', fill: 'hsl(var(--primary))' }}
                    offset={12}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
