
"use client";

import { useClientStorage } from "@/hooks/use-client-storage";
import { useOrderStorage } from "@/hooks/use-order-storage";
import { useInvoiceStorage } from "@/hooks/use-invoice-storage";
import { useIngredientStorage } from "@/hooks/use-ingredient-storage";
import { useStockLogStorage } from "@/hooks/use-stock-log-storage";
import { StatsCard } from "@/components/dashboard/stats-card";
import { RecentOrders } from "@/components/dashboard/recent-orders";
import { UpcomingEvents } from "@/components/dashboard/upcoming-events";
import { 
  DollarSign, 
  Calendar,
  Package,
  Users,
  Truck,
  BrainCircuit,
  Loader2,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { useMemo, useEffect, useState } from "react";
import { isThisMonth, isFuture, isWithinInterval, addDays, format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { LoadingPage } from "@/components/layout/loading-page";
import { SalesChart } from "@/components/dashboard/sales-chart";
import { ExpensesChart } from "@/components/dashboard/expenses-chart";
import { SalesVsExpensesChart } from "@/components/dashboard/sales-vs-expenses-chart";
import { WelcomeCard } from "@/components/dashboard/welcome-card";
import { RevenueByClientChart } from "@/components/dashboard/revenue-by-client-chart";
import { AssetStatusChart } from "@/components/dashboard/asset-status-chart";
import { RecentStockLogs } from "@/components/dashboard/recent-stock-logs";
import { getAssets } from "@/services/assetService";
import { getAttendanceRecords } from "@/services/attendanceService";
import { getEmployees } from "@/services/employeeService";
import { Asset, Attendance, Employee, Invoice } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { generateBusinessInsightAction } from "@/lib/actions";
import { BusinessInsightOutput } from "@/ai/flows/business-insight-flow";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

const calculateInvoiceTotal = (inv: Invoice): number => {
    const subtotal = inv.items.reduce((sum, item) => sum + (item.total || 0), 0);
    const totalForDays = inv.multiplyByDays ? subtotal * (inv.numberOfDays || 1) : subtotal;
    const totalBeforeVAT = totalForDays + (inv.serviceCharge || 0) + (inv.transportCosts || 0);
    const vat = inv.vatType === 'exclusive' ? totalBeforeVAT * 0.18 : 0;
    return totalBeforeVAT + vat;
};

export default function DashboardPage() {
  const { orders: menus, isLoading: menusLoading } = useOrderStorage();
  const { invoices, isLoading: invoicesLoading } = useInvoiceStorage();
  const { ingredients, isLoading: ingredientsLoading } = useIngredientStorage();
  const { clients, isLoading: clientsLoading } = useClientStorage();
  const { logs: stockLogs, isLoading: logsLoading } = useStockLogStorage();
  
  const [assets, setAssets] = useState<Asset[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [extraLoading, setExtraLoading] = useState(true);

  // AI Insight State
  const [aiInsight, setAiInsight] = useState<BusinessInsightOutput | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  useEffect(() => {
    const fetchExtras = async () => {
        const [assetsData, attendanceData, empsData] = await Promise.all([
            getAssets(),
            getAttendanceRecords(),
            getEmployees()
        ]);
        setAssets(assetsData || []);
        setAttendance(attendanceData || []);
        setEmployees(empsData || []);
        setExtraLoading(false);
    }
    fetchExtras();
  }, []);

  const stats = useMemo(() => {
    const now = new Date();
    const lastMonthStart = startOfMonth(subMonths(now, 1));
    const lastMonthEnd = endOfMonth(subMonths(now, 1));

    const totalBookingsThisMonth = menus.filter(menu => 
        menu.clientEvents.some(event => isThisMonth(new Date(event.date)))
    ).length;
    
    const outstandingInvoices = invoices.filter(inv => inv.status === 'outstanding');
    const totalOutstandingInvoices = outstandingInvoices.length;
    
    const outstandingAmount = outstandingInvoices.reduce((acc, inv) => acc + calculateInvoiceTotal(inv), 0);

    const revenueThisMonth = invoices
        .filter(inv => inv.invoiceDate && isThisMonth(new Date(inv.invoiceDate)))
        .reduce((sum, inv) => sum + calculateInvoiceTotal(inv), 0);

    const revenueLastMonth = invoices
        .filter(inv => inv.invoiceDate && new Date(inv.invoiceDate) >= lastMonthStart && new Date(inv.invoiceDate) <= lastMonthEnd)
        .reduce((sum, inv) => sum + calculateInvoiceTotal(inv), 0);

    const todayStr = format(now, 'yyyy-MM-dd');
    const presentTodayCount = attendance.filter(a => a.date === todayStr && a.clockIn !== '—').length;
    const activeEmps = employees.filter(e => e.status === 'Active').length;
    const attendanceRate = activeEmps > 0 ? Math.round((presentTodayCount / activeEmps) * 100) : 0;

    const nextSevenDays = { start: now, end: addDays(now, 7) };
    const upcomingEventsCount = menus.reduce((count, menu) => {
        return count + menu.clientEvents.filter(event => 
            isFuture(new Date(event.date)) && isWithinInterval(new Date(event.date), nextSevenDays)
        ).length;
    }, 0);

    const lowStockItems = ingredients.filter(i => (i.quantityUsed || 0) > 0 && (i.quantityUsed || 0) < 5).length;

    // Find top client name
    const revenueMap = new Map<string, number>();
    invoices.forEach(inv => {
        if (!inv.clientId) return;
        const total = calculateInvoiceTotal(inv);
        revenueMap.set(inv.clientId, (revenueMap.get(inv.clientId) || 0) + total);
    });
    const topClientId = Array.from(revenueMap.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];
    const topClientName = clients.find(c => c.id === topClientId)?.companyName || 'None';

    return {
      totalBookingsThisMonth,
      totalOutstandingInvoices,
      outstandingAmount,
      upcomingEventsCount,
      lowStockItems,
      attendanceRate,
      activeEmps,
      revenueThisMonth,
      revenueLastMonth,
      topClientName
    };
  }, [menus, invoices, ingredients, attendance, employees, clients]);

  // Fetch AI Insight when stats are ready
  useEffect(() => {
    if (!extraLoading && !menusLoading && !invoicesLoading && !clientsLoading) {
        const fetchInsight = async () => {
            setIsAiLoading(true);
            const result = await generateBusinessInsightAction({
                revenueThisMonth: stats.revenueThisMonth,
                revenueLastMonth: stats.revenueLastMonth,
                outstandingInvoicesCount: stats.totalOutstandingInvoices,
                outstandingAmount: stats.outstandingAmount,
                topClientName: stats.topClientName,
                upcomingEventsCount: stats.upcomingEventsCount,
                lowStockItemsCount: stats.lowStockItems,
                attendanceRate: stats.attendanceRate,
            });
            
            if (!('error' in result)) {
                setAiInsight(result);
            }
            setIsAiLoading(false);
        };
        fetchInsight();
    }
  }, [extraLoading, menusLoading, invoicesLoading, clientsLoading, stats]);

  const isLoading = menusLoading || invoicesLoading || ingredientsLoading || clientsLoading || logsLoading || extraLoading;

  if (isLoading) {
    return <LoadingPage title="Loading Your Dashboard" message="Crunching the latest numbers, just for you..."/>;
  }

  return (
    <div className="space-y-8 animate-fade-in pb-10">
        <WelcomeCard />
        
        {/* Top Metric Cards */}
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, staggerChildren: 0.1 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
        >
            <StatsCard
                title="Bookings (This Month)"
                value={stats.totalBookingsThisMonth}
                change={`${clients.length} total clients`}
                changeType="neutral"
                icon={Calendar}
                description="Monthly bookings created"
            />
            <StatsCard
                title="Outstanding Invoices"
                value={stats.totalOutstandingInvoices}
                change={`${stats.outstandingAmount.toLocaleString('en-US', { style: 'currency', currency: 'TZS', currencyDisplay: 'code' })}`}
                changeType="negative"
                icon={DollarSign}
                description="Total awaiting payment"
            />
            <StatsCard
                title="Staff Participation"
                value={`${stats.attendanceRate}%`}
                change={`${stats.activeEmps} active staff`}
                changeType={stats.attendanceRate > 80 ? "positive" : "warning"}
                icon={Users}
                description="Attendance rate for today"
            />
            <StatsCard
                title="Logistics Health"
                value={`${assets.filter(a => a.status === 'Available').length}`}
                change={`${assets.filter(a => a.status === 'Under Maintenance').length} in maintenance`}
                changeType="neutral"
                icon={Truck}
                description="Assets available for deployment"
            />
        </motion.div>

        {/* Balanced Financial Zone - Rebalanced to 1:2 ratio */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
            <div className="lg:col-span-1">
                <SalesVsExpensesChart />
            </div>
            <div className="lg:col-span-2">
                <RevenueByClientChart invoices={invoices} clients={clients} />
            </div>
        </div>

        {/* Detailed Trend Zone */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SalesChart />
            <ExpensesChart />
        </div>

        {/* Operational & Logistics Zone */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <AssetStatusChart assets={assets} />
            <RecentStockLogs logs={stockLogs} />
            <div className="space-y-6">
                <StatsCard
                    title="Inventory Alerts"
                    value={stats.lowStockItems}
                    change="Items below threshold"
                    changeType="warning"
                    icon={Package}
                    description="Requires immediate restocking"
                />
                <UpcomingEvents />
            </div>
        </div>

        {/* AI Insight Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <RecentOrders />
            <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6 }}
            >
                <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5 h-full overflow-hidden">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                                <BrainCircuit className="h-5 w-5 text-primary"/>
                                Business Growth Insight
                            </CardTitle>
                            {isAiLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                            {aiInsight && (
                                <Badge variant={aiInsight.growthIndicator === 'positive' ? 'default' : aiInsight.growthIndicator === 'warning' ? 'destructive' : 'secondary'}>
                                    {aiInsight.growthIndicator.toUpperCase()} TREND
                                </Badge>
                            )}
                        </div>
                        <CardDescription>AI-powered trend analysis and professional advice.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {isAiLoading && !aiInsight ? (
                            <div className="py-10 text-center space-y-3">
                                <BrainCircuit className="h-10 w-10 mx-auto text-primary/20 animate-pulse" />
                                <p className="text-sm text-muted-foreground">Analyzing your business performance...</p>
                            </div>
                        ) : aiInsight ? (
                            <>
                                <div className="p-3 rounded-lg bg-background/50 border border-primary/10">
                                    <p className="text-sm leading-relaxed text-foreground">
                                        {aiInsight.summary}
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <h4 className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Strategic Advice</h4>
                                    <ul className="space-y-2">
                                        {aiInsight.advice.map((item, i) => (
                                            <li key={i} className="flex gap-2 text-sm text-foreground">
                                                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                                                <span>{item}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </>
                        ) : (
                            <div className="py-10 text-center text-muted-foreground">
                                <AlertCircle className="h-10 w-10 mx-auto mb-2 opacity-20" />
                                <p className="text-sm">Unable to generate AI insights at this time.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </motion.div>
        </div>
    </div>
  );
}
