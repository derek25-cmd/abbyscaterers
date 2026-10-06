'use client';

import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';

const countChartConfig: ChartConfig = { count: { label: 'Count', color: 'hsl(var(--primary))' } };
const revenueChartConfig: ChartConfig = { revenue: { label: 'Revenue (TZS)', color: 'hsl(var(--primary))' } };

interface StatusDatum {
  status: string;
  count: number;
}

// Lazy-loaded via next/dynamic from dashboard-content.tsx — recharts is
// the single biggest dependency in admin-portal's bundle and only the
// Dashboard needs it, so it shouldn't be part of the route's initial JS.
export function DashboardCharts({
  revenueTrendData,
  rfqStatusData,
  proformaStatusData,
  invoiceStatusData,
}: {
  revenueTrendData: { label: string; revenue: number }[];
  rfqStatusData: StatusDatum[];
  proformaStatusData: StatusDatum[];
  invoiceStatusData: StatusDatum[];
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Revenue Trend (last 6 months)</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={revenueChartConfig}>
            <LineChart data={revenueTrendData} margin={{ left: 12, right: 12 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} width={40} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line type="monotone" dataKey="revenue" stroke="var(--color-revenue)" strokeWidth={2} dot={false} />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">RFQ Status Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={countChartConfig}>
            <BarChart data={rfqStatusData} layout="vertical" margin={{ left: 12, right: 12 }}>
              <CartesianGrid horizontal={false} />
              <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis dataKey="status" type="category" tickLine={false} axisLine={false} width={100} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill="var(--color-count)" radius={4} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Proforma Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={countChartConfig}>
            <BarChart data={proformaStatusData} layout="vertical" margin={{ left: 12, right: 12 }}>
              <CartesianGrid horizontal={false} />
              <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis dataKey="status" type="category" tickLine={false} axisLine={false} width={100} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill="var(--color-count)" radius={4} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invoice Status Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={countChartConfig}>
            <BarChart data={invoiceStatusData} layout="vertical" margin={{ left: 12, right: 12 }}>
              <CartesianGrid horizontal={false} />
              <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis dataKey="status" type="category" tickLine={false} axisLine={false} width={100} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill="var(--color-count)" radius={4} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
