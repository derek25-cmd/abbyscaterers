
"use client"

import * as React from "react"
import { Bar, ComposedChart, Line, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend } from "recharts"
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
  ChartTooltipContent,
} from "@/components/ui/chart"
import { useOrderStorage } from "@/hooks/use-order-storage"
import { useStockLogStorage } from "@/hooks/use-stock-log-storage"
import { Button } from "@/components/ui/button"
import { ChartDialog } from "./chart-dialog"

type TimeUnit = "daily" | "weekly" | "monthly"

const chartConfig = {
  sales: {
    label: "Sales",
    color: "hsl(var(--primary))",
  },
  expenses: {
    label: "Expenses",
    color: "hsl(var(--destructive))",
  },
} satisfies ChartConfig

export function SalesVsExpensesChart() {
  const { orders } = useOrderStorage()
  const { logs: stockLogs } = useStockLogStorage()
  const [timeUnit, setTimeUnit] = React.useState<TimeUnit>("monthly")
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);


  const combinedData = React.useMemo(() => {
    if (!orders || !stockLogs) return []

    const dataMap = new Map<string, { sales: number, expenses: number }>()

    orders.forEach(order => {
      order.clientEvents.forEach(event => {
        if (!event.date) return;
        const date = parseISO(event.date)
        const saleAmount = (event.unitPrice || 0) * (event.numberOfPeople || 0)

        let key: string;
        switch (timeUnit) {
          case "daily": key = format(date, "yyyy-MM-dd"); break;
          case "weekly": key = format(startOfWeek(date), "yyyy-MM-dd"); break;
          case "monthly": key = format(startOfMonth(date), "yyyy-MM"); break;
          default: key = format(date, "yyyy-MM");
        }

        const current = dataMap.get(key) || { sales: 0, expenses: 0 }
        dataMap.set(key, { ...current, sales: current.sales + saleAmount })
      })
    })

    stockLogs.filter(log => log.type === 'Stock Out').forEach(log => {
      if (!log.date) return;
      const date = parseISO(log.date)
      const expenseAmount = log.price || 0

      let key: string;
       switch (timeUnit) {
          case "daily": key = format(date, "yyyy-MM-dd"); break;
          case "weekly": key = format(startOfWeek(date), "yyyy-MM-dd"); break;
          case "monthly": key = format(startOfMonth(date), "yyyy-MM"); break;
          default: key = format(date, "yyyy-MM");
        }

      const current = dataMap.get(key) || { sales: 0, expenses: 0 }
      dataMap.set(key, { ...current, expenses: current.expenses + expenseAmount })
    })

    const sortedData = Array.from(dataMap.entries())
        .map(([date, data]) => ({ date, ...data }))
        .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return sortedData.map(item => {
        let displayDate = item.date;
        const dateObj = parseISO(item.date);
        switch (timeUnit) {
            case "daily": displayDate = format(dateObj, 'MMM d'); break;
            case "weekly": displayDate = `W/C ${format(dateObj, 'MMM d')}`; break;
            case "monthly": displayDate = format(dateObj, 'MMM yyyy'); break;
            default: displayDate = format(dateObj, 'MMM yyyy');
        }
        return { ...item, date: displayDate };
    });

  }, [orders, stockLogs, timeUnit])

  const ChartContent = (
    <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
            data={combinedData}
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
                tickFormatter={(value) => `${(value/1000000).toFixed(1)}M`}
            />
            <Tooltip
                cursor={{ fill: 'transparent' }}
                content={<ChartTooltipContent indicator="dot" />}
            />
            <Legend verticalAlign="top" height={36}/>
            <Bar dataKey="expenses" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} barSize={24} name="Stock Out Costs" />
            <Line
                dataKey="sales"
                type="monotone"
                stroke="hsl(var(--primary))"
                strokeWidth={3}
                dot={{ fill: 'hsl(var(--primary))', r: 4 }}
                activeDot={{ r: 6 }}
                name="Gross Sales"
            />
        </ComposedChart>
    </ResponsiveContainer>
  )

  return (
    <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="h-full"
    >
        <Card className="h-full flex flex-col shadow-elegant border-primary/10 overflow-hidden">
            <CardHeader className="bg-muted/10 border-b pb-4">
                <div className="flex justify-between items-start">
                    <div className="cursor-pointer flex-1" onClick={() => setIsDialogOpen(true)}>
                        <CardTitle className="text-xl font-bold text-primary">Sales vs. Expenses</CardTitle>
                        <CardDescription>Income vs. Stock costs.</CardDescription>
                    </div>
                    <div className="flex gap-1">
                        <Button size="sm" variant={timeUnit === 'monthly' ? 'secondary' : 'ghost'} className="h-7 px-2 text-[10px]" onClick={() => setTimeUnit('monthly')}>M</Button>
                        <Button size="sm" variant={timeUnit === 'daily' ? 'secondary' : 'ghost'} className="h-7 px-2 text-[10px]" onClick={() => setTimeUnit('daily')}>D</Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex-1 pt-6 min-h-[350px] flex justify-center items-center">
                <div className="h-full w-full max-w-[95%]">
                    {ChartContent}
                </div>
            </CardContent>
            <ChartDialog
                isOpen={isDialogOpen}
                setIsOpen={setIsDialogOpen}
                title="Sales vs. Expenses"
                description="Detailed view of income vs costs."
                chartConfig={chartConfig}
            >
                {ChartContent}
            </ChartDialog>
        </Card>
    </motion.div>
  )
}
