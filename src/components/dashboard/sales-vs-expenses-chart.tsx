
"use client"

import * as React from "react"
import { Bar, ComposedChart, Line, CartesianGrid, XAxis, YAxis } from "recharts"
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
    <ComposedChart
        accessibilityLayer
        data={combinedData}
        margin={{ left: 12, right: 12 }}
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
        <Bar dataKey="expenses" fill="var(--color-expenses)" radius={4} />
        <Line
        dataKey="sales"
        type="monotone"
        stroke="var(--color-sales)"
        strokeWidth={2}
        dot={true}
        />
    </ComposedChart>
  )

  return (
    <Card>
      <CardHeader>
        <div className="cursor-pointer" onClick={() => setIsDialogOpen(true)}>
            <CardTitle>Sales vs. Expenses</CardTitle>
            <CardDescription>
            A comparative view of your income and costs over time.
            </CardDescription>
        </div>
        <div className="flex gap-2 pt-2">
            <Button size="sm" variant={timeUnit === 'daily' ? 'secondary' : 'ghost'} onClick={() => setTimeUnit('daily')}>Daily</Button>
            <Button size="sm" variant={timeUnit === 'weekly' ? 'secondary' : 'ghost'} onClick={() => setTimeUnit('weekly')}>Weekly</Button>
            <Button size="sm" variant={timeUnit === 'monthly' ? 'secondary' : 'ghost'} onClick={() => setTimeUnit('monthly')}>Monthly</Button>
            <Button size="sm" variant={timeUnit === 'yearly' ? 'secondary' : 'ghost'} onClick={() => setTimeUnit('yearly')}>Yearly</Button>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-64">
          {Chart}
        </ChartContainer>
      </CardContent>
      <ChartDialog
        isOpen={isDialogOpen}
        setIsOpen={setIsDialogOpen}
        title="Sales vs. Expenses"
        description="A comparative view of your income and costs over time."
        chartConfig={chartConfig}
      >
        {Chart}
      </ChartDialog>
    </Card>
  )
}
