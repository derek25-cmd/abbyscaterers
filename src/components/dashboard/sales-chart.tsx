"use client"

import * as React from "react"
import { Line, LineChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts"
import { format, startOfWeek, startOfMonth, startOfYear, parseISO } from "date-fns"
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

type TimeUnit = "daily" | "weekly" | "monthly" | "yearly"

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
        const date = parseISO(event.date)
        const saleAmount = event.unitPrice * event.numberOfPeople

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

  const Chart = (
    <ResponsiveContainer width="100%" height="100%">
        <LineChart
            data={salesData}
            margin={{ left: 10, right: 10, top: 10, bottom: 10 }}
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
                stroke="var(--color-sales)"
                strokeWidth={3}
                dot={{ fill: 'var(--color-sales)', r: 4 }}
                activeDot={{ r: 6 }}
            />
        </LineChart>
    </ResponsiveContainer>
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
                        <Button size="xs" variant={timeUnit === 'weekly' ? 'secondary' : 'ghost'} className="h-7 px-2 text-[10px]" onClick={() => setTimeUnit('weekly')}>W</Button>
                        <Button size="xs" variant={timeUnit === 'monthly' ? 'secondary' : 'ghost'} className="h-7 px-2 text-[10px]" onClick={() => setTimeUnit('monthly')}>M</Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex-1 pt-6 min-h-[250px] flex justify-center items-center">
                {Chart}
            </CardContent>
            <ChartDialog
                isOpen={isDialogOpen}
                setIsOpen={setIsDialogOpen}
                title="Sales Trend Details"
                description={`Visual analysis of sales grouped by ${timeUnit}.`}
                chartConfig={chartConfig}
            >
                {Chart}
            </ChartDialog>
        </Card>
    </motion.div>
  )
}
