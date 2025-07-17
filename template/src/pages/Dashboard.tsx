import { StatsCard } from "@/components/dashboard/StatsCard";
import { RecentOrders } from "@/components/dashboard/RecentOrders";
import { UpcomingEvents } from "@/components/dashboard/UpcomingEvents";
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

export default function Dashboard() {
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-primary p-8 text-white shadow-elegant">
        <div className="relative z-10">
          <h1 className="text-4xl font-bold mb-2">Welcome to CaterTrax</h1>
          <p className="text-xl text-white/90 mb-6">Professional catering management made simple</p>
          <div className="flex gap-4">
            <Button size="lg" variant="secondary" className="bg-white/10 hover:bg-white/20 border-white/20">
              <Plus className="h-5 w-5 mr-2" />
              New Order
            </Button>
            <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10">
              <BarChart3 className="h-5 w-5 mr-2" />
              View Reports
            </Button>
          </div>
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/10"></div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Revenue"
          value="$24,580"
          change="+12% from last month"
          changeType="positive"
          icon={DollarSign}
          description="Monthly earnings"
        />
        <StatsCard
          title="Active Orders"
          value="28"
          change="+5 new orders"
          changeType="positive"
          icon={Package}
          description="Orders in progress"
        />
        <StatsCard
          title="Upcoming Events"
          value="12"
          change="Next 30 days"
          changeType="neutral"
          icon={Calendar}
          description="Scheduled events"
        />
        <StatsCard
          title="Customer Satisfaction"
          value="4.8"
          change="+0.2 from last month"
          changeType="positive"
          icon={TrendingUp}
          description="Average rating"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentOrders />
        </div>
        <div>
          <UpcomingEvents />
        </div>
      </div>

      {/* Additional Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatsCard
          title="Staff Members"
          value="15"
          change="2 new hires this month"
          changeType="positive"
          icon={ChefHat}
          description="Active team members"
        />
        <StatsCard
          title="Regular Customers"
          value="342"
          change="+28 new customers"
          changeType="positive"
          icon={Users}
          description="Loyal client base"
        />
        <StatsCard
          title="Menu Items"
          value="156"
          change="8 seasonal additions"
          changeType="neutral"
          icon={Package}
          description="Available dishes"
        />
      </div>
    </div>
  );
}