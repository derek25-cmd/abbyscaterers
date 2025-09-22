
"use client";

import { useClientStorage } from "@/hooks/use-client-storage";
import { useOrderStorage } from "@/hooks/use-order-storage";
import { useInvoiceStorage } from "@/hooks/use-invoice-storage";
import { useIngredientStorage } from "@/hooks/use-ingredient-storage";
import { StatsCard } from "@/components/dashboard/stats-card";
import { RecentOrders } from "@/components/dashboard/recent-orders";
import { UpcomingEvents } from "@/components/dashboard/upcoming-events";
import { Button } from "@/components/ui/button";
import { 
  DollarSign, 
  Calendar,
  Package,
  Plus,
  BarChart3,
  BookOpen
} from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { isThisMonth, isFuture, isWithinInterval, addDays } from "date-fns";
import { LoadingPage } from "@/components/layout/loading-page";
import { SalesChart } from "@/components/dashboard/sales-chart";

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
      <div className="relative overflow-hidden rounded-xl bg-gradient-primary p-8 text-primary-foreground shadow-elegant">
        <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,#fff,rgba(255,255,255,0.6))] dark:bg-grid-slate-700/25 dark:[mask-image:linear-gradient(0deg,#fff,rgba(255,255,255,0.05))]"></div>
        <div className="relative z-10">
          <h1 className="text-4xl font-bold mb-2">Welcome to CaterSmart</h1>
          <p className="text-xl text-primary-foreground/90 mb-6">Your all-in-one catering management solution.</p>
          <div className="flex gap-4">
            <Button size="lg" variant="secondary" className="bg-primary-foreground/10 hover:bg-primary-foreground/20 border-primary-foreground/20" asChild>
              <Link href="/daily-menus/new">
                <Plus className="h-5 w-5 mr-2" />
                New Booking
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10" asChild>
               <Link href="/reports">
                <BarChart3 className="h-5 w-5 mr-2" />
                View Reports
              </Link>
            </Button>
          </div>
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/10"></div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Bookings (This Month)"
          value={stats.totalBookingsThisMonth}
          change={`${clients.length} total clients`}
          changeType="neutral"
          icon={BookOpen}
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

      <div>
        <SalesChart />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentOrders />
        </div>
        <div>
          <UpcomingEvents />
        </div>
      </div>
    </div>
  );
}
