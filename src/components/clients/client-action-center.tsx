
"use client";

import type { Client } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { BookOpen, FileText, Calculator, ChevronRight } from "lucide-react";

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
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                    <ActionItem 
                        href="/daily-menus/new"
                        title="Create New Order"
                        description="Start a new booking or event"
                        icon={BookOpen}
                    />
                    <ActionItem 
                        href={`/daily-menus?clientId=${client.id}`}
                        title="Retrieve Existing Orders"
                        description="View all bookings for this client"
                        icon={BookOpen}
                    />
                </div>
                <div className="space-y-3">
                    <ActionItem 
                        href="/proforma-invoices/new"
                        title="Create New Proforma"
                        description="Generate a proforma invoice"
                        icon={FileText}
                    />
                     <ActionItem 
                        href={`/invoicing/proforma-invoices?clientId=${client.id}`}
                        title="Access Existing Proformas"
                        description="View all proformas for this client"
                        icon={FileText}
                    />
                </div>
                 <div className="space-y-3">
                    <ActionItem 
                        href="/invoices/new"
                        title="Create New Invoice"
                        description="Generate a final invoice"
                        icon={FileText}
                    />
                     <ActionItem 
                        href={`/invoicing/invoices?clientId=${client.id}`}
                        title="Access Existing Invoices"
                        description="View all invoices for this client"
                        icon={FileText}
                    />
                </div>
                <div className="space-y-3">
                     <ActionItem 
                        href="/costing"
                        title="Perform Individual Costing"
                        description="Analyze costs related to client services"
                        icon={Calculator}
                    />
                </div>
            </CardContent>
        </Card>
    )
}
