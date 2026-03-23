
"use client"

import * as React from "react"
import { Bar, ComposedChart, Line, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts"
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
import { useStockLogStorage } from "@/hooks/use-stock-log-storage"
import { Button } from "@/components/ui/button"
import { ChartDialog } from "./chart-dialog"

type TimeUnit = "daily" | "weekly" | "monthly" | "yearly"

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

    // Process Sales
    orders.forEach(order => {
      order.clientEvents.forEach(event => {
        const date = parseISO(event.date)
        const saleAmount = event.unitPrice * event.numberOfPeople

        let key: string;
        switch (timeUnit) {
          case "daily": key = format(date, "yyyy-MM-dd"); break;
          case "weekly": key = format(startOfWeek(date), "yyyy-MM-dd"); break;
          case "monthly": key = format(startOfMonth(date), "yyyy-MM"); break;
          case "yearly": key = format(startOfYear(date), "yyyy"); break;
        }

        const current = dataMap.get(key) || { sales: 0, expenses: 0 }
        dataMap.set(key, { ...current, sales: current.sales + saleAmount })
      })
    })

    // Process Expenses
    stockLogs.filter(log => log.type === 'Stock Out').forEach(log => {
      const date = parseISO(log.date)
      const expenseAmount = log.price

      let key: string;
       switch (timeUnit) {
          case "daily": key = format(date, "yyyy-MM-dd"); break;
          case "weekly": key = format(startOfWeek(date), "yyyy-MM-dd"); break;
          case "monthly": key = format(startOfMonth(date), "yyyy-MM"); break;
          case "yearly": key = format(startOfYear(date), "yyyy"); break;
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
            case "yearly": displayDate = format(dateObj, 'yyyy'); break;
        }
        return { ...item, date: displayDate };
    });

  }, [orders, stockLogs, timeUnit])

  const Chart = (
    <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
            data={combinedData}
            margin={{ left: 10, right: 10, top: 10, bottom: 10 }}
        >
            <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.3} />
            <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                fontSize={12}
            />
            <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                fontSize={12}
                tickFormatter={(value) => `${(value/1000000).toFixed(1)}M`}
            />
            <Tooltip
                cursor={{ fill: 'transparent' }}
                content={<ChartTooltipContent indicator="dot" />}
            />
            <Bar dataKey="expenses" fill="var(--color-expenses)" radius={[4, 4, 0, 0]} barSize={30} />
            <Line
                dataKey="sales"
                type="monotone"
                stroke="var(--color-sales)"
                strokeWidth={3}
                dot={{ fill: 'var(--color-sales)', r: 4 }}
                activeDot={{ r: 6 }}
            />
        </ComposedChart>
    </ResponsiveContainer>
  )

  return (
    <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        className="h-full"
    >
        <Card className="h-full flex flex-col shadow-elegant border-primary/10 overflow-hidden">
            <CardHeader className="bg-muted/10 border-b pb-4">
                <div className="flex justify-between items-start">
                    <div className="cursor-pointer" onClick={() => setIsDialogOpen(true)}>
                        <CardTitle className="text-xl font-bold text-primary">Sales vs. Expenses</CardTitle>
                        <CardDescription>Comparison of revenue and direct stock costs.</CardDescription>
                    </div>
                    <div className="flex gap-1">
                        <Button size="xs" variant={timeUnit === 'daily' ? 'secondary' : 'ghost'} className="h-7 px-2 text-[10px]" onClick={() => setTimeUnit('daily')}>Daily</Button>
                        <Button size="xs" variant={timeUnit === 'monthly' ? 'secondary' : 'ghost'} className="h-7 px-2 text-[10px]" onClick={() => setTimeUnit('monthly')}>Monthly</Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex-1 pt-6 min-h-[300px]">
                <div className="h-full w-full flex justify-center">
                    {Chart}
                </div>
            </CardContent>
            <ChartDialog
                isOpen={isDialogOpen}
                setIsOpen={setIsDialogOpen}
                title="Sales vs. Expenses"
                description="Detailed view of income vs costs."
                chartConfig={chartConfig}
            >
                {Chart}
            </ChartDialog>
        </Card>
    </motion.div>
  )
}
