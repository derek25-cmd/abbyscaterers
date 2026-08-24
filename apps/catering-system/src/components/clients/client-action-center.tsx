
"use client";

import type { Client } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { BookOpen, FileText, ChevronRight, Copy, FilePlus } from "lucide-react";

interface ClientActionCenterProps {
    client: Client;
}

export function ClientActionCenter({ client }: ClientActionCenterProps) {
    
    const ActionItem = ({ href, title, description, icon: Icon }: { href: string; title: string; description: string; icon: React.ElementType }) => (
        <Link href={href} passHref>
            <div className="flex items-center p-4 rounded-lg bg-background hover:bg-muted/80 transition-all cursor-pointer border">
                <div className="p-3 bg-primary/10 rounded-lg mr-4">
                    <Icon className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-grow">
                    <h4 className="font-semibold text-foreground">{title}</h4>
                    <p className="text-sm text-muted-foreground">{description}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
        </Link>
    );

    return (
        <Card className="shadow-lg">
            <CardHeader>
                <CardTitle>Client Action Center</CardTitle>
                <CardDescription>Create new orders or invoices for {client.companyName}.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-foreground flex items-center"><FilePlus className="mr-2 h-5 w-5 text-primary"/>Single Invoicing</h3>
                    <ActionItem 
                        href={`/orders/new?clientId=${client.id}`}
                        title="Create New Order"
                        description="For one-time events or single deliveries."
                        icon={BookOpen}
                    />
                    <ActionItem 
                        href={`/proforma-invoices/new?clientId=${client.id}`}
                        title="Create Proforma Invoice"
                        description="Generate a quote for a single event."
                        icon={FileText}
                    />
                    <ActionItem 
                        href={`/invoices/new?clientId=${client.id}`}
                        title="Create Final Invoice"
                        description="Directly generate a final bill."
                        icon={FileText}
                    />
                </div>
                <div className="space-y-4">
                     <h3 className="text-lg font-semibold text-foreground flex items-center"><Copy className="mr-2 h-5 w-5 text-primary"/>Continuous Invoicing</h3>
                    <ActionItem 
                        href={`/bookings?clientId=${client.id}`}
                        title="Start Continuous Booking"
                        description="For long-term contracts (e.g., daily meals)."
                        icon={FilePlus}
                    />
                     <ActionItem 
                        href={`/bookings?clientId=${client.id}`}
                        title="View Continuous Bookings"
                        description="Manage ongoing contracts for this client."
                        icon={FileText}
                    />
                </div>
            </CardContent>
        </Card>
    )
}
