
"use client";

import { useDailyMenuStorage } from "@/hooks/use-daily-menu-storage";
import { useClientStorage } from "@/hooks/use-client-storage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, MapPin, Users, Loader2, BookOpen } from "lucide-react";
import Link from "next/link";
import { Button } from "../ui/button";
import type { ClientEvent } from "@/types";
import { format, parseISO, isFuture } from 'date-fns';

interface upcomingEvent extends ClientEvent {
    menuId: string;
    menuName: string;
}

export function UpcomingEvents() {
    const { menus, isLoading: menusLoading } = useDailyMenuStorage();
    const { getClientById, isLoading: clientsLoading } = useClientStorage();

    const isLoading = menusLoading || clientsLoading;

    const upcomingEvents: upcomingEvent[] = menus
        .flatMap(menu => 
            menu.clientEvents.map(event => ({
                ...event,
                menuId: menu.id,
                menuName: menu.name
            }))
        )
        .filter(event => isFuture(parseISO(event.date)))
        .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime())
        .slice(0, 5);

    return (
        <Card className="bg-gradient-card shadow-card">
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
                            <Link href="/daily-menus/new">Schedule an Event</Link>
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {upcomingEvents.map((event, index) => {
                            const client = getClientById(event.clientId);
                            return (
                                <Link href={`/daily-menus/${event.menuId}`} key={`${event.menuId}-${index}`} className="block p-4 rounded-lg bg-background/50 hover:bg-accent/50 transition-smooth border border-border/50">
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
