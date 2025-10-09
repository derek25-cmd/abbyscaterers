
"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import type { Booking, DailyOrder, Client } from '@/types';
import { useBookingStorage } from "@/hooks/use-booking-storage";
import { useClientStorage } from "@/hooks/use-client-storage";
import { LoadingPage } from "@/components/layout/loading-page";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Calendar, User, ArrowLeft, PlusCircle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { DailyOrdersTable } from "@/components/bookings/daily-orders-table";
import { AddDailyOrderDialog } from "@/components/bookings/add-daily-order-dialog";
import { DailyOrderFormData } from "@/lib/schemas";
import { useToast } from "@/hooks/use-toast";


export function BookingDetailsPageComponent() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { getBookingById, isLoading: bookingsLoading, getDailyOrdersByBooking, addDailyOrder, deleteDailyOrder } = useBookingStorage();
  const { getClientById, isLoading: clientsLoading } = useClientStorage();

  const [booking, setBooking] = useState<Booking | undefined>(undefined);
  const [dailyOrders, setDailyOrders] = useState<DailyOrder[]>([]);
  const [client, setClient] = useState<Client | undefined>(undefined);
  const [isAddOrderOpen, setIsAddOrderOpen] = useState(false);
  
  const bookingId = typeof params.id === 'string' ? params.id : undefined;

  useEffect(() => {
    if (bookingId && !bookingsLoading && !clientsLoading) {
      const foundBooking = getBookingById(bookingId);
      if (foundBooking) {
        setBooking(foundBooking);
        setClient(getClientById(foundBooking.client_id));
        setDailyOrders(getDailyOrdersByBooking(bookingId));
      } else {
        router.push('/bookings'); // Redirect if not found
      }
    }
  }, [bookingId, bookingsLoading, clientsLoading, getBookingById, getClientById, getDailyOrdersByBooking, router]);

  const handleAddDailyOrder = async (orderData: Omit<DailyOrderFormData, 'bookingId'>) => {
    if (!bookingId) return;
    try {
        const payload: DailyOrderFormData = {
            ...orderData,
            bookingId: bookingId,
            total: orderData.quantity * orderData.unitPrice,
        };
        await addDailyOrder(payload);
        toast({ title: "Success", description: "Daily order has been recorded."});
        setIsAddOrderOpen(false);
    } catch(error) {
        console.error(error);
        toast({ variant: "destructive", title: "Error", description: "Failed to record daily order."});
    }
  }

  const handleDeleteDailyOrder = async (orderId: number) => {
    try {
        await deleteDailyOrder(orderId);
        toast({ title: "Success", description: "Daily order deleted."});
    } catch(error) {
         console.error(error);
        toast({ variant: "destructive", title: "Error", description: "Failed to delete daily order."});
    }
  }

  if (bookingsLoading || clientsLoading) {
    return <LoadingPage title="Loading Booking Details..." />;
  }

  if (!booking) {
    return null; // Or a not-found page
  }
  
  const bookingTotal = dailyOrders.reduce((sum, order) => sum + order.total, 0);

  return (
    <div className="space-y-6">
       <div className="flex justify-between items-center">
            <div>
                <Button variant="ghost" size="sm" asChild>
                    <Link href="/bookings"><ArrowLeft className="mr-2 h-4 w-4" />Back to Bookings</Link>
                </Button>
                <h1 className="text-3xl font-bold tracking-tight text-foreground">{booking.name}</h1>
                <p className="text-muted-foreground">Manage daily orders for this continuous contract.</p>
            </div>
            <Button onClick={() => setIsAddOrderOpen(true)}>
                <PlusCircle className="mr-2 h-4 w-4"/>
                Record Daily Order
            </Button>
       </div>

        <Card>
            <CardHeader>
                <CardTitle>Contract Details</CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-3 gap-4 text-sm">
                <div className="flex items-center gap-2">
                    <User className="h-5 w-5 text-primary"/>
                    <div>
                        <p className="font-semibold">Client</p>
                        <p className="text-muted-foreground">{client?.companyName || 'Loading...'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary"/>
                    <div>
                        <p className="font-semibold">Contract Period</p>
                        <p className="text-muted-foreground">{format(parseISO(booking.start_date), 'PPP')} - {format(parseISO(booking.end_date), 'PPP')}</p>
                    </div>
                </div>
                 <div className="flex items-center gap-2">
                    <User className="h-5 w-5 text-primary"/>
                    <div>
                        <p className="font-semibold">Total Billed</p>
                        <p className="text-muted-foreground">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'TZS' }).format(bookingTotal)}</p>
                    </div>
                </div>
            </CardContent>
        </Card>

        <DailyOrdersTable 
            data={dailyOrders} 
            onDeleteOrder={handleDeleteDailyOrder}
        />
        
        <AddDailyOrderDialog
            isOpen={isAddOrderOpen}
            setIsOpen={setIsAddOrderOpen}
            onSubmit={handleAddDailyOrder}
            bookingStartDate={booking.start_date}
            bookingEndDate={booking.end_date}
        />
    </div>
  );
}

