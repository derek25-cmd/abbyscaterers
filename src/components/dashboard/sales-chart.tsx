
"use client"

import * as React from "react"
import { Line, LineChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { format, startOfWeek, startOfMonth, startOfYear, parseISO } from "date-fns"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { useOrderStorage } from "@/hooks/use-order-storage"
import { Button } from "@/components/ui/button"

type TimeUnit = "daily" | "weekly" | "monthly" | "yearly"

const chartConfig = {
  sales: {
    label: "Sales",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig

export function SalesChart() {
  const { orders, isLoading } = useOrderStorage()
  const [timeUnit, setTimeUnit] = React.useState<TimeUnit>("monthly")

  const salesData = React.useMemo(() => {
    if (!orders) return []

    const dataMap = new Map<string, number>()

    orders.forEach(order => {
      order.clientEvents.forEach(event => {
        const date = parseISO(event.date)
        const saleAmount = event.unitPrice * event.numberOfPeople

        let key: string
        switch (timeUnit) {
          case "daily":
            key = format(date, "yyyy-MM-dd")
            break
          case "weekly":
            key = format(startOfWeek(date), "yyyy-MM-dd")
            break
          case "monthly":
            key = format(startOfMonth(date), "yyyy-MM")
            break
          case "yearly":
            key = format(startOfYear(date), "yyyy")
            break
        }

        dataMap.set(key, (dataMap.get(key) || 0) + saleAmount)
      })
    })
    
    const sortedData = Array.from(dataMap.entries())
        .map(([date, sales]) => ({ date, sales }))
        .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
    // Format date for display
    return sortedData.map(item => {
        let displayDate = item.date;
        const dateObj = parseISO(item.date);
        switch (timeUnit) {
            case "daily":
                displayDate = format(dateObj, 'MMM d');
                break;
            case "weekly":
                displayDate = `W/C ${format(dateObj, 'MMM d')}`;
                break;
            case "monthly":
                displayDate = format(dateObj, 'MMM yyyy');
                break;
            case "yearly":
                 displayDate = format(dateObj, 'yyyy');
                break;
        }
        return { ...item, date: displayDate };
    });

  }, [orders, timeUnit])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sales Overview</CardTitle>
        <CardDescription>
          Showing total sales {timeUnit}.
        </CardDescription>
        <div className="flex gap-2 pt-2">
            <Button size="sm" variant={timeUnit === 'daily' ? 'secondary' : 'ghost'} onClick={() => setTimeUnit('daily')}>Daily</Button>
            <Button size="sm" variant={timeUnit === 'weekly' ? 'secondary' : 'ghost'} onClick={() => setTimeUnit('weekly')}>Weekly</Button>
            <Button size="sm" variant={timeUnit === 'monthly' ? 'secondary' : 'ghost'} onClick={() => setTimeUnit('monthly')}>Monthly</Button>
            <Button size="sm" variant={timeUnit === 'yearly' ? 'secondary' : 'ghost'} onClick={() => setTimeUnit('yearly')}>Yearly</Button>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <LineChart
            accessibilityLayer
            data={salesData}
            margin={{
              left: 12,
              right: 12,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => value}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => `Tsh ${Number(value).toLocaleString()}`}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  indicator="dot"
                  formatter={(value) => `Tsh ${Number(value).toLocaleString()}`}
                />
              }
            />
            <Line
              dataKey="sales"
              type="monotone"
              stroke="var(--color-sales)"
              strokeWidth={2}
              dot={true}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
