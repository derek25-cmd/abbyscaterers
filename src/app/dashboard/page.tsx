
"use client";

import { useClientStorage } from "@/hooks/use-client-storage";
import { useOrderStorage } from "@/hooks/use-order-storage";
import { useInvoiceStorage } from "@/hooks/use-invoice-storage";
import { useIngredientStorage } from "@/hooks/use-ingredient-storage";
import { useStockLogStorage } from "@/hooks/use-stock-log-storage";
import { useAttendanceService } from "@/services/attendanceService"; // Assuming existence based on other files
import { StatsCard } from "@/components/dashboard/stats-card";
import { RecentOrders } from "@/components/dashboard/recent-orders";
import { UpcomingEvents } from "@/components/dashboard/upcoming-events";
import { 
  DollarSign, 
  Calendar,
  Package,
  Users,
  Truck,
  TrendingUp,
} from "lucide-react";
import { useMemo, useEffect, useState } from "react";
import { isThisMonth, isFuture, isWithinInterval, addDays, format } from "date-fns";
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
import { Asset, Attendance, Employee } from "@/types";

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

  useEffect(() => {
    const fetchExtras = async () => {
        const [assetsData, attendanceData, empsData] = await Promise.all([
            getAssets(),
            getAttendanceRecords(),
            getEmployees()
        ]);
        setAssets(assetsData);
        setAttendance(attendanceData);
        setEmployees(empsData);
        setExtraLoading(false);
    }
    fetchExtras();
  }, []);

  const isLoading = menusLoading || invoicesLoading || ingredientsLoading || clientsLoading || logsLoading || extraLoading;

  const stats = useMemo(() => {
    const totalBookingsThisMonth = menus.filter(menu => 
        menu.clientEvents.some(event => isThisMonth(new Date(event.date)))
    ).length;
    
    const outstandingInvoices = invoices.filter(inv => inv.status === 'outstanding');
    const totalOutstandingInvoices = outstandingInvoices.length;
    
    const outstandingAmount = outstandingInvoices.reduce((acc, inv) => {
        const subtotal = inv.items.reduce((sum, item) => sum + (item.total || 0), 0);
        const totalForDays = inv.multiplyByDays ? subtotal * (inv.numberOfDays || 1) : subtotal;
        const totalBeforeVAT = totalForDays + (inv.serviceCharge || 0) + (inv.transportCosts || 0);
        const vat = inv.vatType === 'exclusive' ? totalBeforeVAT * 0.18 : 0;
        return acc + totalBeforeVAT + vat;
    }, 0);

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const presentTodayCount = attendance.filter(a => a.date === todayStr && a.clockIn !== '—').length;
    const activeEmps = employees.filter(e => e.status === 'Active').length;
    const attendanceRate = activeEmps > 0 ? Math.round((presentTodayCount / activeEmps) * 100) : 0;

    const today = new Date();
    const nextSevenDays = { start: today, end: addDays(today, 7) };
    const upcomingEventsCount = menus.reduce((count, menu) => {
        return count + menu.clientEvents.filter(event => 
            isFuture(new Date(event.date)) && isWithinInterval(new Date(event.date), nextSevenDays)
        ).length;
    }, 0);

    const lowStockItems = ingredients.filter(i => (i.quantityUsed || 0) > 0 && (i.quantityUsed || 0) < 5).length;

    return {
      totalBookingsThisMonth,
      totalOutstandingInvoices,
      outstandingAmount,
      upcomingEventsCount,
      lowStockItems,
      attendanceRate,
      activeEmps
    };
  }, [menus, invoices, ingredients, attendance, employees]);

  if (isLoading) {
    return <LoadingPage title="Loading Your Dashboard" message="Crunching the latest numbers, just for you..."/>;
  }

  return (
    <div className="space-y-8 animate-fade-in pb-10">
        <WelcomeCard />
        
        {/* Top Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
        </div>

        {/* Sales & Financial Zone */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
                <SalesVsExpensesChart />
            </div>
            <div className="lg:col-span-1">
                <RevenueByClientChart invoices={invoices} clients={clients} />
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SalesChart />
            <ExpensesChart />
        </div>

        {/* Operational & Logistics Zone */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
                <AssetStatusChart assets={assets} />
            </div>
            <div className="lg:col-span-1">
                <RecentStockLogs logs={stockLogs} />
            </div>
            <div className="lg:col-span-1 space-y-6">
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

        {/* History & Feeds */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <RecentOrders />
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary"/>Business Growth Insight</CardTitle>
                    <CardDescription>Quick summary of recent activity.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        Your revenue is currently driven by <strong>{clients.length > 0 ? clients[0].companyName : 'new clients'}</strong>. 
                        There are <strong>{stats.upcomingEventsCount} events</strong> scheduled for the next week. 
                        Ensure that the <strong>{assets.filter(a => a.status === 'Under Maintenance').length} items</strong> in maintenance are serviced before then.
                    </p>
                    <div className="flex gap-4 pt-2">
                        <div className="flex-1 p-3 rounded-lg bg-primary/5 border text-center">
                            <p className="text-xs text-muted-foreground font-bold uppercase">Avg. Ticket</p>
                            <p className="text-xl font-bold">{(stats.outstandingAmount / (stats.totalOutstandingInvoices || 1)).toLocaleString('en-US', { style: 'currency', currency: 'TZS', maximumFractionDigits: 0 })}</p>
                        </div>
                        <div className="flex-1 p-3 rounded-lg bg-accent/5 border text-center">
                            <p className="text-xs text-muted-foreground font-bold uppercase">Client Base</p>
                            <p className="text-xl font-bold">{clients.length}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    </div>
  );
}
