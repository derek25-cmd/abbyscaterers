
"use client"

import * as React from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts"
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
import { useStockLogStorage } from "@/hooks/use-stock-log-storage"
import { Button } from "@/components/ui/button"
import { ChartDialog } from "./chart-dialog"


type TimeUnit = "daily" | "weekly" | "monthly"

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
        if (!log.date) return;
        const date = parseISO(log.date)
        const expenseAmount = log.price || 0

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
        }
        return { ...item, date: displayDate };
    });

  }, [logs, timeUnit])

  const ChartInner = (
    <ResponsiveContainer width="100%" height="100%">
        <BarChart
            data={expensesData}
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
                cursor={{ fill: 'hsl(var(--destructive) / 0.05)' }}
                content={<ChartTooltipContent indicator="dot" />}
            />
            <Bar
                dataKey="expenses"
                fill="hsl(var(--destructive))"
                radius={[4, 4, 0, 0]}
                barSize={32}
            />
        </BarChart>
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
                        <CardTitle className="text-xl font-bold text-primary">Expense Summary</CardTitle>
                        <CardDescription>Stock-out costs over time.</CardDescription>
                    </div>
                    <div className="flex gap-1">
                        <Button size="sm" variant={timeUnit === 'weekly' ? 'secondary' : 'ghost'} className="h-7 px-2 text-[10px]" onClick={() => setTimeUnit('weekly')}>W</Button>
                        <Button size="sm" variant={timeUnit === 'monthly' ? 'secondary' : 'ghost'} className="h-7 px-2 text-[10px]" onClick={() => setTimeUnit('monthly')}>M</Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex-1 pt-6 min-h-[300px] flex justify-center items-center">
                <div className="h-full w-full max-w-[95%]">
                    {ChartInner}
                </div>
            </CardContent>
            <ChartDialog
                isOpen={isDialogOpen}
                setIsOpen={setIsDialogOpen}
                title="Expense Summary Details"
                description={`A bar chart analysis of costs by ${timeUnit}.`}
                chartConfig={chartConfig}
            >
                {ChartInner}
            </ChartDialog>
        </Card>
    </motion.div>
  )
}
