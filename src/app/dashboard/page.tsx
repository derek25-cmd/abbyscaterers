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
  BarChart3
} from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="space-y-8 animate-fade-in">
      <div className="relative overflow-hidden rounded-xl bg-gradient-primary p-8 text-white shadow-elegant">
        <div className="relative z-10">
          <h1 className="text-4xl font-bold mb-2">Welcome to CaterSmart</h1>
          <p className="text-xl text-white/90 mb-6">Professional catering management made simple</p>
          <div className="flex gap-4">
            <Button size="lg" variant="secondary" className="bg-white/10 hover:bg-white/20 border-white/20">
              <Plus className="h-5 w-5 mr-2" />
              New Booking
            </Button>
            <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10">
              <BarChart3 className="h-5 w-5 mr-2" />
              View Reports
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
          icon={Calendar}
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
          icon={Users}
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
