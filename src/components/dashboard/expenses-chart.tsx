
"use client"

import * as React from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
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
import { useStockLogStorage } from "@/hooks/use-stock-log-storage"
import { Button } from "@/components/ui/button"
import { ChartDialog } from "./chart-dialog"


type TimeUnit = "daily" | "weekly" | "monthly" | "yearly"

const chartConfig = {
  expenses: {
    label: "Expenses",
    color: "hsl(var(--destructive))",
  },
} satisfies ChartConfig

export function ExpensesChart() {
  const { logs } = useStockLogStorage()
  const [timeUnit, setTimeUnit] = React.useState<TimeUnit>("monthly")
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);


  const expensesData = React.useMemo(() => {
    if (!logs) return []

    const dataMap = new Map<string, number>()
    
    const expenseLogs = logs.filter(log => log.type === 'Stock Out');

    expenseLogs.forEach(log => {
        const date = parseISO(log.date)
        const expenseAmount = log.price

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

        dataMap.set(key, (dataMap.get(key) || 0) + expenseAmount)
    })
    
    const sortedData = Array.from(dataMap.entries())
        .map(([date, expenses]) => ({ date, expenses }))
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

  }, [logs, timeUnit])

  const Chart = (
     <BarChart
        accessibilityLayer
        data={expensesData}
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
        <Bar
            dataKey="expenses"
            fill="var(--color-expenses)"
            radius={4}
        />
    </BarChart>
  )

  return (
    <Card>
      <CardHeader>
        <div className="cursor-pointer" onClick={() => setIsDialogOpen(true)}>
            <CardTitle>Expenses Overview</CardTitle>
            <CardDescription>
            Showing total expenses from stocked-out goods {timeUnit}.
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
        title="Expenses Overview"
        description={`Showing total expenses from stocked-out goods ${timeUnit}.`}
        chartConfig={chartConfig}
      >
        {Chart}
      </ChartDialog>
    </Card>
  )
}
