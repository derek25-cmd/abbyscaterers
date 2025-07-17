import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, DollarSign } from "lucide-react";

interface Order {
  id: string;
  customer: string;
  event: string;
  date: string;
  status: "pending" | "confirmed" | "preparing" | "completed";
  amount: number;
}

const recentOrders: Order[] = [
  {
    id: "ORD-001",
    customer: "Sarah Johnson",
    event: "Corporate Lunch",
    date: "2024-01-15",
    status: "confirmed",
    amount: 850
  },
  {
    id: "ORD-002",
    customer: "Michael Chen",
    event: "Wedding Reception",
    date: "2024-01-18",
    status: "preparing",
    amount: 3200
  },
  {
    id: "ORD-003",
    customer: "Emily Davis",
    event: "Birthday Party",
    date: "2024-01-20",
    status: "pending",
    amount: 650
  },
  {
    id: "ORD-004",
    customer: "David Wilson",
    event: "Business Meeting",
    date: "2024-01-22",
    status: "completed",
    amount: 420
  }
];

export function RecentOrders() {
  const getStatusColor = (status: Order["status"]) => {
    switch (status) {
      case "completed":
        return "bg-success text-success-foreground";
      case "confirmed":
        return "bg-primary text-primary-foreground";
      case "preparing":
        return "bg-warning text-warning-foreground";
      case "pending":
        return "bg-muted text-muted-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <Card className="bg-gradient-card shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          Recent Orders
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {recentOrders.map((order) => (
            <div key={order.id} className="flex items-center justify-between p-3 rounded-lg bg-background/50 hover:bg-accent/50 transition-smooth">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{order.customer}</span>
                  <Badge className={getStatusColor(order.status)}>
                    {order.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{order.event}</p>
                <p className="text-xs text-muted-foreground">{order.date}</p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 text-foreground font-semibold">
                  <DollarSign className="h-4 w-4" />
                  {order.amount}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}