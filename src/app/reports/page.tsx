
"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowRight, BarChart3, Box, Calendar, DollarSign, FileText, Truck, Users, Utensils } from "lucide-react";

const reportCategories = [
  {
    category: "Sales & Finance Reports",
    reports: [
      {
        title: "Daily Order Report",
        description: "A summary of all orders for a specific day.",
        href: "/reports/daily-order",
        icon: Calendar,
      },
      {
        title: "Monthly Order Report",
        description: "A monthly overview of sales and order volume.",
        href: "/reports/monthly-order",
        icon: BarChart3,
      },
       {
        title: "Monthly Invoice Report",
        description: "Track the status and totals of all invoices.",
        href: "/reports/monthly-invoice",
        icon: FileText,
      },
      {
        title: "Costing Report",
        description: "Analyze ingredient costs against event income.",
        href: "/costing",
        icon: DollarSign,
      },
    ],
  },
  {
    category: "Inventory & Operations Reports",
    reports: [
      {
        title: "Daily Menu Report",
        description: "View a consolidated menu for all orders on a specific day.",
        href: "/reports/daily-menu",
        icon: Utensils,
      },
      {
        title: "Daily Stock Log",
        description: "Track all inventory movements for a selected day.",
        href: "/reports/daily-stock-log",
        icon: Box,
      },
      {
        title: "Daily Issuance Report",
        description: "View all assets and items issued on a specific day.",
        href: "/reports/daily-issuance",
        icon: Truck,
      },
       {
        title: "Monthly Stock Report",
        description: "A summary of stock levels and adjustments over the month.",
        href: "/reports/monthly-stock",
        icon: Box,
      },
    ],
  },
  {
    category: "Human Resources Reports",
    reports: [
      {
        title: "Monthly Attendance Report",
        description: "Get a summary of employee attendance for the month.",
        href: "/reports/monthly-attendance",
        icon: Users,
      },
      {
        title: "Monthly Payroll Report",
        description: "Review a summary of all payrolls processed in a month.",
        href: "/reports/monthly-payroll",
        icon: DollarSign,
      },
    ],
  },
];


export default function ReportsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Reports Dashboard
        </h1>
        <p className="text-muted-foreground">
          Select a report to view detailed analytics about your operations.
        </p>
      </div>

      {reportCategories.map((category) => (
        <div key={category.category}>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground mb-4">{category.category}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {category.reports.map((report) => (
              <Card key={report.title} className="hover:shadow-lg transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-lg font-medium">
                    {report.title}
                  </CardTitle>
                  <report.icon className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <CardDescription>{report.description}</CardDescription>
                   <Button asChild variant="link" className="px-0 mt-4">
                      <Link href={report.href}>
                        View Report <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                   </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
