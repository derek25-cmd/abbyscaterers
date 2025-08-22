
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function MonthlyOrderReportPage() {
    return (
        <div className="container mx-auto p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">Monthly Order Report</h1>
                    <p className="text-muted-foreground">This report is under construction.</p>
                </div>
                <Button asChild variant="outline">
                    <Link href="/reports">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Reports
                    </Link>
                </Button>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Coming Soon!</CardTitle>
                    <CardDescription>
                        This section will contain a detailed monthly analysis of your sales and order volumes.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p>Check back later for updates.</p>
                </CardContent>
            </Card>
        </div>
    );
}

