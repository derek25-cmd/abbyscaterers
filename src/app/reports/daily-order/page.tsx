
"use client";

import { DailyOrderReport } from "@/components/reports/daily-order-report";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function DailyOrderReportPage() {
    return (
        <div className="container mx-auto p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">Daily Order Report</h1>
                    <p className="text-muted-foreground">View a comprehensive summary of all orders for a specific day.</p>
                </div>
                <Button asChild variant="outline">
                    <Link href="/reports">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Reports
                    </Link>
                </Button>
            </div>
            <DailyOrderReport />
        </div>
    );
}
