import { StatsCard } from "@/components/dashboard/stats-card";
import { RecentOrders } from "@/components/dashboard/recent-orders";
import { UpcomingEvents } from "@/components/dashboard/upcoming-events";
import { Button } from "@/components/ui/button";
import { 
  DollarSign, 
  TrendingUp, 
  Users, 
  Calendar,
  Package,
  ChefHat,
  Plus,
  BarChart3,
  BookOpen
} from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
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
          title="Total Bookings (Month)"
          value="42"
          change="+5% from last month"
          changeType="positive"
          icon={BookOpen}
          description="Monthly bookings"
        />
        <StatsCard
          title="Outstanding Invoices"
          value="12"
          change="$15,231.89 unpaid"
          changeType="negative"
          icon={DollarSign}
          description="Awaiting payment"
        />
        <StatsCard
          title="Upcoming Events"
          value="3"
          change="In the next 7 days"
          changeType="neutral"
          icon={Calendar}
          description="Scheduled events"
        />
        <StatsCard
          title="Low Stock Items"
          value="8"
          change="Needs re-ordering"
          changeType="warning"
          icon={Package}
          description="Inventory status"
        />
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
