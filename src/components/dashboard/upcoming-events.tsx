
"use client";

import { useOrderStorage } from "@/hooks/use-order-storage";
import { useClientStorage } from "@/hooks/use-client-storage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Users, Loader2 } from "lucide-react";
import Link from "next/link";
import { Button } from "../ui/button";
import type { ClientEvent } from "@/types";
import { format, parseISO, isFuture } from 'date-fns';

interface upcomingEvent extends ClientEvent {
    orderId: string;
    orderName: string;
}

export function UpcomingEvents() {
    const { orders, isLoading: ordersLoading } = useOrderStorage();
    const { getClientById, isLoading: clientsLoading } = useClientStorage();

    const isLoading = ordersLoading || clientsLoading;

    const upcomingEvents: upcomingEvent[] = orders
        .flatMap(order => 
            order.clientEvents.map(event => ({
                ...event,
                orderId: order.id,
                orderName: order.name
            }))
        )
        .filter(event => isFuture(parseISO(event.date)))
        .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime())
        .slice(0, 5);

    return (
        <Card className="shadow-sm">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary" />
                    Upcoming Events
                </CardTitle>
            </CardHeader>
            <CardContent>
                 {isLoading ? (
                     <div className="flex items-center justify-center h-48">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                     </div>
                ) : upcomingEvents.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">
                        <Calendar className="mx-auto h-12 w-12 mb-4" />
                        <h3 className="text-lg font-semibold">No Upcoming Events</h3>
                        <p className="text-sm">Schedule new bookings to see them here.</p>
                         <Button asChild variant="secondary" className="mt-4">
                            <Link href="/orders/new">Schedule an Event</Link>
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {upcomingEvents.map((event, index) => {
                            const client = getClientById(event.clientId);
                            return (
                                <Link href={`/orders/${event.orderId}`} key={`${event.orderId}-${index}`} className="block p-4 rounded-lg bg-background/50 hover:bg-accent/50 transition-colors border">
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-semibold text-foreground">{client?.companyName || 'Unknown Client'}</h4>
                                        <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                                            {event.mealType}
                                        </span>
                                    </div>
                                    <div className="space-y-2 text-sm text-muted-foreground">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="h-4 w-4" />
                                            {format(parseISO(event.date), "EEE, MMM d, yyyy")}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Users className="h-4 w-4" />
                                            {event.numberOfPeople} guests
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
