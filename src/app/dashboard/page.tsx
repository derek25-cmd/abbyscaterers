
"use client";

import { useClientStorage } from "@/hooks/use-client-storage";
import { useOrderStorage } from "@/hooks/use-order-storage";
import { useInvoiceStorage } from "@/hooks/use-invoice-storage";
import { useIngredientStorage } from "@/hooks/use-ingredient-storage";
import { StatsCard } from "@/components/dashboard/stats-card";
import { RecentOrders } from "@/components/dashboard/recent-orders";
import { UpcomingEvents } from "@/components/dashboard/upcoming-events";
import { 
  DollarSign, 
  Calendar,
  Package,
} from "lucide-react";
import { useMemo } from "react";
import { isThisMonth, isFuture, isWithinInterval, addDays } from "date-fns";
import { LoadingPage } from "@/components/layout/loading-page";
import { SalesChart } from "@/components/dashboard/sales-chart";
import { ExpensesChart } from "@/components/dashboard/expenses-chart";
import { SalesVsExpensesChart } from "@/components/dashboard/sales-vs-expenses-chart";
import { WelcomeCard } from "@/components/dashboard/welcome-card";

export default function DashboardPage() {
  const { orders: menus, isLoading: menusLoading } = useOrderStorage();
  const { invoices, isLoading: invoicesLoading } = useInvoiceStorage();
  const { ingredients, isLoading: ingredientsLoading } = useIngredientStorage();
  const { clients, isLoading: clientsLoading } = useClientStorage();

  const isLoading = menusLoading || invoicesLoading || ingredientsLoading || clientsLoading;

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
      lowStockItems
    };
  }, [menus, invoices, ingredients]);

  if (isLoading) {
    return <LoadingPage title="Loading Your Dashboard" message="Crunching the latest numbers, just for you..."/>;
  }

  return (
    <div className="space-y-8 animate-fade-in">
        <WelcomeCard />
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                change={`${stats.outstandingAmount.toLocaleString('en-US', { style: 'currency', currency: 'TZS', currencyDisplay: 'code' })} unpaid`}
                changeType="negative"
                icon={DollarSign}
                description="Awaiting payment"
                />
                <StatsCard
                title="Upcoming Events"
                value={stats.upcomingEventsCount}
                change="In the next 7 days"
                changeType="neutral"
                icon={Calendar}
                description="Scheduled events"
                />
                <StatsCard
                title="Low Stock Items"
                value={stats.lowStockItems}
                change="Needs re-ordering"
                changeType="warning"
                icon={Package}
                description="Inventory status (demo)"
                />
            </div>
            <div className="lg:col-span-4 space-y-6">
                <SalesVsExpensesChart />
            </div>
            <div className="lg:col-span-4 space-y-6">
                <SalesChart />
            </div>
            <div className="lg:col-span-4 space-y-6">
                <ExpensesChart />
            </div>
             <div className="lg:col-span-2 space-y-6">
                <RecentOrders />
            </div>
            <div className="lg:col-span-2 space-y-6">
                <UpcomingEvents />
            </div>
        </div>
    </div>
  );
}
