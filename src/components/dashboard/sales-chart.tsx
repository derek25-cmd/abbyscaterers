
"use client"

import * as React from "react"
import { Line, LineChart, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts"
import { format, startOfWeek, startOfMonth, parseISO } from "date-fns"
import { motion } from "framer-motion"

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
  ChartTooltipContent,
} from "@/components/ui/chart"
import { useOrderStorage } from "@/hooks/use-order-storage"
import { Button } from "@/components/ui/button"
import { ChartDialog } from "./chart-dialog"

type TimeUnit = "daily" | "weekly" | "monthly"

const chartConfig = {
  sales: {
    label: "Sales",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig

export function SalesChart() {
  const { orders } = useOrderStorage()
  const [timeUnit, setTimeUnit] = React.useState<TimeUnit>("monthly")
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);


  const salesData = React.useMemo(() => {
    if (!orders) return []

    const dataMap = new Map<string, number>()

    orders.forEach(order => {
      order.clientEvents.forEach(event => {
        if (!event.date) return;
        const date = parseISO(event.date)
        const saleAmount = (event.unitPrice || 0) * (event.numberOfPeople || 0)

        let key: string;
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
          default:
            key = format(date, "yyyy-MM")
        }

        dataMap.set(key, (dataMap.get(key) || 0) + saleAmount)
      })
    })
    
    const sortedData = Array.from(dataMap.entries())
        .map(([date, sales]) => ({ date, sales }))
        .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
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
        }
        return { ...item, date: displayDate };
    });

  }, [orders, timeUnit])

  const renderChart = (
    <LineChart
        data={salesData}
        margin={{ left: 10, right: 10, top: 20, bottom: 10 }}
    >
        <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.2} />
        <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            fontSize={11}
        />
        <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            fontSize={11}
            tickFormatter={(value) => `${(value/1000).toFixed(0)}k`}
        />
        <Tooltip
            cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 1 }}
            content={<ChartTooltipContent indicator="dot" />}
        />
        <Line
            dataKey="sales"
            type="monotone"
            stroke="hsl(var(--primary))"
            strokeWidth={3}
            dot={{ fill: 'hsl(var(--primary))', r: 4 }}
            activeDot={{ r: 6 }}
        />
    </LineChart>
  )

  return (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="h-full"
    >
        <Card className="shadow-elegant border-primary/10 overflow-hidden h-full flex flex-col">
            <CardHeader className="bg-muted/10 border-b">
                <div className="flex justify-between items-center">
                    <div className="cursor-pointer" onClick={() => setIsDialogOpen(true)}>
                        <CardTitle className="text-xl font-bold text-primary">Sales Trend</CardTitle>
                        <CardDescription>Order value over time.</CardDescription>
                    </div>
                    <div className="flex gap-1">
                        <Button size="sm" variant={timeUnit === 'weekly' ? 'secondary' : 'ghost'} className="h-7 px-2 text-[10px]" onClick={() => setTimeUnit('weekly')}>W</Button>
                        <Button size="sm" variant={timeUnit === 'monthly' ? 'secondary' : 'ghost'} className="h-7 px-2 text-[10px]" onClick={() => setTimeUnit('monthly')}>M</Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex-1 pt-6 min-h-[300px] flex justify-center items-center">
                <ChartContainer config={chartConfig} className="h-full w-full max-w-[95%]">
                    {renderChart}
                </ChartContainer>
            </CardContent>
            <ChartDialog
                isOpen={isDialogOpen}
                setIsOpen={setIsDialogOpen}
                title="Sales Trend Details"
                description={`Visual analysis of sales grouped by ${timeUnit}.`}
                chartConfig={chartConfig}
            >
                {renderChart}
            </ChartDialog>
        </Card>
    </motion.div>
  )
}
