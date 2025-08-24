
// @ts-nocheck
"use client";

import { useState }
from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useClientStorage } from "@/hooks/use-client-storage";
import { useOrderStorage } from "@/hooks/use-order-storage";
import { useProductStorage } from "@/hooks/use-product-storage";
import { CostingForm } from "@/components/costing/costing-form";
import { CostingReport } from "@/components/costing/costing-report";
import { DailyCosting } from "@/types";

export type CostingRequest = {
  type: 'individual' | 'aggregate';
  clientId?: string | null;
  periodType: 'daily' | 'monthly';
  dates: Date[];
} | null;

export default function CostingPage() {
    const { clients, isLoading: clientsLoading } = useClientStorage();
    const { orders, isLoading: ordersLoading } = useOrderStorage();
    const { products, isLoading: productsLoading } = useProductStorage();
    
    const [request, setRequest] = useState<CostingRequest>(null);

    const isLoading = clientsLoading || ordersLoading || productsLoading;

    if (request) {
        return (
            <CostingReport 
                request={request}
                clients={clients}
                orders={orders}
                products={products}
                onBack={() => setRequest(null)}
                isLoading={isLoading}
            />
        )
    }

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">Costing Analysis</h1>
                    <p className="text-muted-foreground">Select a costing method to analyze profitability.</p>
                </div>
                <Button asChild variant="outline">
                    <Link href="/reports">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Reports
                    </Link>
                </Button>
            </div>
            
            <CostingForm clients={clients} onSubmit={setRequest} isLoading={isLoading}/>
        </div>
    );
}
