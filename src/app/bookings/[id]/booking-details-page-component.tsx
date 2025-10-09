
"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import type { Booking, Order } from '@/types';
import { useBookingStorage } from "@/hooks/use-booking-storage";
import { useOrderStorage } from "@/hooks/use-order-storage";
import { useClientStorage } from "@/hooks/use-client-storage";
import { LoadingPage } from "@/components/layout/loading-page";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Calendar, User, ArrowLeft, PlusCircle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { DailyOrdersTable } from "@/components/bookings/daily-orders-table";
import { AddDailyOrderDialog } from "@/components/bookings/add-daily-order-dialog";
import { OrderFormData } from "@/lib/schemas";
import { useToast } from "@/hooks/use-toast";


export function BookingDetailsPageComponent() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { getBookingById, isLoading: bookingsLoading } = useBookingStorage();
  const { orders, getOrdersByBookingId, addOrder, deleteOrder: deleteOrderFromStore, isLoading: ordersLoading } = useOrderStorage();
  const { getClientById, isLoading: clientsLoading } = useClientStorage();

  const [booking, setBooking] = useState<Booking | undefined>(undefined);
  const [bookingOrders, setBookingOrders] = useState<Order[]>([]);
  const [isAddOrderOpen, setIsAddOrderOpen] = useState(false);
  
  const bookingId = typeof params.id === 'string' ? params.id : undefined;

  useEffect(() => {
    if (bookingId && !bookingsLoading && !ordersLoading) {
      const foundBooking = getBookingById(bookingId);
      if (foundBooking) {
        setBooking(foundBooking);
        setBookingOrders(getOrdersByBookingId(bookingId));
      } else {
        // router.push('/bookings'); // Redirect if not found
      }
    }
  }, [bookingId, bookingsLoading, orders, ordersLoading, getBookingById, getOrdersByBookingId, router]);

  const handleAddDailyOrder = async (orderData: Partial<OrderFormData>) => {
    if (!bookingId) return;
    try {
        await addOrder(orderData);
        toast({ title: "Success", description: "Daily order has been recorded."});
        setIsAddOrderOpen(false); // Close dialog on success
    } catch(error) {
        console.error(error);
        toast({ variant: "destructive", title: "Error", description: "Failed to record daily order."});
    }
  }

  const handleDeleteDailyOrder = async (orderId: string) => {
    try {
        await deleteOrderFromStore(orderId);
        toast({ title: "Success", description: "Daily order deleted."});
    } catch(error) {
         console.error(error);
        toast({ variant: "destructive", title: "Error", description: "Failed to delete daily order."});
    }
  }
  
  const getOrderTotal = (order: Order) => {
      return order.clientEvents.reduce((sum, event) => sum + (event.unitPrice * event.numberOfPeople), 0);
  }

  const bookingTotal = useMemo(() => {
    return bookingOrders.reduce((sum, order) => sum + getOrderTotal(order), 0);
  }, [bookingOrders]);

  const isLoading = bookingsLoading || clientsLoading || ordersLoading;
  
  if (isLoading) {
    return <LoadingPage title="Loading Booking Details..." />;
  }

  if (!booking) {
    return (
        <div className="text-center py-10">
            <h2 className="text-2xl font-semibold text-destructive">Booking Not Found</h2>
            <p className="text-muted-foreground mt-2">The requested booking could not be found.</p>
            <Button asChild className="mt-4"><Link href="/bookings">Back to Bookings</Link></Button>
        </div>
    );
  }
  
  const client = getClientById(booking.client_id);

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
            data={bookingOrders} 
            onDeleteOrder={handleDeleteDailyOrder}
        />
        
        <AddDailyOrderDialog
            isOpen={isAddOrderOpen}
            setIsOpen={setIsAddOrderOpen}
            onSubmit={handleAddDailyOrder}
            bookingStartDate={booking.start_date}
            bookingEndDate={booking.end_date}
            clientId={booking.client_id}
            bookingId={booking.id}
        />
    </div>
  );
}
