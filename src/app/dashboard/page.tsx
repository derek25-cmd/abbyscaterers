import { BarChart, Banknote, BookOpen, User, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function DashboardPage() {
    const kpiData = [
        { title: "Total Bookings (Month)", value: "42", icon: BookOpen, description: "+5% from last month" },
        { title: "Outstanding Invoices", value: "12", icon: Banknote, description: "$15,231.89 unpaid" },
        { title: "Upcoming Events", value: "3", icon: Users, description: "In the next 7 days" },
        { title: "Low Stock Items", value: "8", icon: User, description: "Needs re-ordering" },
    ];
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
                <p className="text-muted-foreground">
                    Welcome back! Here's a snapshot of your catering business.
                </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                 {kpiData.map((kpi, index) => (
                    <Card key={index}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
                            <kpi.icon className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{kpi.value}</div>
                            <p className="text-xs text-muted-foreground">{kpi.description}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>
             <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-full lg:col-span-4">
                    <CardHeader>
                        <CardTitle>Recent Activity</CardTitle>
                         <CardDescription>A log of the most recent actions in the system.</CardDescription>
                    </CardHeader>
                    <CardContent className="pl-2">
                         <div className="space-y-4">
                            <div className="flex items-center">
                                <div className="p-2 bg-secondary rounded-full mr-4">
                                  <User className="h-5 w-5 text-primary"/>
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-medium">Invoice #INV-2024-051 marked as paid.</p>
                                    <p className="text-xs text-muted-foreground">2 hours ago</p>
                                </div>
                            </div>
                             <div className="flex items-center">
                                <div className="p-2 bg-secondary rounded-full mr-4">
                                  <Users className="h-5 w-5 text-primary"/>
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-medium">New booking created for "Tech Conference 2024".</p>
                                    <p className="text-xs text-muted-foreground">1 day ago</p>
                                </div>
                            </div>
                             <div className="flex items-center">
                                <div className="p-2 bg-secondary rounded-full mr-4">
                                   <BookOpen className="h-5 w-5 text-primary"/>
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-medium">Recipe "Spicy Beef Tacos" updated.</p>
                                    <p className="text-xs text-muted-foreground">3 days ago</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
                 <Card className="col-span-full lg:col-span-3">
                    <CardHeader>
                        <CardTitle>Income vs Expenses</CardTitle>
                        <CardDescription>A summary for the current fiscal period.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex items-center justify-center h-48">
                         <p className="text-muted-foreground text-sm">Chart data not available.</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
