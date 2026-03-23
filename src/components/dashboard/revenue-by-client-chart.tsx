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

    // Factual calculation of revenue from all final invoices
    invoices.forEach((inv) => {
      if (!inv.clientId) return;
      
      const subtotal = inv.items.reduce((sum, item) => sum + (item.total || 0), 0);
      const totalForDays = inv.multiplyByDays ? subtotal * (inv.numberOfDays || 1) : subtotal;
      const totalBeforeVAT = totalForDays + (inv.serviceCharge || 0) + (inv.transportCosts || 0);
      
      // VAT logic: 18% if exclusive, 0 if inclusive (already part of unit price)
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
      .slice(0, 5); // Focus on Top 5 for clarity
  }, [invoices, clients]);

  if (chartData.length === 0) {
    return (
      <Card className="h-full flex flex-col justify-center items-center text-center p-6 border-dashed">
        <div className="p-4 bg-muted rounded-full mb-4">
          <CardTitle className="text-muted-foreground text-sm">No Revenue Data</CardTitle>
        </div>
        <CardDescription>Generate final invoices to see your top performing clients here.</CardDescription>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="overflow-hidden shadow-elegant border-primary/10">
        <CardHeader className="bg-muted/10 border-b pb-4">
          <CardTitle className="text-xl font-bold text-primary">Top Performing Clients</CardTitle>
          <CardDescription>Billed revenue concentration (Top 5)</CardDescription>
        </CardHeader>
        <CardContent className="pt-8 pb-4">
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={chartData}
                margin={{
                  top: 5,
                  right: 100, // Extra space for labels
                  left: 20,
                  bottom: 5,
                }}
                barSize={32}
              >
                <CartesianGrid horizontal={false} strokeDasharray="3 3" opacity={0.3} />
                <XAxis type="number" hide />
                <YAxis
                  dataKey="client"
                  type="category"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                  fontSize={13}
                  fontWeight={600}
                  width={140}
                />
                <Tooltip
                  cursor={{ fill: 'transparent' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-popover border border-border p-3 rounded-lg shadow-xl">
                          <p className="text-sm font-bold text-popover-foreground mb-1">{payload[0].payload.client}</p>
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
                  radius={[0, 4, 4, 0]}
                  animationDuration={1500}
                >
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={index === 0 ? 'hsl(var(--primary))' : `hsl(var(--primary) / ${0.9 - index * 0.15})`} 
                    />
                  ))}
                  <LabelList 
                    dataKey="revenue" 
                    position="right" 
                    formatter={formatCurrency}
                    style={{ fontSize: '12px', fontWeight: 'bold', fill: 'hsl(var(--primary))' }}
                    offset={10}
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