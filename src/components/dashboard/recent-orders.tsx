
"use client";

import { useOrderStorage } from "@/hooks/use-order-storage";
import { useClientStorage } from "@/hooks/use-client-storage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Clock, Loader2, User } from "lucide-react";
import Link from "next/link";
import { Button } from "../ui/button";
import { format, parseISO } from 'date-fns';

export function RecentOrders() {
    const { orders, isLoading: ordersLoading } = useOrderStorage();
    const { getClientById, isLoading: clientsLoading } = useClientStorage();

    const isLoading = ordersLoading || clientsLoading;

    // Get the 5 most recently created bookings
    const recentOrders = [...orders]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5);
    
    return (
        <Card className="shadow-sm">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-primary" />
                    Recent Bookings
                </CardTitle>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                     <div className="flex items-center justify-center h-48">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                     </div>
                ) : recentOrders.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">
                        <BookOpen className="mx-auto h-12 w-12 mb-4" />
                        <h3 className="text-lg font-semibold">No Recent Bookings</h3>
                        <p className="text-sm">New bookings you create will appear here.</p>
                         <Button asChild variant="secondary" className="mt-4">
                            <Link href="/orders/new">Create a Booking</Link>
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {recentOrders.map((order) => {
                             const firstClient = order.clientEvents.length > 0 ? getClientById(order.clientEvents[0].clientId) : null;
                             const createdDate = parseISO(order.createdAt);

                            return (
                                <Link href={`/orders/${order.id}`} key={order.id} className="block p-3 rounded-lg bg-background/50 hover:bg-accent/50 transition-colors">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-foreground">{order.name}</span>
                                                <Badge variant="outline">{order.id}</Badge>
                                            </div>
                                            {firstClient && (
                                                <p className="text-sm text-muted-foreground flex items-center gap-1.5"><User className="h-3 w-3" />{firstClient.companyName}</p>
                                            )}
                                            <p className="text-xs text-muted-foreground">
                                                Created on {format(createdDate, "PPP")}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <Badge variant="secondary">{order.clientEvents.length} Event(s)</Badge>
                                        </div>
                                    </div>
                                </Link>
                            )
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
